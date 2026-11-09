"""Real concurrent transactions on real MySQL connections.

These use threads and TransactionTestCase, because TestCase wraps each test in
one transaction on one connection, where none of this could happen. Events and
barriers set the order, so the outcome doesn't depend on timing.
"""
import datetime
import threading

from django.db import close_old_connections, connection, connections, transaction
from django.test import TransactionTestCase

from content import services
from content.models import Announcement, Content, Schedule

from .helpers import make_announcement, make_author, make_class_type

WAIT = 30  # Seconds. Only reached if something is broken.


def run_in_threads(*functions):
    """Runs each function on its own connection; returns result or exception for each."""
    results = [None] * len(functions)

    def runner(index, function):
        close_old_connections()
        try:
            results[index] = function()
        except Exception as exc:  # noqa: BLE001 - reported to the test as a value
            results[index] = exc
        finally:
            connections.close_all()

    threads = [threading.Thread(target=runner, args=(i, f)) for i, f in enumerate(functions)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(WAIT)
        if thread.is_alive():
            raise AssertionError("A thread did not finish; a lock may be stuck.")
    return results


class ConcurrentEditTests(TransactionTestCase):
    def setUp(self):
        self.author = make_author()
        self.item = make_announcement(self.author)

    def stored(self):
        return Announcement.objects.get(pk=self.item.pk)

    def test_many_editors_with_the_same_version_exactly_one_wins(self):
        editors = 8
        barrier = threading.Barrier(editors, timeout=WAIT)

        def edit(number):
            def run():
                obj = Announcement.objects.get(pk=self.item.pk)
                obj.title_en = f"Editor {number}"
                barrier.wait()  # Everyone has read version 1 before anyone writes.
                services.save_content(obj, 1)
                return number

            return run

        results = run_in_threads(*(edit(n) for n in range(editors)))

        winners = [r for r in results if isinstance(r, int)]
        losers = [r for r in results if isinstance(r, services.StaleVersionError)]
        self.assertEqual(len(winners), 1, results)
        self.assertEqual(len(losers), editors - 1, results)
        stored = self.stored()
        self.assertEqual(stored.version, 2, "Exactly one increment")
        self.assertEqual(stored.title_en, f"Editor {winners[0]}", "The winner's text, not a loser's")

    def test_second_editor_waits_for_the_first_then_is_rejected(self):
        claimed = threading.Event()
        release = threading.Event()

        def first():
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "First"
            with transaction.atomic():
                services.save_content(obj, 1)
                claimed.set()
                release.wait(WAIT)  # Holds the row lock, uncommitted.
            return "first"

        def second():
            claimed.wait(WAIT)
            obj = Announcement.objects.get(pk=self.item.pk)  # Still sees version 1.
            self.assertEqual(obj.version, 1)
            obj.title_en = "Second"
            threading.Timer(0.3, release.set).start()
            services.save_content(obj, 1)  # Blocks until first commits.
            return "second"

        results = run_in_threads(first, second)

        self.assertEqual(results[0], "first")
        self.assertIsInstance(results[1], services.StaleVersionError)
        self.assertEqual(results[1].current_version, 2)
        self.assertEqual(self.stored().title_en, "First")

    def test_if_the_first_editor_rolls_back_the_second_one_succeeds(self):
        claimed = threading.Event()
        release = threading.Event()

        class Abort(Exception):
            pass

        def first():
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "First"
            with transaction.atomic():
                services.save_content(obj, 1)
                claimed.set()
                release.wait(WAIT)
                raise Abort

        def second():
            claimed.wait(WAIT)
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "Second"
            threading.Timer(0.3, release.set).start()
            services.save_content(obj, 1)
            return "second"

        results = run_in_threads(first, second)

        self.assertIsInstance(results[0], Abort)
        self.assertEqual(results[1], "second")
        stored = self.stored()
        self.assertEqual(stored.title_en, "Second")
        self.assertEqual(stored.version, 2, "The rolled-back bump must not count")

    def test_uncommitted_edits_are_invisible_to_readers(self):
        claimed = threading.Event()
        release = threading.Event()

        def writer():
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "Uncommitted"
            with transaction.atomic():
                services.save_content(obj, 1)
                claimed.set()
                release.wait(WAIT)

        def reader():
            claimed.wait(WAIT)
            try:
                seen = Announcement.objects.get(pk=self.item.pk)
                return seen.title_en, seen.version
            finally:
                release.set()

        results = run_in_threads(writer, reader)

        self.assertEqual(results[1], ("Original", 1), "No dirty read")
        self.assertEqual(self.stored().title_en, "Uncommitted")

    def test_partial_failure_is_never_visible_to_readers(self):
        """A reader during the failing transaction, and after it, sees the old state."""
        claimed = threading.Event()
        release = threading.Event()

        def writer():
            with transaction.atomic():
                Content.objects.filter(pk=self.item.pk).update(version=2)
                claimed.set()
                release.wait(WAIT)
                raise RuntimeError("Second step failed")

        def reader():
            claimed.wait(WAIT)
            try:
                return Content.objects.get(pk=self.item.pk).version
            finally:
                release.set()

        results = run_in_threads(writer, reader)

        self.assertIsInstance(results[0], RuntimeError)
        self.assertEqual(results[1], 1)
        self.assertEqual(self.stored().version, 1)

    def test_committed_edit_is_visible_on_a_new_connection(self):
        obj = self.stored()
        obj.title_en = "Committed"
        services.save_content(obj, 1)
        connection.close()  # Nothing can be left in this session.

        results = run_in_threads(lambda: Announcement.objects.get(pk=self.item.pk).title_en)
        self.assertEqual(results[0], "Committed")

    def test_edit_racing_a_delete_has_one_consistent_outcome(self):
        barrier = threading.Barrier(2, timeout=WAIT)

        def edit():
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "Edited"
            barrier.wait()
            services.save_content(obj, 1)
            return "edited"

        def delete():
            obj = Announcement.objects.get(pk=self.item.pk)
            barrier.wait()
            services.delete_content(obj, 1)
            return "deleted"

        results = run_in_threads(edit, delete)

        outcomes = [r for r in results if r in ("edited", "deleted")]
        failures = [r for r in results if isinstance(r, services.ContentError)]
        self.assertEqual(len(outcomes), 1, results)
        self.assertEqual(len(failures), 1, results)
        parent = Content.objects.filter(pk=self.item.pk).exists()
        child = Announcement.objects.filter(pk=self.item.pk).exists()
        self.assertEqual(parent, child, "Never half a record")
        self.assertEqual(parent, outcomes[0] == "edited")

    def test_two_deletes_one_succeeds_and_the_other_is_told(self):
        barrier = threading.Barrier(2, timeout=WAIT)

        def delete():
            obj = Announcement.objects.get(pk=self.item.pk)
            barrier.wait()
            services.delete_content(obj, 1)
            return "deleted"

        results = run_in_threads(delete, delete)

        self.assertEqual(results.count("deleted"), 1, results)
        loser = next(r for r in results if r != "deleted")
        self.assertIsInstance(loser, services.ContentGoneError)

    def test_bulk_publish_racing_an_edit_loses_nothing(self):
        barrier = threading.Barrier(2, timeout=WAIT)
        Content.objects.filter(pk=self.item.pk).update(is_published=False)

        def edit():
            obj = Announcement.objects.get(pk=self.item.pk)
            obj.title_en = "Edited"
            barrier.wait()
            services.save_content(obj, 1)
            return "edited"

        def publish():
            barrier.wait()
            return services.set_published([self.item.pk], True)

        results = run_in_threads(edit, publish)

        stored = self.stored()
        self.assertEqual(results[1], 1, results)
        if results[0] == "edited":
            # The edit claimed first. Publishing then applied on top of it.
            self.assertEqual(stored.version, 3)
            self.assertEqual(stored.title_en, "Edited")
            self.assertTrue(stored.is_published)
        else:
            # Publishing got in first, so the edit was stopped, not applied over it.
            self.assertIsInstance(results[0], services.StaleVersionError)
            self.assertEqual(stored.version, 2)
            self.assertEqual(stored.title_en, "Original")
            self.assertTrue(stored.is_published)


class ConcurrentCreateTests(TransactionTestCase):
    def test_same_slot_created_twice_leaves_one_slot_and_no_orphan_parent(self):
        author = make_author()
        kids = make_class_type()
        barrier = threading.Barrier(2, timeout=WAIT)

        def create():
            slot = Schedule(
                class_type=kids,
                day_of_wk=2,
                start_time=datetime.time(19, 0),
                end_time=datetime.time(20, 30),
            )
            barrier.wait()
            services.create_content(slot, author)
            return "created"

        results = run_in_threads(create, create)

        self.assertEqual(results.count("created"), 1, results)
        loser = next(r for r in results if r != "created")
        self.assertIsInstance(loser, (services.ContentConstraintError, services.ContentBusyError))
        self.assertEqual(Schedule.objects.count(), 1)
        self.assertEqual(Content.objects.count(), 1, "The loser's Contents row must roll back")
