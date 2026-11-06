"""User management and sign-in through real HTTP requests."""
import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.test import RequestFactory, TestCase, override_settings

from accounts import ratelimit, services
from accounts.roles import ADMIN_GROUP, MODERATOR_GROUP, ROLE_ADMIN, ROLE_USER
from config.settings import env_list, env_required

User = get_user_model()


def make_user(username, *groups, **fields):
    user = User.objects.create_user(username=username, password="pw-for-tests", **fields)
    user.groups.set(Group.objects.filter(name__in=groups))
    return user


def user_form(user, **overrides):
    return {
        "username": user.username,
        "first_name": "",
        "last_name": "",
        "email": "",
        "is_active": "on",
        "role": services.get_user_role(user),
        "last_login_0": "",
        "last_login_1": "",
        "_save": "Save",
        **overrides,
    }


class UserAdminTests(TestCase):
    def setUp(self):
        self.boss = make_user("boss", ADMIN_GROUP, is_staff=True)
        self.client.force_login(self.boss)
        self.plain = make_user("plain")

    def url(self, user):
        return f"/admin/auth/user/{user.pk}/change/"

    def test_admin_assigns_a_role_and_categories(self):
        response = self.client.post(
            self.url(self.plain), user_form(self.plain, role="moderator", categories=["faqs"])
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(services.get_user_role(self.plain), "moderator")
        self.assertEqual(services.get_user_categories(self.plain), ["faqs"])

    def test_categories_are_dropped_for_other_roles(self):
        self.client.post(self.url(self.plain), user_form(self.plain, role="admin", categories=["faqs"]))
        self.assertEqual(services.get_user_role(self.plain), ROLE_ADMIN)
        self.assertEqual(services.get_user_categories(self.plain), [])

    def test_form_shows_the_current_role(self):
        response = self.client.get(self.url(self.boss))
        self.assertContains(response, '<option value="admin" selected>Admin</option>', html=True)

    def test_raw_permission_fields_are_ignored(self):
        self.client.post(
            self.url(self.plain),
            user_form(self.plain, is_superuser="on", is_staff="on", groups=[Group.objects.get(name=ADMIN_GROUP).pk]),
        )
        self.plain.refresh_from_db()
        self.assertFalse(self.plain.is_superuser)
        self.assertFalse(self.plain.is_staff)
        self.assertEqual(services.get_user_role(self.plain), ROLE_USER)

    def test_last_admin_demotion_shows_an_error_and_saves_nothing(self):
        response = self.client.post(
            self.url(self.boss), user_form(self.boss, role="user", first_name="Changed"), follow=True
        )
        self.assertContains(response, "last active administrator")
        self.boss.refresh_from_db()
        self.assertEqual(self.boss.first_name, "", "The other fields on the form must roll back too")
        self.assertEqual(services.get_user_role(self.boss), ROLE_ADMIN)

    def test_last_admin_cannot_be_deactivated(self):
        data = user_form(self.boss)
        del data["is_active"]
        response = self.client.post(self.url(self.boss), data, follow=True)
        self.assertContains(response, "last active administrator")
        self.boss.refresh_from_db()
        self.assertTrue(self.boss.is_active)

    def test_deactivating_someone_else_ends_their_access(self):
        moderator = make_user("mod", MODERATOR_GROUP, is_staff=True)
        moderator_client = self.client_class()
        moderator_client.force_login(moderator)
        self.assertEqual(moderator_client.get("/admin/").status_code, 200)

        data = user_form(moderator)
        del data["is_active"]
        self.client.post(self.url(moderator), data)

        moderator.refresh_from_db()
        self.assertFalse(moderator.is_active)
        self.assertEqual(moderator_client.get("/admin/").status_code, 302, "Existing session must stop working")

    def test_demoted_moderator_loses_access_immediately(self):
        moderator = make_user("mod", MODERATOR_GROUP, is_staff=True)
        moderator_client = self.client_class()
        moderator_client.force_login(moderator)
        self.client.post(self.url(moderator), user_form(moderator, role="user"))
        self.assertEqual(moderator_client.get("/admin/").status_code, 302)

    def test_admin_cannot_edit_or_reset_the_password_of_a_superuser(self):
        root = make_user("root", is_superuser=True, is_staff=True)
        self.assertEqual(self.client.post(self.url(root), user_form(root, role="user")).status_code, 403)
        response = self.client.post(
            f"/admin/auth/user/{root.pk}/password/",
            {"password1": "Xq7!newpass9", "password2": "Xq7!newpass9"},
        )
        self.assertEqual(response.status_code, 403)
        root.refresh_from_db()
        self.assertTrue(root.check_password("pw-for-tests"))
        self.assertTrue(root.is_superuser)

    def test_users_cannot_be_deleted(self):
        response = self.client.post(f"/admin/auth/user/{self.plain.pk}/delete/", {"post": "yes"})
        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.plain.pk).exists())

    def test_groups_cannot_be_managed_in_the_admin(self):
        self.assertEqual(self.client.get("/admin/auth/group/").status_code, 404)

    def test_new_user_starts_with_no_access(self):
        response = self.client.post(
            "/admin/auth/user/add/",
            {
                "username": "newbie",
                "usable_password": "true",
                "password1": "Xq7!newpass9",
                "password2": "Xq7!newpass9",
                "is_superuser": "on",
                "is_staff": "on",
                "_save": "Save",
            },
        )
        self.assertEqual(response.status_code, 302)
        created = User.objects.get(username="newbie")
        self.assertFalse(created.is_staff)
        self.assertFalse(created.is_superuser)
        self.assertEqual(services.get_user_role(created), ROLE_USER)

    def test_weak_password_is_refused(self):
        response = self.client.post(
            "/admin/auth/user/add/",
            {"username": "weak", "usable_password": "true", "password1": "123", "password2": "123", "_save": "Save"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username="weak").exists())


class LoginTests(TestCase):
    login_url = "/admin/login/"

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.staff_user = make_user("staffer", ADMIN_GROUP, is_staff=True)

    def attempt(self, password="wrong", username="staffer", **extra):
        return self.client.post(self.login_url, {"username": username, "password": password}, **extra)

    def is_logged_in(self):
        return "_auth_user_id" in self.client.session

    def test_correct_password_signs_in(self):
        self.assertEqual(self.attempt("pw-for-tests").status_code, 302)
        self.assertTrue(self.is_logged_in())

    def test_logout_works(self):
        self.client.force_login(self.staff_user)
        self.client.post("/admin/logout/")
        self.assertFalse(self.is_logged_in())

    def test_logout_needs_post_so_a_link_cannot_sign_someone_out(self):
        self.client.force_login(self.staff_user)
        self.assertEqual(self.client.get("/admin/logout/").status_code, 405)
        self.assertTrue(self.is_logged_in())

    def test_wrong_password_does_not_sign_in(self):
        self.assertEqual(self.attempt().status_code, 200)
        self.assertFalse(self.is_logged_in())

    def test_non_staff_cannot_sign_in_to_the_admin(self):
        make_user("plain")
        self.attempt("pw-for-tests", username="plain")
        self.assertFalse(self.is_logged_in())

    def test_inactive_user_cannot_sign_in(self):
        make_user("gone", ADMIN_GROUP, is_staff=True, is_active=False)
        self.attempt("pw-for-tests", username="gone")
        self.assertFalse(self.is_logged_in())

    def test_blocked_after_too_many_failures_even_with_the_right_password(self):
        for _ in range(5):
            self.assertEqual(self.attempt().status_code, 200)
        self.assertEqual(self.attempt().status_code, 429)
        self.assertEqual(self.attempt("pw-for-tests").status_code, 429)
        self.assertFalse(self.is_logged_in())

    def test_username_case_cannot_be_used_to_get_more_guesses(self):
        for name in ["staffer", "STAFFER", "StAfFeR", " staffer ", "staffeR"]:
            self.attempt(username=name)
        self.assertEqual(self.attempt().status_code, 429)

    def test_attacker_elsewhere_does_not_lock_out_the_real_user(self):
        for _ in range(6):
            self.attempt(REMOTE_ADDR="203.0.113.9")
        self.assertEqual(self.attempt("pw-for-tests", REMOTE_ADDR="198.51.100.7").status_code, 302)

    def test_trying_many_accounts_from_one_address_is_blocked(self):
        for number in range(20):
            self.attempt(username=f"guess{number}", REMOTE_ADDR="203.0.113.9")
        self.assertEqual(self.attempt(username="another", REMOTE_ADDR="203.0.113.9").status_code, 429)

    @override_settings(CLIENT_IP_HEADER="HTTP_X_REAL_IP")
    def test_behind_a_proxy_visitors_do_not_share_a_limit(self):
        for number in range(20):
            self.attempt(username=f"guess{number}", HTTP_X_REAL_IP="203.0.113.9", REMOTE_ADDR="127.0.0.1")
        blocked = self.attempt(username="another", HTTP_X_REAL_IP="203.0.113.9", REMOTE_ADDR="127.0.0.1")
        self.assertEqual(blocked.status_code, 429)
        other_visitor = self.attempt("pw-for-tests", HTTP_X_REAL_IP="198.51.100.7", REMOTE_ADDR="127.0.0.1")
        self.assertEqual(other_visitor.status_code, 302)

    @override_settings(CLIENT_IP_HEADER="")
    def test_without_a_proxy_a_faked_header_does_not_dodge_the_limit(self):
        for number in range(20):
            self.attempt(username=f"guess{number}", HTTP_X_REAL_IP=f"203.0.113.{number}", REMOTE_ADDR="192.0.2.1")
        blocked = self.attempt(username="another", HTTP_X_REAL_IP="198.51.100.7", REMOTE_ADDR="192.0.2.1")
        self.assertEqual(blocked.status_code, 429)

    @override_settings(CLIENT_IP_HEADER="HTTP_X_REAL_IP")
    def test_client_address_falls_back_when_the_header_is_missing_or_blank(self):
        factory = RequestFactory()
        self.assertEqual(ratelimit.client_ip(factory.get("/", REMOTE_ADDR="192.0.2.1")), "192.0.2.1")
        blank = factory.get("/", REMOTE_ADDR="192.0.2.1", HTTP_X_REAL_IP="  ")
        self.assertEqual(ratelimit.client_ip(blank), "192.0.2.1")

    def test_success_clears_the_account_count(self):
        for _ in range(4):
            self.attempt()
        self.attempt("pw-for-tests")
        self.client.post("/admin/logout/")
        for _ in range(4):
            self.assertEqual(self.attempt().status_code, 200)

    def test_viewing_the_login_page_does_not_count(self):
        for _ in range(10):
            self.assertEqual(self.client.get(self.login_url).status_code, 200)

    @override_settings(LOGIN_RATE_LIMIT_PER_ACCOUNT=(1, 60))
    def test_limits_come_from_settings(self):
        self.attempt()
        self.assertEqual(self.attempt().status_code, 429)

    def test_counter_survives_expiry_between_add_and_incr(self):
        with mock.patch("accounts.ratelimit.cache.incr", side_effect=ValueError):
            ratelimit.record_attempt("test", "value", 60)
        self.assertTrue(ratelimit.is_blocked("test", "value", 1))

    def test_public_registration_does_not_exist(self):
        for path in ["/register/", "/signup/", "/accounts/signup/"]:
            self.assertEqual(self.client.get(path).status_code, 404, path)


class PasswordResetTests(TestCase):
    url = "/admin/password_reset/"

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = make_user("staffer", ADMIN_GROUP, is_staff=True, email="staff@example.invalid")

    def test_login_page_links_to_it(self):
        self.assertContains(self.client.get("/admin/login/"), self.url)

    def test_known_address_gets_an_email_with_a_working_link(self):
        response = self.client.post(self.url, {"email": "staff@example.invalid"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)
        link = next(word for word in mail.outbox[0].body.split() if "/reset/" in word)

        path = link.split("testserver", 1)[1]
        page = self.client.get(path, follow=True)
        self.assertEqual(page.status_code, 200)
        done = self.client.post(
            page.redirect_chain[-1][0], {"new_password1": "Xq7!newpass9", "new_password2": "Xq7!newpass9"}
        )
        self.assertEqual(done.status_code, 302)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Xq7!newpass9"))

    def test_unknown_address_gets_the_same_response_and_no_email(self):
        known = self.client.post(self.url, {"email": "staff@example.invalid"})
        unknown = self.client.post(self.url, {"email": "nobody@example.invalid"})
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known["Location"], unknown["Location"])
        self.assertEqual(len(mail.outbox), 1)

    def test_sending_is_rate_limited(self):
        for _ in range(5):
            self.assertEqual(self.client.post(self.url, {"email": "staff@example.invalid"}).status_code, 302)
        self.assertEqual(self.client.post(self.url, {"email": "staff@example.invalid"}).status_code, 429)
        self.assertEqual(len(mail.outbox), 5)
        self.assertEqual(self.client.get(self.url).status_code, 200, "Viewing stays open")


class SettingsHelperTests(TestCase):
    def test_required_setting_fails_clearly_when_missing_or_empty(self):
        with mock.patch.dict(os.environ, {"DOJO_TEST_VALUE": ""}):
            with self.assertRaisesMessage(ImproperlyConfigured, "DOJO_TEST_VALUE"):
                env_required("DOJO_TEST_VALUE")
        with self.assertRaises(ImproperlyConfigured):
            env_required("DOJO_TEST_DEFINITELY_UNSET")

    def test_list_setting_ignores_blanks(self):
        with mock.patch.dict(os.environ, {"DOJO_TEST_LIST": " a, b ,,"}):
            self.assertEqual(env_list("DOJO_TEST_LIST"), ["a", "b"])
        self.assertEqual(env_list("DOJO_TEST_DEFINITELY_UNSET"), [])
