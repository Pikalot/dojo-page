"""The public API: only published content, in the frontend's expected shape."""
import json
from pathlib import Path

from django.conf import settings
from django.test import TestCase

from content.models import DojoPhoto, Instructor, Portrait

from .helpers import (
    make_announcement,
    make_author,
    make_class_type,
    make_faq,
    make_photo,
    make_rank,
    make_role,
    make_schedule,
)

MOCK_DIR = Path(settings.BASE_DIR).parent / "frontend" / "src" / "data" / "mock"
ENDPOINTS = ["announcements", "schedule", "instructors", "faq", "dojo-photos"]


def mock_data(name):
    return json.loads((MOCK_DIR / f"{name}.json").read_text(encoding="utf-8"))


class ApiTestCase(TestCase):
    def setUp(self):
        self.author = make_author()
        self.shodan = make_rank(1, "Shodan")
        self.godan = make_rank(5, "Godan")
        self.head = make_role(1, "Head of Dojo")
        self.instructor_role = make_role(2, "Instructor")

    def get(self, endpoint):
        response = self.client.get(f"/api/{endpoint}")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def person(self, name, rank, role=None, is_published=True, **extra):
        return Instructor.objects.create(
            author=self.author, name=name, rank=rank, role=role, is_published=is_published, **extra
        )


class GeneralTests(ApiTestCase):
    def test_empty_database_gives_empty_results(self):
        for endpoint in ["announcements", "schedule", "faq", "dojo-photos"]:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.get(endpoint), [])
        self.assertEqual(self.get("instructors"), {"instructors": [], "blackBelts": []})

    def test_write_methods_are_refused(self):
        for endpoint in ENDPOINTS:
            for method in ["post", "put", "patch", "delete"]:
                with self.subTest(endpoint=endpoint, method=method):
                    response = getattr(self.client, method)(f"/api/{endpoint}")
                    self.assertEqual(response.status_code, 405)

    def test_no_authentication_needed(self):
        for endpoint in ENDPOINTS:
            self.assertEqual(self.client.get(f"/api/{endpoint}").status_code, 200)

    def test_nothing_internal_is_exposed(self):
        make_announcement(self.author)
        make_faq(self.author)
        make_schedule(self.author, make_class_type())
        self.person("A", self.godan, self.head)
        photo = make_photo(self.author)
        DojoPhoto.objects.create(photo=photo)
        forbidden = ["author", "version", "is_published", "created_at", "updated_at", self.author.username]
        for endpoint in ENDPOINTS:
            body = self.client.get(f"/api/{endpoint}").content.decode()
            for word in forbidden:
                with self.subTest(endpoint=endpoint, word=word):
                    self.assertNotIn(word, body)


class AnnouncementTests(ApiTestCase):
    def test_shape_matches_the_frontend(self):
        make_announcement(self.author)
        self.assertEqual(set(self.get("announcements")[0]), set(mock_data("announcements")[0]))

    def test_unpublished_is_hidden(self):
        make_announcement(self.author, title="Draft", is_published=False)
        self.assertEqual(self.get("announcements"), [])

    def test_newest_first(self):
        import datetime

        make_announcement(self.author, title="Old", date=datetime.date(2026, 1, 1))
        make_announcement(self.author, title="New", date=datetime.date(2026, 6, 1))
        self.assertEqual([a["title"]["en"] for a in self.get("announcements")], ["New", "Old"])

    def test_translated_fields_are_pairs(self):
        make_announcement(self.author, title="Test")
        self.assertEqual(self.get("announcements")[0]["title"], {"en": "Test", "vi": "Test vi"})


class ScheduleTests(ApiTestCase):
    def test_shape_matches_the_frontend(self):
        make_schedule(self.author, make_class_type())
        self.assertEqual(set(self.get("schedule")[0]), set(mock_data("schedule")[0]))

    def test_day_number_becomes_names_and_times_are_hh_mm(self):
        make_schedule(self.author, make_class_type(), day=6, start="08:00", end="09:30")
        slot = self.get("schedule")[0]
        self.assertEqual(slot["day"], {"en": "Sunday", "vi": "Chủ Nhật"})
        self.assertEqual((slot["start"], slot["end"]), ("08:00", "09:30"))
        self.assertEqual(slot["className"], {"en": "Kids", "vi": "Kids vi"})

    def test_all_seven_days_have_names_that_match_the_mock_data(self):
        kids = make_class_type()
        for day in range(7):
            make_schedule(self.author, kids, day=day)
        self.assertEqual([s["day"] for s in self.get("schedule")], [s["day"] for s in mock_data("schedule")])

    def test_ordered_by_day_then_time(self):
        kids = make_class_type()
        make_schedule(self.author, kids, day=1, start="08:00", end="09:00")
        make_schedule(self.author, kids, day=0, start="19:00", end="20:00")
        make_schedule(self.author, kids, day=0, start="08:00", end="09:00")
        order = [(s["day"]["en"], s["start"]) for s in self.get("schedule")]
        self.assertEqual(order, [("Monday", "08:00"), ("Monday", "19:00"), ("Tuesday", "08:00")])

    def test_unpublished_is_hidden(self):
        make_schedule(self.author, make_class_type(), is_published=False)
        self.assertEqual(self.get("schedule"), [])


class InstructorTests(ApiTestCase):
    def test_shape_matches_the_frontend(self):
        self.person("Card", self.godan, self.head)
        self.person("Listed", self.shodan)
        data, mock = self.get("instructors"), mock_data("instructors")
        self.assertEqual(set(data), set(mock))
        self.assertEqual(set(data["instructors"][0]) - {"photo"}, set(mock["instructors"][0]))
        self.assertEqual(set(data["blackBelts"][0]), set(mock["blackBelts"][0]))
        self.assertEqual(set(data["blackBelts"][0]["members"][0]), set(mock["blackBelts"][0]["members"][0]))

    def test_role_decides_card_or_list(self):
        self.person("Card", self.godan, self.head)
        self.person("Listed", self.godan)
        data = self.get("instructors")
        self.assertEqual([p["name"] for p in data["instructors"]], ["Card"])
        self.assertEqual([m["name"] for m in data["blackBelts"][0]["members"]], ["Listed"])

    def test_cards_ordered_by_rank_then_seniority_then_name(self):
        self.person("Low rank", self.shodan, self.head)
        self.person("Zed", self.godan, self.instructor_role)
        self.person("Bea", self.godan, self.head)
        self.person("Abe", self.godan, self.head)
        names = [p["name"] for p in self.get("instructors")["instructors"]]
        self.assertEqual(names, ["Abe", "Bea", "Zed", "Low rank"])

    def test_black_belts_grouped_by_rank_highest_first_with_each_rank_once(self):
        self.person("B", self.shodan)
        self.person("A", self.shodan)
        self.person("C", self.godan)
        groups = self.get("instructors")["blackBelts"]
        self.assertEqual([g["rank"]["en"] for g in groups], ["Godan", "Shodan"])
        self.assertEqual([m["name"] for m in groups[1]["members"]], ["A", "B"])

    def test_unpublished_is_hidden_from_both_lists(self):
        self.person("Card", self.godan, self.head, is_published=False)
        self.person("Listed", self.godan, is_published=False)
        self.assertEqual(self.get("instructors"), {"instructors": [], "blackBelts": []})

    def test_empty_bio_is_empty_text(self):
        self.person("Card", self.godan, self.head)
        self.assertEqual(self.get("instructors")["instructors"][0]["bio"], {"en": "", "vi": ""})

    def test_published_portrait_is_shown_and_unpublished_is_not(self):
        person = self.person("Card", self.godan, self.head)
        self.assertIsNone(self.get("instructors")["instructors"][0]["photo"])

        photo = make_photo(self.author, is_published=False)
        Portrait.objects.create(photo=photo, instructor=person)
        self.assertIsNone(self.get("instructors")["instructors"][0]["photo"])

        photo.is_published = True
        photo.save()
        self.assertEqual(self.get("instructors")["instructors"][0]["photo"], photo.src_link)

    def test_query_count_does_not_grow_with_instructors(self):
        for number in range(5):
            self.person(f"P{number}", self.godan, self.head)
        with self.assertNumQueries(1):
            self.client.get("/api/instructors")


class FaqTests(ApiTestCase):
    def test_shape_and_order(self):
        make_faq(self.author, "First?")
        make_faq(self.author, "Second?")
        data = self.get("faq")
        self.assertEqual(set(data[0]), set(mock_data("faq")[0]))
        self.assertEqual([q["question"]["en"] for q in data], ["First?", "Second?"])

    def test_unpublished_is_hidden(self):
        make_faq(self.author, is_published=False)
        self.assertEqual(self.get("faq"), [])


class DojoPhotoTests(ApiTestCase):
    def test_shape_matches_the_frontend(self):
        DojoPhoto.objects.create(photo=make_photo(self.author))
        self.assertEqual(set(self.get("dojo-photos")[0]), set(mock_data("dojoPhotos")[0]))

    def test_ordered_by_sort_order_then_id(self):
        for alt, order in [("Third", 2), ("First", 1), ("Fourth", 2)]:
            DojoPhoto.objects.create(photo=make_photo(self.author, alt=alt), sort_order=order)
        self.assertEqual([p["alt"]["en"] for p in self.get("dojo-photos")], ["First", "Third", "Fourth"])

    def test_unpublished_is_hidden(self):
        DojoPhoto.objects.create(photo=make_photo(self.author, is_published=False))
        self.assertEqual(self.get("dojo-photos"), [])

    def test_photo_that_is_only_a_portrait_is_not_in_the_carousel(self):
        make_photo(self.author)
        self.assertEqual(self.get("dojo-photos"), [])
