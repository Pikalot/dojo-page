"""Automatic translation: the Azure call, the staff endpoint, and optional languages."""
import io
import json
import ssl
import urllib.error
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from accounts.roles import ADMIN_GROUP, MODERATOR_GROUP
from content import services, translation
from content.models import Announcement, ClassType, Faq, Photo, Role

from .helpers import make_announcement, make_author

URL = "/admin/translate/"
OPEN = "content.translation.urllib.request.urlopen"


def azure_replies(transform=lambda text: f"[vi] {text}"):
    """A stand-in for Azure: answers each line sent, and records the requests."""
    sent = []

    def fake(request, timeout=None, context=None):
        body = json.loads(request.data)
        sent.append(
            {
                "url": request.full_url,
                "headers": dict(request.header_items()),
                "body": body,
                "timeout": timeout,
                "context": context,
            }
        )
        reply = [{"translations": [{"text": transform(item["text"]), "to": "vi"}]} for item in body]
        return io.BytesIO(json.dumps(reply).encode())

    return fake, sent


def http_error(code):
    return urllib.error.HTTPError("https://azure.invalid", code, "error", {}, io.BytesIO(b"{}"))


class TranslationTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)


class TranslateFunctionTests(TranslationTestCase):
    def test_request_matches_azure_format(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            result = translation.translate("Hello", "en", "vi")
        self.assertEqual(result, "[vi] Hello")
        request = sent[0]
        self.assertIn("api.cognitive.microsofttranslator.com/translate?", request["url"])
        for part in ["api-version=3.0", "from=en", "to=vi", "textType=html"]:
            self.assertIn(part, request["url"])
        self.assertEqual(request["headers"]["Ocp-apim-subscription-key"], "test-translator-key")
        self.assertEqual(request["headers"]["Ocp-apim-subscription-region"], "test-region")
        self.assertEqual(request["body"], [{"text": "Hello"}])
        self.assertEqual(request["timeout"], 10)

    def test_connection_verifies_certificates(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("Hello", "en", "vi")
        context = sent[0]["context"]
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(len(context.get_ca_certs()), 0, "Must carry its own trusted certificates")

    def test_connection_failure_logs_the_reason(self):
        with mock.patch(OPEN, side_effect=urllib.error.URLError("certificate verify failed")):
            with self.assertLogs("dojo.content", "ERROR") as logs, self.assertRaises(translation.TranslationFailed):
                translation.translate("Private words", "en", "vi")
        output = "".join(logs.output)
        self.assertIn("certificate verify failed", output)
        self.assertNotIn("Private words", output)

    @override_settings(AZURE_TRANSLATOR_REGION="")
    def test_region_header_is_left_out_for_a_global_resource(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("Hello", "en", "vi")
        self.assertNotIn("Ocp-apim-subscription-region", sent[0]["headers"])

    def test_both_directions_work(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("Xin chào", "vi", "en")
        self.assertIn("from=vi", sent[0]["url"])
        self.assertIn("to=en", sent[0]["url"])

    def test_glossary_terms_are_protected_and_tags_removed_from_the_result(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            result = translation.translate("A Godan teaches Aikido", "en", "vi")
        self.assertEqual(
            sent[0]["body"][0]["text"],
            'A <span class="notranslate">Godan</span> teaches <span class="notranslate">Aikido</span>',
        )
        self.assertEqual(result, "[vi] A Godan teaches Aikido")

    def test_glossary_match_ignores_case_and_keeps_what_was_typed(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("the HAKAMA and Kyu-shinsa", "en", "vi")
        text = sent[0]["body"][0]["text"]
        self.assertIn('<span class="notranslate">HAKAMA</span>', text)
        self.assertIn('<span class="notranslate">Kyu-shinsa</span>', text)

    def test_only_whole_words_are_protected(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("Godanish", "en", "vi")
        self.assertEqual(sent[0]["body"][0]["text"], "Godanish")

    def test_html_in_the_text_is_kept_as_plain_text(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            result = translation.translate("<script>x</script> & <b>y</b>", "en", "vi")
        self.assertEqual(sent[0]["body"][0]["text"], "&lt;script&gt;x&lt;/script&gt; &amp; &lt;b&gt;y&lt;/b&gt;")
        self.assertEqual(result, "[vi] <script>x</script> & <b>y</b>")

    def test_keeps_line_breaks_and_blank_lines(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            result = translation.translate("One\n\nTwo\nThree", "en", "vi")
        self.assertEqual(result, "[vi] One\n\n[vi] Two\n[vi] Three")
        self.assertEqual(len(sent[0]["body"]), 3)

    def test_blank_text_costs_nothing(self):
        with mock.patch(OPEN) as call:
            for text in ["", "   ", "\n\n"]:
                self.assertEqual(translation.translate(text, "en", "vi"), "")
        call.assert_not_called()

    def test_bad_requests_are_refused_before_any_call(self):
        cases = [("x", "en", "en"), ("x", "en", "fr"), ("x", "de", "vi"), ("x", "", ""), (None, "en", "vi"), (5, "en", "vi")]
        with mock.patch(OPEN) as call:
            for case in cases:
                with self.subTest(case=case), self.assertRaises(translation.InvalidTranslationRequest):
                    translation.translate(*case)
        call.assert_not_called()

    @override_settings(TRANSLATION_MAX_CHARACTERS=5)
    def test_text_over_the_limit_is_refused(self):
        with mock.patch(OPEN) as call, self.assertRaises(translation.TextTooLong):
            translation.translate("too long", "en", "vi")
        call.assert_not_called()

    def test_more_lines_than_azure_allows_are_refused(self):
        with mock.patch(OPEN) as call, self.assertRaises(translation.TextTooLong):
            translation.translate("a\n" * 1001, "en", "vi")
        call.assert_not_called()

    @override_settings(AZURE_TRANSLATOR_KEY="")
    def test_missing_key_is_reported(self):
        with mock.patch(OPEN) as call, self.assertRaises(translation.TranslationNotConfigured):
            translation.translate("Hello", "en", "vi")
        call.assert_not_called()

    def test_provider_errors_become_our_errors(self):
        cases = [
            (http_error(401), translation.TranslationFailed),
            (http_error(400), translation.TranslationFailed),
            (http_error(500), translation.TranslationFailed),
            (http_error(403), translation.TranslationLimitReached),
            (http_error(429), translation.TranslationLimitReached),
            (urllib.error.URLError("down"), translation.TranslationFailed),
            (TimeoutError(), translation.TranslationFailed),
        ]
        for error, expected in cases:
            with self.subTest(error=error), mock.patch(OPEN, side_effect=error):
                with self.assertLogs("dojo.content", "ERROR"), self.assertRaises(expected):
                    translation.translate("Hello", "en", "vi")

    def test_unusable_responses_are_failures(self):
        for body in [b"not json", b"{}", b"[]", b'[{"translations": []}]', b'[{"nope": 1}]']:
            with self.subTest(body=body), mock.patch(OPEN, return_value=io.BytesIO(body)):
                with self.assertLogs("dojo.content", "ERROR"), self.assertRaises(translation.TranslationFailed):
                    translation.translate("Hello", "en", "vi")

    def test_logs_never_contain_the_key_or_the_text(self):
        with mock.patch(OPEN, side_effect=http_error(401)):
            with self.assertLogs("dojo.content", "ERROR") as logs, self.assertRaises(translation.TranslationFailed):
                translation.translate("Private words", "en", "vi")
        output = "".join(logs.output)
        self.assertNotIn("test-translator-key", output)
        self.assertNotIn("Private words", output)

    @override_settings(TRANSLATION_DAILY_CHARACTER_LIMIT=10)
    def test_daily_budget_stops_calls_once_used(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            translation.translate("12345678", "en", "vi")
            with self.assertRaises(translation.TranslationLimitReached):
                translation.translate("12345", "en", "vi")
        self.assertEqual(len(sent), 1)


class EndpointTests(TranslationTestCase):
    def setUp(self):
        super().setUp()
        self.staff = get_user_model().objects.create_user("boss", password="pw-for-tests", is_staff=True)
        self.staff.groups.set(Group.objects.filter(name=ADMIN_GROUP))
        self.client.force_login(self.staff)

    def post(self, client=None, **overrides):
        data = {"text": "Hello", "source": "en", "target": "vi", **overrides}
        return (client or self.client).post(URL, json.dumps(data), content_type="application/json")

    def test_url_name_matches_the_address_in_the_script(self):
        self.assertEqual(reverse("admin_translate"), URL)

    def test_returns_the_translation(self):
        fake, _ = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"translation": "[vi] Hello"})

    def test_any_staff_role_can_use_it(self):
        moderator = get_user_model().objects.create_user("mod", password="pw-for-tests", is_staff=True)
        moderator.groups.set(Group.objects.filter(name=MODERATOR_GROUP))
        client = Client()
        client.force_login(moderator)
        fake, _ = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            self.assertEqual(self.post(client=client).status_code, 200)

    def test_anonymous_and_non_staff_never_reach_azure(self):
        plain = Client()
        plain.force_login(get_user_model().objects.create_user("plain", password="pw-for-tests"))
        with mock.patch(OPEN) as call:
            for client in [Client(), plain]:
                response = self.post(client=client)
                self.assertEqual(response.status_code, 302)
                self.assertIn("/admin/login/", response["Location"])
        call.assert_not_called()

    def test_csrf_is_required(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.staff)
        with mock.patch(OPEN) as call:
            self.assertEqual(self.post(client=client).status_code, 403)
        call.assert_not_called()

    def test_only_post_is_allowed(self):
        for method in ["get", "put", "delete"]:
            self.assertEqual(getattr(self.client, method)(URL).status_code, 405, method)

    def test_malformed_requests_are_refused(self):
        for body in ["not json", "[]", "{}", '{"text": "x"}', "null"]:
            with self.subTest(body=body):
                response = self.client.post(URL, body, content_type="application/json")
                self.assertEqual(response.status_code, 400)

    def test_each_failure_has_its_own_status_and_shows_no_details(self):
        cases = [
            (translation.InvalidTranslationRequest, 400),
            (translation.TextTooLong, 413),
            (translation.TranslationNotConfigured, 503),
            (translation.TranslationLimitReached, 429),
            (translation.TranslationFailed, 502),
        ]
        for error, status in cases:
            with self.subTest(status=status), mock.patch("content.translation.translate", side_effect=error("secret detail")):
                response = self.post()
                self.assertEqual(response.status_code, status)
                self.assertNotIn("secret detail", response.content.decode())

    @override_settings(TRANSLATION_RATE_LIMIT=(2, 60))
    def test_rate_limit_is_per_user_and_stops_before_azure(self):
        fake, sent = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            self.assertEqual(self.post().status_code, 200)
            self.assertEqual(self.post().status_code, 200)
            self.assertEqual(self.post().status_code, 429)
            self.assertEqual(len(sent), 2)
            other = get_user_model().objects.create_user("other", password="pw-for-tests", is_staff=True)
            client = Client()
            client.force_login(other)
            self.assertEqual(self.post(client=client).status_code, 200)

    def test_key_never_appears_in_a_page_or_response(self):
        fake, _ = azure_replies()
        with mock.patch(OPEN, side_effect=fake):
            self.assertNotIn("test-translator-key", self.post().content.decode())
        page = self.client.get("/admin/content/announcement/add/")
        self.assertNotContains(page, "test-translator-key")


class OptionalLanguageTests(TestCase):
    def setUp(self):
        self.author = make_author()
        boss = get_user_model().objects.create_user("boss", password="pw-for-tests", is_staff=True)
        boss.groups.set(Group.objects.filter(name=ADMIN_GROUP))
        self.client.force_login(boss)

    def faq_data(self, **overrides):
        return {
            "question_en": "", "question_vi": "", "answer_en": "", "answer_vi": "",
            "is_published": "on", "_save": "Save", **overrides,
        }

    def test_saving_with_only_english_or_only_vietnamese_works(self):
        for language, other in [("en", "vi"), ("vi", "en")]:
            with self.subTest(language=language):
                data = self.faq_data(**{f"question_{language}": f"Q {language}?", f"answer_{language}": "A"})
                response = self.client.post("/admin/content/faq/add/", data)
                self.assertEqual(response.status_code, 302)
                stored = Faq.objects.get(**{f"question_{language}": f"Q {language}?"})
                self.assertEqual(getattr(stored, f"question_{other}"), "")

    def test_mixed_languages_across_fields_are_fine(self):
        data = self.faq_data(question_en="Q?", answer_vi="Đáp")
        self.assertEqual(self.client.post("/admin/content/faq/add/", data).status_code, 302)

    def test_each_field_needs_at_least_one_language(self):
        cases = [
            (self.faq_data(), "question"),
            (self.faq_data(question_en="Q?"), "answer"),
            (self.faq_data(answer_vi="A"), "question"),
            (self.faq_data(question_en="   ", answer_en="A"), "question"),
        ]
        for data, field in cases:
            with self.subTest(data=data):
                response = self.client.post("/admin/content/faq/add/", data)
                self.assertContains(response, f"Please write the {field} in at least one language.")
        self.assertFalse(Faq.objects.exists())

    def test_model_validation_covers_each_content_type(self):
        cases = [(Announcement(author=self.author, date="2026-01-01"), "title_en"), (Photo(author=self.author), "alt_en")]
        for obj, field in cases:
            with self.subTest(model=type(obj).__name__), self.assertRaises(ValidationError) as caught:
                obj.clean()
            self.assertIn(field, caught.exception.message_dict)

    def test_edit_can_clear_one_language_but_not_both(self):
        item = make_announcement(self.author)
        url = f"/admin/content/announcement/{item.pk}/change/"
        base = {"date": "2026-01-01", "body_en": "B", "body_vi": "", "expected_version": 1, "_save": "Save"}
        self.assertEqual(self.client.post(url, {**base, "title_en": "T", "title_vi": ""}).status_code, 302)
        self.assertEqual(Announcement.objects.get(pk=item.pk).title_vi, "")
        response = self.client.post(url, {**base, "title_en": "", "title_vi": "", "expected_version": 2})
        self.assertContains(response, "in at least one language")
        self.assertEqual(Announcement.objects.get(pk=item.pk).version, 2)

    def test_list_pages_show_a_name_for_vietnamese_only_content(self):
        Faq.objects.create(author=self.author, question_en="", question_vi="Câu hỏi?", answer_en="", answer_vi="Đáp")
        self.assertContains(self.client.get("/admin/content/faq/"), "Câu hỏi?")
        self.assertEqual(str(Faq.objects.get()), "Câu hỏi?")

    def test_public_api_returns_the_missing_language_as_empty_text(self):
        Faq.objects.create(
            author=self.author, is_published=True, question_en="", question_vi="Câu hỏi?", answer_en="A", answer_vi=""
        )
        item = self.client.get("/api/faq").json()[0]
        self.assertEqual(item["question"], {"en": "", "vi": "Câu hỏi?"})
        self.assertEqual(item["answer"], {"en": "A", "vi": ""})

    def test_labels_for_lookups_still_need_both_languages(self):
        response = self.client.post("/admin/content/classtype/add/", {"class_name_en": "Kids", "class_name_vi": ""})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ClassType.objects.exists())
        response = self.client.post("/admin/content/role/add/", {"seniority": 1, "role_en": "", "role_vi": "x"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Role.objects.exists())

    def test_admin_forms_load_the_translation_script(self):
        for path in ["faq", "announcement", "photo", "instructor", "role", "classtype"]:
            with self.subTest(path=path):
                self.assertContains(self.client.get(f"/admin/content/{path}/add/"), "admin/content/translate.js")

    def test_version_check_still_applies(self):
        item = make_announcement(self.author)
        obj = Announcement.objects.get(pk=item.pk)
        obj.title_vi = ""
        services.save_content(obj, 1)
        with self.assertRaises(services.StaleVersionError):
            services.save_content(Announcement.objects.get(pk=item.pk), 1)
