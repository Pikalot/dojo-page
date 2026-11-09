"""The version check and transaction behavior of every content write."""
import datetime
from unittest import mock

from django.db import IntegrityError, OperationalError, connection
from django.test import TestCase

from content import services
from content.models import Announcement, ClassType, Content, Instructor, Photo, Portrait, Rank, Schedule

from .helpers import make_announcement, make_author, make_class_type, make_photo, make_rank, make_schedule


class ParseVersionTests(TestCase):
    def test_accepts_positive_ints_and_digit_strings(self):
        for raw, expected in [(1, 1), (42, 42), ("7", 7), (" 7 ", 7)]:
            with self.subTest(raw=raw):
                self.assertEqual(services.parse_version(raw), expected)

    def test_rejects_everything_else(self):
        bad = [None, "", " ", "abc", "1.5", 1.5, "-1", -1, 0, "0", True, False, [], {}, "1e3", "١"]
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(services.InvalidVersionError):
                services.parse_version(raw)


class SaveContentTests(TestCase):
    def setUp(self):
        self.author = make_author()
        self.item = make_announcement(self.author)

    def fresh(self):
        return Announcement.objects.get(pk=self.item.pk)

    def test_matching_version_saves_and_increments(self):
        self.item.title_en = "Changed"
        services.save_content(self.item, 1)
        stored = self.fresh()
        self.assertEqual(stored.title_en, "Changed")
        self.assertEqual(stored.version, 2)
        self.assertEqual(self.item.version, 2)

    def test_updates_the_modification_time(self):
        before = self.fresh().updated_at
        Content.objects.filter(pk=self.item.pk).update(updated_at=before - datetime.timedelta(days=1))
        services.save_content(self.fresh(), 1)
        self.assertGreater(self.fresh().updated_at, before - datetime.timedelta(minutes=1))

    def test_keeps_author_and_created_at(self):
        before = self.fresh()
        services.save_content(self.fresh(), 1)
        after = self.fresh()
        self.assertEqual(after.author_id, before.author_id)
        self.assertEqual(after.created_at, before.created_at)

    def test_each_save_needs_the_new_version(self):
        services.save_content(self.fresh(), 1)
        with self.assertRaises(services.StaleVersionError):
            services.save_content(self.fresh(), 1)
        services.save_content(self.fresh(), 2)
        self.assertEqual(self.fresh().version, 3)

    def test_second_editor_with_the_same_version_is_rejected_and_changes_nothing(self):
        first, second = self.fresh(), self.fresh()
        first.title_en = "First editor"
        services.save_content(first, 1)

        second.title_en = "Second editor"
        with self.assertRaises(services.StaleVersionError) as caught:
            services.save_content(second, 1)

        self.assertEqual(caught.exception.expected_version, 1)
        self.assertEqual(caught.exception.current_version, 2)
        self.assertEqual(caught.exception.content_id, self.item.pk)
        stored = self.fresh()
        self.assertEqual(stored.title_en, "First editor")
        self.assertEqual(stored.version, 2)

    def test_version_from_the_future_is_rejected(self):
        with self.assertRaises(services.StaleVersionError):
            services.save_content(self.fresh(), 99)
        self.assertEqual(self.fresh().version, 1)

    def test_version_too_large_for_the_column_is_rejected(self):
        with self.assertRaises(services.StaleVersionError):
            services.save_content(self.fresh(), 10**30)
        self.assertEqual(self.fresh().version, 1)

    def test_compares_the_submitted_version_not_the_objects(self):
        obj = self.fresh()
        Content.objects.filter(pk=obj.pk).update(version=5)
        obj.title_en = "Stale object, stale token"
        with self.assertRaises(services.StaleVersionError):
            services.save_content(obj, 1)
        self.assertEqual(self.fresh().title_en, "Original")
        self.assertEqual(self.fresh().version, 5)

    def test_invalid_versions_are_rejected_before_touching_the_database(self):
        obj = self.fresh()
        obj.title_en = "Should not save"
        for bad in [None, "", "abc", 0, -1, True]:
            with self.subTest(bad=bad), self.assertRaises(services.InvalidVersionError):
                services.save_content(obj, bad)
        self.assertEqual(self.fresh().title_en, "Original")

    def test_record_deleted_meanwhile_raises_gone_and_does_not_recreate_it(self):
        obj = self.fresh()
        Content.objects.filter(pk=obj.pk).delete()
        with self.assertRaises(services.ContentGoneError):
            services.save_content(obj, 1)
        self.assertFalse(Content.objects.filter(pk=obj.pk).exists())
        self.assertFalse(Announcement.objects.filter(pk=obj.pk).exists())

    def test_unsaved_object_is_refused(self):
        unsaved = Announcement(title_en="New")
        with self.assertRaises(ValueError):
            services.save_content(unsaved, 1)

    def test_non_content_object_is_refused(self):
        with self.assertRaises(TypeError):
            services.save_content(make_class_type(), 1)

    def test_failure_after_the_version_claim_rolls_everything_back(self):
        obj = self.fresh()
        obj.title_en = "Should not save"
        with mock.patch.object(Announcement, "save", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.save_content(obj, 1)
        stored = self.fresh()
        self.assertEqual(stored.version, 1, "The version bump must roll back")
        self.assertEqual(stored.title_en, "Original")

    def test_failure_restores_the_objects_version(self):
        obj = self.fresh()
        with mock.patch.object(Announcement, "save", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.save_content(obj, 1)
        self.assertEqual(obj.version, 1)

    def test_conflict_also_restores_the_objects_version(self):
        obj = self.fresh()
        Content.objects.filter(pk=obj.pk).update(version=3)
        with self.assertRaises(services.StaleVersionError):
            services.save_content(obj, 1)
        self.assertEqual(obj.version, 1)

    def test_retry_works_after_a_rolled_back_failure(self):
        obj = self.fresh()
        obj.title_en = "Second try"
        with mock.patch.object(Announcement, "save", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.save_content(obj, 1)
        services.save_content(obj, 1)
        self.assertEqual(self.fresh().title_en, "Second try")
        self.assertEqual(self.fresh().version, 2)

    def test_too_long_value_rolls_back_as_a_constraint_error(self):
        obj = self.fresh()
        obj.title_en = "x" * 201
        with self.assertRaises(services.ContentConstraintError):
            services.save_content(obj, 1)
        self.assertEqual(self.fresh().version, 1)

    def test_vietnamese_and_emoji_text_round_trips(self):
        obj = self.fresh()
        obj.title_vi = "Võ đường Nhất Đẳng 公認 🥋"
        services.save_content(obj, 1)
        self.assertEqual(self.fresh().title_vi, "Võ đường Nhất Đẳng 公認 🥋")

    def test_lock_errors_become_busy_and_roll_back(self):
        for code in (1205, 1213):
            obj = self.fresh()
            obj.title_en = "Should not save"
            with self.subTest(code=code), mock.patch.object(
                Announcement, "save", side_effect=OperationalError(code, "locked")
            ):
                with self.assertRaises(services.ContentBusyError):
                    services.save_content(obj, 1)
            self.assertEqual(self.fresh().version, 1)
            self.assertEqual(self.fresh().title_en, "Original")

    def test_other_database_errors_are_not_disguised_but_still_roll_back(self):
        obj = self.fresh()
        with mock.patch.object(Announcement, "save", side_effect=OperationalError(2006, "server has gone away")):
            with self.assertRaises(OperationalError):
                services.save_content(obj, 1)
        self.assertEqual(self.fresh().version, 1)


class ScheduleConstraintTests(TestCase):
    def setUp(self):
        self.author = make_author()
        self.kids = make_class_type()

    def test_duplicate_slot_rolls_back_the_version_bump(self):
        make_schedule(self.author, self.kids, day=0)
        other = make_schedule(self.author, self.kids, day=1)
        other.day_of_wk = 0
        with self.assertRaises(services.ContentConstraintError):
            services.save_content(other, 1)
        stored = Schedule.objects.get(pk=other.pk)
        self.assertEqual(stored.version, 1)
        self.assertEqual(stored.day_of_wk, 1)

    def test_end_before_start_is_refused_by_the_database(self):
        slot = make_schedule(self.author, self.kids)
        slot.end_time = datetime.time(18, 0)
        with self.assertRaises(services.ContentConstraintError):
            services.save_content(slot, 1)
        self.assertEqual(Schedule.objects.get(pk=slot.pk).version, 1)

    def test_invalid_day_is_refused_by_the_database(self):
        slot = make_schedule(self.author, self.kids)
        slot.day_of_wk = 7
        with self.assertRaises(services.ContentConstraintError):
            services.save_content(slot, 1)


class CreateContentTests(TestCase):
    def setUp(self):
        self.author = make_author()

    def new(self, **overrides):
        values = dict(date=datetime.date(2026, 1, 1), title_en="N", title_vi="N", body_en="B", body_vi="B")
        return Announcement(**{**values, **overrides})

    def test_sets_author_and_starts_at_version_one(self):
        obj = services.create_content(self.new(version=50), self.author)
        stored = Announcement.objects.get(pk=obj.pk)
        self.assertEqual(stored.author, self.author)
        self.assertEqual(stored.version, 1)

    def test_new_content_is_unpublished_by_default(self):
        obj = services.create_content(self.new(), self.author)
        self.assertFalse(Announcement.objects.get(pk=obj.pk).is_published)

    def test_failure_leaves_no_parent_row_behind(self):
        count = Content.objects.count()
        with self.assertRaises(services.ContentConstraintError):
            services.create_content(self.new(title_en="x" * 201), self.author)
        self.assertEqual(Content.objects.count(), count)

    def test_duplicate_slot_leaves_no_parent_row_behind(self):
        kids = make_class_type()
        make_schedule(self.author, kids)
        count = Content.objects.count()
        duplicate = Schedule(
            class_type=kids, day_of_wk=0, start_time=datetime.time(19, 0), end_time=datetime.time(21, 0)
        )
        with self.assertRaises(services.ContentConstraintError):
            services.create_content(duplicate, self.author)
        self.assertEqual(Content.objects.count(), count)

    def test_existing_object_is_refused(self):
        with self.assertRaises(ValueError):
            services.create_content(make_announcement(self.author), self.author)

    def test_non_content_object_is_refused(self):
        with self.assertRaises(TypeError):
            services.create_content(ClassType(class_name_en="x"), self.author)


class DeleteContentTests(TestCase):
    def setUp(self):
        self.author = make_author()
        self.item = make_announcement(self.author)

    def test_matching_version_deletes_both_rows(self):
        pk = self.item.pk
        services.delete_content(self.item, 1)
        self.assertFalse(Announcement.objects.filter(pk=pk).exists())
        self.assertFalse(Content.objects.filter(pk=pk).exists())

    def test_stale_version_deletes_nothing(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        with self.assertRaises(services.StaleVersionError):
            services.delete_content(self.item, 1)
        self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())
        self.assertEqual(Content.objects.get(pk=self.item.pk).version, 2)

    def test_already_deleted_raises_gone(self):
        obj = Announcement.objects.get(pk=self.item.pk)
        Content.objects.filter(pk=obj.pk).delete()
        with self.assertRaises(services.ContentGoneError):
            services.delete_content(obj, 1)

    def test_invalid_version_deletes_nothing(self):
        for bad in [None, "", "abc"]:
            with self.subTest(bad=bad), self.assertRaises(services.InvalidVersionError):
                services.delete_content(self.item, bad)
        self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())

    def test_failed_delete_rolls_back_the_version_bump(self):
        with mock.patch.object(Announcement, "delete", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.delete_content(self.item, 1)
        self.assertEqual(Content.objects.get(pk=self.item.pk).version, 1)

    def test_deleting_a_photo_removes_its_links_not_the_instructor(self):
        rank = make_rank()
        person = Instructor.objects.create(author=self.author, name="A", rank=rank)
        photo = make_photo(self.author)
        Portrait.objects.create(photo=photo, instructor=person)
        services.delete_content(photo, 1)
        self.assertFalse(Portrait.objects.exists())
        self.assertFalse(Photo.objects.exists())
        self.assertTrue(Instructor.objects.filter(pk=person.pk).exists())


class SetPublishedTests(TestCase):
    def setUp(self):
        self.author = make_author()

    def test_changes_only_rows_that_differ_and_bumps_only_those(self):
        draft = make_announcement(self.author, is_published=False)
        live = make_announcement(self.author, is_published=True)
        changed = services.set_published([draft.pk, live.pk], True)
        self.assertEqual(changed, 1)
        self.assertEqual(Content.objects.get(pk=draft.pk).version, 2)
        self.assertEqual(Content.objects.get(pk=live.pk).version, 1)

    def test_editor_with_the_page_open_gets_a_conflict(self):
        item = make_announcement(self.author, is_published=False)
        open_page = Announcement.objects.get(pk=item.pk)
        services.set_published([item.pk], True)
        with self.assertRaises(services.StaleVersionError):
            services.save_content(open_page, 1)
        self.assertTrue(Content.objects.get(pk=item.pk).is_published)

    def test_missing_ids_and_empty_lists_do_nothing(self):
        self.assertEqual(services.set_published([999999], True), 0)
        self.assertEqual(services.set_published([], True), 0)


class ApprovedSchemaRulesTests(TestCase):
    """What createdb.sql promises for anyone using SQL directly."""

    def setUp(self):
        self.author = make_author()

    def run_sql(self, sql, params):
        with connection.cursor() as cursor:
            cursor.execute(sql, params)

    def test_deleting_a_class_in_django_removes_its_slots_and_their_parent_rows(self):
        kids = make_class_type()
        slot = make_schedule(self.author, kids)
        kids.delete()
        self.assertFalse(Schedule.objects.filter(pk=slot.pk).exists())
        self.assertFalse(Content.objects.filter(pk=slot.pk).exists())

    def test_deleting_a_class_with_sql_is_restricted(self):
        kids = make_class_type()
        make_schedule(self.author, kids)
        with self.assertRaises(IntegrityError):
            self.run_sql("DELETE FROM ClassTypes WHERE class_type_id = %s", [kids.pk])

    def test_deleting_a_rank_in_use_with_sql_is_restricted(self):
        rank = make_rank()
        Instructor.objects.create(author=self.author, name="A", rank=rank)
        with self.assertRaises(IntegrityError):
            self.run_sql("DELETE FROM Ranks WHERE rank_id = %s", [rank.pk])
        self.assertTrue(Rank.objects.filter(pk=rank.pk).exists())

    def test_deleting_a_contents_row_with_sql_cascades_to_the_subtype(self):
        item = make_announcement(self.author)
        self.run_sql("DELETE FROM Contents WHERE content_id = %s", [item.pk])
        self.assertFalse(Announcement.objects.filter(pk=item.pk).exists())

    def test_deleting_an_author_with_content_is_restricted(self):
        make_announcement(self.author)
        with self.assertRaises(IntegrityError):
            self.run_sql("DELETE FROM auth_user WHERE id = %s", [self.author.pk])

    def test_database_defaults_work_for_plain_sql_inserts(self):
        self.run_sql("INSERT INTO Contents (author_id) VALUES (%s)", [self.author.pk])
        row = Content.objects.order_by("-pk").first()
        self.assertEqual(row.version, 1)
        self.assertFalse(row.is_published)
        self.assertIsNotNone(row.created_at)
