"""Role changes, and the rule that an active administrator always remains."""
import threading
from unittest import mock

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.exceptions import PermissionDenied
from django.db import close_old_connections, connections
from django.test import TestCase, TransactionTestCase

from accounts import services
from accounts.roles import (
    ADMIN_GROUP,
    CATEGORIES,
    MODERATOR_GROUP,
    ROLE_ADMIN,
    ROLE_MODERATOR,
    ROLE_USER,
    category_group_name,
    sync_role_groups,
)

User = get_user_model()


def make_user(username, *groups, **fields):
    user = User.objects.create_user(username=username, password="pw-for-tests", **fields)
    user.groups.set(Group.objects.filter(name__in=groups))
    return user


class RoleDefinitionTests(TestCase):
    def perms(self, group):
        return set(Group.objects.get(name=group).permissions.values_list("codename", flat=True))

    def test_groups_exist_after_migrate(self):
        expected = {ADMIN_GROUP, MODERATOR_GROUP} | {category_group_name(key) for key in CATEGORIES}
        self.assertEqual(set(Group.objects.values_list("name", flat=True)), expected)

    def test_sync_is_repeatable_and_repairs_drift(self):
        Group.objects.get(name=MODERATOR_GROUP).permissions.set(Permission.objects.filter(codename="delete_user"))
        sync_role_groups()
        sync_role_groups()
        self.assertNotIn("delete_user", self.perms(MODERATOR_GROUP))
        self.assertEqual(Group.objects.filter(name=MODERATOR_GROUP).count(), 1)

    def test_moderator_has_no_user_or_content_edit_rights_by_itself(self):
        perms = self.perms(MODERATOR_GROUP)
        self.assertEqual(perms, {"publish_content", "view_rank", "view_role", "view_classtype"})

    def test_category_groups_can_add_and_change_but_not_delete_content(self):
        perms = self.perms(category_group_name("announcements"))
        self.assertEqual(perms, {"view_announcement", "add_announcement", "change_announcement"})

    def test_admin_manages_users_but_cannot_delete_them_or_edit_groups(self):
        perms = self.perms(ADMIN_GROUP)
        self.assertLessEqual({"add_user", "change_user", "view_user", "delete_announcement"}, perms)
        self.assertNotIn("delete_user", perms)
        self.assertNotIn("change_group", perms)
        self.assertNotIn("add_permission", perms)


class UpdateAccessTests(TestCase):
    def setUp(self):
        self.boss = make_user("boss", ADMIN_GROUP, is_staff=True)
        self.second = make_user("second", ADMIN_GROUP, is_staff=True)
        self.plain = make_user("plain")

    def group_names(self, user):
        return set(user.groups.values_list("name", flat=True))

    def test_promote_to_moderator_with_categories(self):
        services.update_user_access(
            self.boss, self.plain.pk, role=ROLE_MODERATOR, categories=["faqs", "schedules"]
        )
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_staff)
        self.assertEqual(
            self.group_names(self.plain),
            {MODERATOR_GROUP, category_group_name("faqs"), category_group_name("schedules")},
        )
        self.assertEqual(services.get_user_role(self.plain), ROLE_MODERATOR)
        self.assertEqual(set(services.get_user_categories(self.plain)), {"faqs", "schedules"})

    def test_new_permissions_apply_to_the_user(self):
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_MODERATOR, categories=["faqs"])
        user = User.objects.get(pk=self.plain.pk)
        self.assertTrue(user.has_perm("content.change_faq"))
        self.assertFalse(user.has_perm("content.change_announcement"))
        self.assertFalse(user.has_perm("content.delete_faq"))

    def test_promote_to_admin(self):
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_ADMIN)
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_staff)
        self.assertEqual(services.get_user_role(self.plain), ROLE_ADMIN)
        self.assertFalse(self.plain.is_superuser, "Admin is not superuser")

    def test_demote_to_user_removes_everything(self):
        moderator = make_user("mod", MODERATOR_GROUP, category_group_name("faqs"), is_staff=True)
        services.update_user_access(self.boss, moderator.pk, role=ROLE_USER)
        moderator.refresh_from_db()
        self.assertFalse(moderator.is_staff)
        self.assertEqual(self.group_names(moderator), set())

    def test_changing_categories_replaces_them(self):
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_MODERATOR, categories=["faqs"])
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_MODERATOR, categories=["photos"])
        self.assertEqual(services.get_user_categories(self.plain), ["photos"])

    def test_demote_another_admin_when_one_remains(self):
        services.update_user_access(self.boss, self.second.pk, role=ROLE_USER)
        self.assertEqual(services.get_user_role(self.second), ROLE_USER)

    def test_admin_may_demote_themselves_if_another_remains(self):
        services.update_user_access(self.boss, self.boss.pk, role=ROLE_USER)
        self.assertEqual(services.get_user_role(self.boss), ROLE_USER)

    def test_last_admin_cannot_be_demoted_or_deactivated(self):
        services.update_user_access(self.boss, self.second.pk, role=ROLE_USER)
        cases = [
            dict(role=ROLE_USER),
            dict(role=ROLE_MODERATOR),
            dict(role=ROLE_ADMIN, is_active=False),
            dict(role=ROLE_USER, is_active=False),
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(services.LastAdminError):
                services.update_user_access(self.boss, self.boss.pk, **case)
        self.boss.refresh_from_db()
        self.assertTrue(self.boss.is_active)
        self.assertTrue(self.boss.is_staff)
        self.assertEqual(services.get_user_role(self.boss), ROLE_ADMIN)

    def test_inactive_admin_does_not_count_as_remaining(self):
        make_user("ghost", ADMIN_GROUP, is_active=False)
        services.update_user_access(self.boss, self.second.pk, role=ROLE_USER)
        with self.assertRaises(services.LastAdminError):
            services.update_user_access(self.boss, self.boss.pk, role=ROLE_USER)

    def test_active_superuser_counts_as_remaining(self):
        make_user("root", is_superuser=True, is_staff=True)
        services.update_user_access(self.boss, self.second.pk, role=ROLE_USER)
        services.update_user_access(self.boss, self.boss.pk, role=ROLE_USER)
        self.assertEqual(services.get_user_role(self.boss), ROLE_USER)

    def test_last_admin_can_still_be_saved_as_admin(self):
        services.update_user_access(self.boss, self.second.pk, role=ROLE_USER)
        services.update_user_access(self.boss, self.boss.pk, role=ROLE_ADMIN)
        self.assertEqual(services.get_user_role(self.boss), ROLE_ADMIN)

    def test_inactive_admin_can_be_demoted_even_if_no_other_exists(self):
        ghost = make_user("ghost", ADMIN_GROUP, is_active=False)
        root = make_user("root", is_superuser=True)
        services.update_user_access(root, ghost.pk, role=ROLE_USER, is_active=False)
        self.assertEqual(services.get_user_role(ghost), ROLE_USER)

    def test_only_admins_can_change_access(self):
        moderator = make_user("mod", MODERATOR_GROUP, is_staff=True)
        for actor in (self.plain, moderator):
            with self.subTest(actor=actor.username), self.assertRaises(PermissionDenied):
                services.update_user_access(actor, actor.pk, role=ROLE_ADMIN)
        self.assertEqual(services.get_user_role(moderator), ROLE_MODERATOR)

    def test_deactivated_admin_is_refused_even_with_an_old_session(self):
        actor = User.objects.get(pk=self.boss.pk)
        User.objects.filter(pk=self.boss.pk).update(is_active=False)
        with self.assertRaises(PermissionDenied):
            services.update_user_access(actor, self.plain.pk, role=ROLE_ADMIN)

    def test_demoted_admin_is_refused_even_with_an_old_object(self):
        actor = User.objects.get(pk=self.boss.pk)
        services.update_user_access(self.second, self.boss.pk, role=ROLE_USER)
        with self.assertRaises(PermissionDenied):
            services.update_user_access(actor, self.plain.pk, role=ROLE_ADMIN)

    def test_admin_cannot_change_a_superuser(self):
        root = make_user("root", is_superuser=True, is_staff=True)
        with self.assertRaises(PermissionDenied):
            services.update_user_access(self.boss, root.pk, role=ROLE_USER)
        root.refresh_from_db()
        self.assertTrue(root.is_superuser)

    def test_superuser_can_demote_a_superuser_and_the_flag_goes(self):
        root = make_user("root", is_superuser=True, is_staff=True)
        other = make_user("other", is_superuser=True, is_staff=True)
        services.update_user_access(root, other.pk, role=ROLE_USER)
        other.refresh_from_db()
        self.assertFalse(other.is_superuser)
        self.assertFalse(other.is_staff)

    def test_saving_a_superuser_as_admin_keeps_the_flag(self):
        root = make_user("root", is_superuser=True, is_staff=True)
        services.update_user_access(root, root.pk, role=ROLE_ADMIN)
        root.refresh_from_db()
        self.assertTrue(root.is_superuser)

    def test_invalid_requests_change_nothing(self):
        cases = [
            dict(role="owner"),
            dict(role=""),
            dict(role=ROLE_MODERATOR, categories=["nonsense"]),
            dict(role=ROLE_ADMIN, categories=["faqs"]),
            dict(role=ROLE_USER, categories=["faqs"]),
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(services.RoleChangeError):
                services.update_user_access(self.boss, self.plain.pk, **case)
        self.assertEqual(self.group_names(self.plain), set())

    def test_missing_user_is_reported(self):
        with self.assertRaises(services.RoleChangeError):
            services.update_user_access(self.boss, 999999, role=ROLE_USER)

    def test_change_is_recorded_with_who_and_what(self):
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_MODERATOR, categories=["faqs"])
        entry = LogEntry.objects.get()
        self.assertEqual(entry.user, self.boss)
        self.assertEqual(entry.object_id, str(self.plain.pk))
        self.assertIn("moderator", entry.change_message)
        self.assertIn("faqs", entry.change_message)

    def test_no_change_records_nothing(self):
        services.update_user_access(self.boss, self.plain.pk, role=ROLE_USER)
        self.assertEqual(LogEntry.objects.count(), 0)

    def test_audit_failure_rolls_back_the_role_change(self):
        with mock.patch.object(LogEntry.objects, "log_actions", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.update_user_access(self.boss, self.plain.pk, role=ROLE_ADMIN)
        self.plain.refresh_from_db()
        self.assertFalse(self.plain.is_staff)
        self.assertEqual(self.group_names(self.plain), set())

    def test_failure_after_groups_are_set_rolls_them_back(self):
        with mock.patch.object(User, "save", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                services.update_user_access(self.boss, self.plain.pk, role=ROLE_ADMIN)
        self.assertEqual(self.group_names(self.plain), set())


class ConcurrentRoleChangeTests(TransactionTestCase):
    """On real connections: this is the race the lock exists for."""

    def run_threads(self, *functions):
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
            thread.join(30)
            self.assertFalse(thread.is_alive())
        return results

    def active_admins(self):
        return User.objects.filter(groups__name=ADMIN_GROUP, is_active=True).count()

    def test_two_admins_demoting_each_other_leaves_one(self):
        a = make_user("a", ADMIN_GROUP, is_staff=True)
        b = make_user("b", ADMIN_GROUP, is_staff=True)
        barrier = threading.Barrier(2, timeout=30)

        def demote(actor, target):
            def run():
                barrier.wait()
                services.update_user_access(actor, target.pk, role=ROLE_USER)
                return "demoted"

            return run

        results = self.run_threads(demote(a, b), demote(b, a))

        self.assertEqual(results.count("demoted"), 1, results)
        self.assertEqual(self.active_admins(), 1)
        loser = next(r for r in results if r != "demoted")
        self.assertIsInstance(loser, PermissionDenied)

    def test_two_admins_demoting_themselves_leaves_one(self):
        a = make_user("a", ADMIN_GROUP, is_staff=True)
        b = make_user("b", ADMIN_GROUP, is_staff=True)
        barrier = threading.Barrier(2, timeout=30)

        def demote_self(actor):
            def run():
                barrier.wait()
                services.update_user_access(actor, actor.pk, role=ROLE_USER)
                return "demoted"

            return run

        results = self.run_threads(demote_self(a), demote_self(b))

        self.assertEqual(results.count("demoted"), 1, results)
        self.assertEqual(self.active_admins(), 1)
        self.assertIsInstance(next(r for r in results if r != "demoted"), services.LastAdminError)
