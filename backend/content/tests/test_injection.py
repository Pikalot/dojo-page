"""SQL injection safeguards.

The public API takes no input, and the ORM sends values as parameters. These
tests attack the real endpoints on real MySQL, and fail if new code starts
building SQL by hand.
"""
import re
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import connection
from django.test import TestCase

from accounts.roles import ADMIN_GROUP
from content import services
from content.models import Announcement

from .helpers import make_announcement, make_author

ATTACKS = [
    "' OR 1=1 -- ",
    "' OR '1'='1",
    '" OR "1"="1',
    "'; DROP TABLE Contents; -- ",
    "%' OR '1'='1",
    "' UNION SELECT password FROM auth_user -- ",
    "\\'; DROP TABLE Contents; -- ",
]
ENDPOINTS = ["announcements", "schedule", "instructors", "faq", "dojo-photos"]
APP_DIRS = ["content", "accounts", "config"]
# Ways to send your own SQL. Each needs its own review, so none are allowed here.
RAW_SQL = re.compile(r"\.raw\(|\.extra\(|\bRawSQL\b|\.cursor\(")


class InjectionTestCase(TestCase):
    def setUp(self):
        self.author = make_author()
        self.published = make_announcement(self.author, title="Published")
        self.draft = make_announcement(self.author, title="Secret draft", is_published=False)

    def assert_nothing_was_damaged(self):
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = {row[0].lower() for row in cursor.fetchall()}
        self.assertLessEqual({"contents", "announcements", "auth_user"}, tables)
        self.assertEqual(Announcement.objects.count(), 2)


class PublicApiTests(InjectionTestCase):
    def test_query_strings_change_nothing(self):
        for endpoint in ENDPOINTS:
            expected = self.client.get(f"/api/{endpoint}").content
            for attack in ATTACKS:
                for name in ["q", "id", "search", "is_published", "order_by"]:
                    with self.subTest(endpoint=endpoint, attack=attack, name=name):
                        response = self.client.get(f"/api/{endpoint}", {name: attack})
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response.content, expected)
        self.assert_nothing_was_damaged()

    def test_a_visitor_cannot_ask_for_unpublished_content(self):
        for params in [{"is_published": "false"}, {"is_published": "0"}, {"draft": "1"}, {"all": "true"}]:
            with self.subTest(params=params):
                response = self.client.get("/api/announcements", params)
                self.assertNotContains(response, "Secret draft")

    def test_attacks_in_the_path_are_not_found(self):
        for attack in ["1' OR '1'='1", "1;DROP TABLE Contents"]:
            with self.subTest(attack=attack):
                self.assertEqual(self.client.get(f"/api/announcements/{attack}").status_code, 404)
        self.assert_nothing_was_damaged()


class AdminSearchTests(InjectionTestCase):
    """The admin's search box is the one search that does reach the database."""

    def setUp(self):
        super().setUp()
        boss = get_user_model().objects.create_user("boss", password="pw-for-tests", is_staff=True)
        boss.groups.set(Group.objects.filter(name=ADMIN_GROUP))
        self.client.force_login(boss)

    def test_attacks_match_nothing_and_damage_nothing(self):
        for attack in ATTACKS:
            with self.subTest(attack=attack):
                response = self.client.get("/admin/content/announcement/", {"q": attack})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context["cl"].result_count, 0)
        self.assert_nothing_was_damaged()

    def test_normal_search_still_works(self):
        response = self.client.get("/admin/content/announcement/", {"q": "Published"})
        self.assertEqual(response.context["cl"].result_count, 1)

    def test_url_filters_cannot_be_used_to_guess_passwords(self):
        response = self.client.get("/admin/content/announcement/", {"author__password__startswith": "pbkdf2"})
        self.assertEqual(response.status_code, 400)


class StoredTextTests(InjectionTestCase):
    def test_attack_text_is_stored_and_returned_as_plain_text(self):
        for attack in ATTACKS:
            with self.subTest(attack=attack):
                item = Announcement.objects.get(pk=self.published.pk)
                item.title_en = attack
                services.save_content(item, item.version)
                self.assertEqual(Announcement.objects.get(pk=item.pk).title_en, attack)
        self.assert_nothing_was_damaged()
        self.assertEqual(Announcement.objects.get(pk=self.draft.pk).title_en, "Secret draft")


class SourceCodeTests(TestCase):
    def test_application_code_never_builds_its_own_sql(self):
        """Migrations and tests are excluded: they run fixed statements, never visitor input."""
        found = []
        for app in APP_DIRS:
            for path in (Path(settings.BASE_DIR) / app).rglob("*.py"):
                if {"migrations", "tests"} & set(path.parts):
                    continue
                for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                    if RAW_SQL.search(line):
                        found.append(f"{path.name}:{number}: {line.strip()}")
        self.assertEqual(found, [], "Use the ORM. If raw SQL is truly needed, send values as parameters.")
