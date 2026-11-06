"""The editing workflow through real HTTP requests to the admin."""
import datetime
import re
from unittest import mock

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import IntegrityError, OperationalError
from django.test import Client, TestCase
from django.urls import reverse

from accounts.roles import ADMIN_GROUP, MODERATOR_GROUP, category_group_name
from content.models import Announcement, Content, DojoPhoto, Faq, Photo, Rank, Schedule

from .helpers import make_announcement, make_author, make_class_type, make_faq, make_photo, make_schedule

User = get_user_model()


def staff(username, *groups):
    user = User.objects.create_user(username=username, password="pw-for-tests", is_staff=True)
    user.groups.set(Group.objects.filter(name__in=groups))
    return user


def change_url(obj):
    return reverse(f"admin:content_{obj._meta.model_name}_change", args=[obj.pk])


def delete_url(obj):
    return reverse(f"admin:content_{obj._meta.model_name}_delete", args=[obj.pk])


def announcement_data(version=1, **overrides):
    data = {
        "date": "2026-01-01",
        "title_en": "Edited",
        "title_vi": "Đã sửa",
        "body_en": "Body",
        "body_vi": "Nội dung",
        "is_published": "on",
        "_save": "Save",
    }
    if version is not None:
        data["expected_version"] = version
    return {**data, **overrides}


class AdminTestCase(TestCase):
    def setUp(self):
        self.author = make_author()
        self.admin_user = staff("boss", ADMIN_GROUP)
        self.client.force_login(self.admin_user)
        self.item = make_announcement(self.author)
        self.url = change_url(self.item)

    def stored(self):
        return Announcement.objects.get(pk=self.item.pk)


class EditWithVersionTests(AdminTestCase):
    def test_form_carries_the_current_version(self):
        Content.objects.filter(pk=self.item.pk).update(version=4)
        response = self.client.get(self.url)
        self.assertContains(
            response, '<input type="hidden" name="expected_version" value="4" id="id_expected_version">', html=True
        )

    def test_save_with_the_current_version_succeeds(self):
        response = self.client.post(self.url, announcement_data(), follow=True)
        self.assertContains(response, "was changed successfully")
        stored = self.stored()
        self.assertEqual(stored.title_en, "Edited")
        self.assertEqual(stored.version, 2)

    def test_stale_save_returns_409_and_writes_nothing(self):
        Announcement.objects.filter(pk=self.item.pk).update(title_en="Someone else")
        Content.objects.filter(pk=self.item.pk).update(version=2)

        response = self.client.post(self.url, announcement_data(version=1))

        self.assertEqual(response.status_code, 409)
        stored = self.stored()
        self.assertEqual(stored.title_en, "Someone else")
        self.assertEqual(stored.version, 2)

    def test_conflict_page_shows_both_versions_and_escapes_them(self):
        Announcement.objects.filter(pk=self.item.pk).update(title_en="<script>theirs()</script>")
        Content.objects.filter(pk=self.item.pk).update(version=2)

        response = self.client.post(self.url, announcement_data(version=1, title_en="<script>mine()</script>"))

        self.assertContains(response, "&lt;script&gt;theirs()&lt;/script&gt;", status_code=409)
        self.assertContains(response, "&lt;script&gt;mine()&lt;/script&gt;", status_code=409)
        self.assertNotContains(response, "<script>theirs", status_code=409)
        self.assertNotContains(response, "<script>mine", status_code=409)

    def test_conflict_is_not_logged_as_a_change(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        self.client.post(self.url, announcement_data(version=1))
        self.assertEqual(LogEntry.objects.count(), 0)

    def test_replace_with_mine_uses_the_new_version_from_the_conflict_page(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        conflict = self.client.post(self.url, announcement_data(version=1, title_en="Mine"))
        html = conflict.content.decode()

        self.assertIn('name="expected_version" value="2"', html)
        repost = dict(re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)"', html))
        repost.pop("csrfmiddlewaretoken", None)

        response = self.client.post(self.url, repost, follow=True)

        self.assertContains(response, "was changed successfully")
        stored = self.stored()
        self.assertEqual(stored.title_en, "Mine")
        self.assertEqual(stored.version, 3)

    def test_replace_with_mine_conflicts_again_if_someone_saves_first(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        self.client.post(self.url, announcement_data(version=1, title_en="Mine"))
        Content.objects.filter(pk=self.item.pk).update(version=3)

        response = self.client.post(self.url, announcement_data(version=2, title_en="Mine"))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.stored().version, 3)

    def test_missing_version_is_refused_with_a_visible_message(self):
        response = self.client.post(self.url, announcement_data(version=None))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "missing its version information")
        self.assertEqual(self.stored().title_en, "Original")
        self.assertEqual(self.stored().version, 1)

    def test_malformed_versions_are_refused(self):
        for bad in ["abc", "", "-1", "0", "1.5", "1 OR 1=1"]:
            with self.subTest(bad=bad):
                response = self.client.post(self.url, announcement_data(version=bad))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "missing its version information")
                self.assertEqual(self.stored().version, 1)

    def test_validation_error_keeps_the_original_version_and_saves_nothing(self):
        response = self.client.post(self.url, announcement_data(version=1, title_en="", title_vi=""))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="expected_version" value="1"')
        self.assertEqual(self.stored().version, 1)

    def test_conflict_is_still_caught_after_a_validation_error(self):
        self.client.post(self.url, announcement_data(version=1, title_en="", title_vi=""))
        Content.objects.filter(pk=self.item.pk).update(version=2)  # Someone saves meanwhile.
        response = self.client.post(self.url, announcement_data(version=1))
        self.assertEqual(response.status_code, 409)

    def test_cannot_set_version_or_author_by_posting_them(self):
        other = make_author("other")
        self.client.post(self.url, announcement_data(version=1, version_field=99, author=other.pk))
        stored = self.stored()
        self.assertEqual(stored.version, 2)
        self.assertEqual(stored.author, self.author)

    def test_edit_of_a_record_deleted_meanwhile_does_not_recreate_it(self):
        Content.objects.filter(pk=self.item.pk).delete()
        response = self.client.post(self.url, announcement_data())
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Content.objects.filter(pk=self.item.pk).exists())

    def test_deletion_between_load_and_save_shows_the_gone_page(self):
        def vanish(*args, **kwargs):
            from content.services import ContentGoneError

            raise ContentGoneError(self.item.pk)

        with mock.patch("content.services.save_content", side_effect=vanish):
            response = self.client.post(self.url, announcement_data())
        self.assertContains(response, "deleted by someone else", status_code=409)

    def test_edit_without_changes_still_needs_the_right_version(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        data = announcement_data(
            version=1, title_en="Original", title_vi="Original vi", body_en="Body", body_vi="Nội dung"
        )
        self.assertEqual(self.client.post(self.url, data).status_code, 409)

    def test_each_failure_kind_has_its_own_status(self):
        cases = [
            (OperationalError(1213, "deadlock"), 503, "database was busy"),
            (IntegrityError(1062, "duplicate"), 409, "clashes with other data"),
        ]
        for error, status, text in cases:
            with self.subTest(status=status), mock.patch.object(Announcement, "save", side_effect=error):
                response = self.client.post(self.url, announcement_data())
                self.assertContains(response, text, status_code=status)
                self.assertEqual(self.stored().version, 1)


class RollbackTests(AdminTestCase):
    """A request is one transaction: main row, inline rows and audit log."""

    def setUp(self):
        super().setUp()
        self.photo = make_photo(self.author)

    def photo_data(self, **overrides):
        return {
            "src_link": "https://example.invalid/changed.jpg",
            "alt_en": "Changed",
            "alt_vi": "Đã đổi",
            "is_published": "on",
            "expected_version": 1,
            "dojo_photo-TOTAL_FORMS": "1",
            "dojo_photo-INITIAL_FORMS": "0",
            "dojo_photo-MIN_NUM_FORMS": "0",
            "dojo_photo-MAX_NUM_FORMS": "1",
            "dojo_photo-0-sort_order": "5",
            "dojo_photo-0-photo": str(self.photo.pk),
            "portrait-TOTAL_FORMS": "0",
            "portrait-INITIAL_FORMS": "0",
            "portrait-MIN_NUM_FORMS": "0",
            "portrait-MAX_NUM_FORMS": "1",
            "_save": "Save",
            **overrides,
        }

    def test_inline_rows_save_in_the_same_request(self):
        response = self.client.post(change_url(self.photo), self.photo_data())
        self.assertEqual(response.status_code, 302, getattr(response, "context_data", None))
        self.assertEqual(DojoPhoto.objects.get(pk=self.photo.pk).sort_order, 5)
        self.assertEqual(Content.objects.get(pk=self.photo.pk).version, 2)

    def test_unexpected_inline_failure_rolls_back_the_main_edit_too(self):
        with mock.patch.object(DojoPhoto, "save", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.client.post(change_url(self.photo), self.photo_data())
        stored = Photo.objects.get(pk=self.photo.pk)
        self.assertEqual(stored.alt_en, "A photo")
        self.assertEqual(stored.version, 1)
        self.assertFalse(DojoPhoto.objects.exists())

    def test_inline_database_error_gives_a_page_and_rolls_back(self):
        with mock.patch.object(DojoPhoto, "save", side_effect=IntegrityError(1452, "bad key")):
            response = self.client.post(change_url(self.photo), self.photo_data())
        self.assertContains(response, "clashes with other data", status_code=409)
        stored = Photo.objects.get(pk=self.photo.pk)
        self.assertEqual(stored.alt_en, "A photo")
        self.assertEqual(stored.version, 1)

    def test_audit_log_failure_rolls_back_the_edit(self):
        with mock.patch.object(LogEntry.objects, "log_actions", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url, announcement_data())
        self.assertEqual(self.stored().title_en, "Original")
        self.assertEqual(self.stored().version, 1)

    def test_stale_inline_edit_writes_no_inline_rows(self):
        Content.objects.filter(pk=self.photo.pk).update(version=2)
        response = self.client.post(change_url(self.photo), self.photo_data())
        self.assertEqual(response.status_code, 409)
        self.assertFalse(DojoPhoto.objects.exists())

    def test_invalid_url_schemes_are_refused(self):
        for bad in ["javascript:alert(1)", "data:text/html,x", "ftp://example.invalid/a.jpg", "not a url"]:
            with self.subTest(bad=bad):
                response = self.client.post(change_url(self.photo), self.photo_data(src_link=bad))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(Photo.objects.get(pk=self.photo.pk).version, 1)


class CreateTests(AdminTestCase):
    add_url = "/admin/content/announcement/add/"

    def test_author_comes_from_the_session_and_version_starts_at_one(self):
        other = make_author("other")
        data = announcement_data(version=None, title_en="New", author=other.pk)
        data["expected_version"] = 55
        response = self.client.post(self.add_url, data)
        self.assertEqual(response.status_code, 302)
        created = Announcement.objects.get(title_en="New")
        self.assertEqual(created.author, self.admin_user)
        self.assertEqual(created.version, 1)

    def test_schedule_form_reports_end_before_start(self):
        kids = make_class_type()
        response = self.client.post(
            "/admin/content/schedule/add/",
            {"class_type": kids.pk, "day_of_wk": 0, "start_time": "20:00", "end_time": "19:00", "_save": "Save"},
        )
        self.assertContains(response, "End time must be after start time.")
        self.assertFalse(Schedule.objects.exists())
        self.assertFalse(Content.objects.exclude(pk=self.item.pk).exists())

    def test_schedule_form_reports_a_duplicate_slot(self):
        kids = make_class_type()
        make_schedule(self.author, kids, day=0, start="19:00")
        response = self.client.post(
            "/admin/content/schedule/add/",
            {"class_type": kids.pk, "day_of_wk": 0, "start_time": "19:00", "end_time": "21:00", "_save": "Save"},
        )
        self.assertContains(response, "already has a slot")
        self.assertEqual(Schedule.objects.count(), 1)

    def test_invalid_day_is_refused(self):
        kids = make_class_type()
        response = self.client.post(
            "/admin/content/schedule/add/",
            {"class_type": kids.pk, "day_of_wk": 7, "start_time": "19:00", "end_time": "20:00", "_save": "Save"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Schedule.objects.exists())

    def test_too_long_text_is_a_form_error_not_a_crash(self):
        data = announcement_data(version=None, title_en="x" * 201)
        response = self.client.post(self.add_url, data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "at most 200 characters")


class DeleteTests(AdminTestCase):
    def test_confirmation_page_carries_the_version(self):
        Content.objects.filter(pk=self.item.pk).update(version=3)
        response = self.client.get(delete_url(self.item))
        self.assertContains(response, '<input type="hidden" name="expected_version" value="3">', html=True)

    def test_delete_with_the_current_version_removes_both_rows(self):
        response = self.client.post(delete_url(self.item), {"post": "yes", "expected_version": 1})
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Content.objects.filter(pk=self.item.pk).exists())

    def test_stale_delete_returns_409_keeps_the_record_and_logs_nothing(self):
        Content.objects.filter(pk=self.item.pk).update(version=2)
        response = self.client.post(delete_url(self.item), {"post": "yes", "expected_version": 1})
        self.assertContains(response, "was not deleted", status_code=409)
        self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())
        self.assertEqual(LogEntry.objects.count(), 0, "The log entry must roll back with the delete")

    def test_delete_without_a_version_is_refused(self):
        for data in [{"post": "yes"}, {"post": "yes", "expected_version": "abc"}]:
            with self.subTest(data=data):
                response = self.client.post(delete_url(self.item), data)
                self.assertEqual(response.status_code, 400)
                self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())

    def test_bulk_delete_is_not_offered_for_any_model(self):
        response = self.client.get("/admin/content/announcement/")
        self.assertNotContains(response, "delete_selected")
        response = self.client.post(
            "/admin/content/announcement/",
            {"action": "delete_selected", "_selected_action": [self.item.pk], "post": "yes"},
        )
        self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())

    def test_deleting_a_class_type_removes_its_slots_everywhere(self):
        kids = make_class_type()
        slot = make_schedule(self.author, kids)
        response = self.client.post(f"/admin/content/classtype/{kids.pk}/delete/", {"post": "yes"})
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Schedule.objects.filter(pk=slot.pk).exists())
        self.assertFalse(Content.objects.filter(pk=slot.pk).exists())

    def test_rank_in_use_cannot_be_deleted(self):
        from content.models import Instructor

        rank = Rank.objects.create(dan_level=1, rank_en="Shodan", rank_vi="Nhất Đẳng")
        Instructor.objects.create(author=self.author, name="A", rank=rank)
        response = self.client.post(f"/admin/content/rank/{rank.pk}/delete/", {"post": "yes"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Rank.objects.filter(pk=rank.pk).exists())


class BulkPublishTests(AdminTestCase):
    def run_action(self, action, *items):
        return self.client.post(
            "/admin/content/announcement/",
            {"action": action, "_selected_action": [item.pk for item in items]},
            follow=True,
        )

    def test_publish_and_unpublish_bump_versions(self):
        draft = make_announcement(self.author, is_published=False)
        self.assertContains(self.run_action("publish_selected", draft), "1 item(s) published")
        stored = Content.objects.get(pk=draft.pk)
        self.assertTrue(stored.is_published)
        self.assertEqual(stored.version, 2)

        self.assertContains(self.run_action("unpublish_selected", draft), "1 item(s) unpublished")
        self.assertFalse(Content.objects.get(pk=draft.pk).is_published)

    def test_user_who_can_only_view_cannot_run_it(self):
        viewer = staff("viewer")
        from django.contrib.auth.models import Permission

        viewer.user_permissions.set(
            Permission.objects.filter(codename__in=["view_announcement", "publish_content"])
        )
        self.client.force_login(viewer)
        draft = make_announcement(self.author, is_published=False)
        self.run_action("publish_selected", draft)
        self.assertFalse(Content.objects.get(pk=draft.pk).is_published)


class PermissionTests(TestCase):
    def setUp(self):
        self.author = make_author()
        self.item = make_announcement(self.author)
        self.faq = make_faq(self.author)
        self.url = change_url(self.item)
        self.moderator = staff("mod", MODERATOR_GROUP, category_group_name("announcements"))

    def login_as(self, user):
        self.client.force_login(user)

    def test_anonymous_is_sent_to_login_and_cannot_save(self):
        self.assertIn("/admin/login/", self.client.get(self.url)["Location"])
        response = self.client.post(self.url, announcement_data())
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])
        self.assertEqual(Announcement.objects.get(pk=self.item.pk).version, 1)

    def test_user_with_no_role_cannot_enter(self):
        self.login_as(User.objects.create_user("plain", password="pw-for-tests"))
        response = self.client.post(self.url, announcement_data())
        self.assertIn("/admin/login/", response["Location"])
        self.assertEqual(Announcement.objects.get(pk=self.item.pk).version, 1)

    def test_moderator_edits_within_their_category(self):
        self.login_as(self.moderator)
        response = self.client.post(self.url, announcement_data())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Announcement.objects.get(pk=self.item.pk).title_en, "Edited")

    def test_moderator_version_check_applies_too(self):
        self.login_as(self.moderator)
        Content.objects.filter(pk=self.item.pk).update(version=2)
        self.assertEqual(self.client.post(self.url, announcement_data()).status_code, 409)

    def test_moderator_is_refused_outside_their_category_even_by_direct_post(self):
        self.login_as(self.moderator)
        url = change_url(self.faq)
        self.assertEqual(self.client.get(url).status_code, 403)
        response = self.client.post(url, {"question_en": "Hacked", "expected_version": 1})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Faq.objects.get(pk=self.faq.pk).version, 1)

    def test_moderator_with_no_categories_can_edit_nothing(self):
        self.login_as(staff("nocat", MODERATOR_GROUP))
        self.assertEqual(self.client.post(self.url, announcement_data()).status_code, 403)

    def test_moderator_cannot_delete_content(self):
        self.login_as(self.moderator)
        response = self.client.post(delete_url(self.item), {"post": "yes", "expected_version": 1})
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Announcement.objects.filter(pk=self.item.pk).exists())

    def test_moderator_cannot_change_lookup_tables(self):
        self.login_as(self.moderator)
        response = self.client.post("/admin/content/rank/add/", {"dan_level": 9, "rank_en": "x", "rank_vi": "x"})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Rank.objects.exists())

    def test_moderator_cannot_reach_user_management(self):
        self.login_as(self.moderator)
        self.assertEqual(self.client.get("/admin/auth/user/").status_code, 403)
        target = f"/admin/auth/user/{self.moderator.pk}/change/"
        self.assertEqual(self.client.post(target, {"is_superuser": "on", "role": "admin"}).status_code, 403)
        self.moderator.refresh_from_db()
        self.assertFalse(self.moderator.is_superuser)

    def test_without_publish_permission_posting_is_published_has_no_effect(self):
        editor = staff("editor", category_group_name("announcements"))  # No Moderator group.
        self.login_as(editor)
        draft = make_announcement(self.author, is_published=False)
        self.client.post(change_url(draft), announcement_data(is_published="on"))
        stored = Announcement.objects.get(pk=draft.pk)
        self.assertEqual(stored.title_en, "Edited")
        self.assertFalse(stored.is_published)

    def test_csrf_is_enforced(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(staff("csrf", ADMIN_GROUP))
        response = client.post(self.url, announcement_data())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Announcement.objects.get(pk=self.item.pk).version, 1)
