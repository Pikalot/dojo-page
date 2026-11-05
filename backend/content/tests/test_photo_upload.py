"""Photo upload: image cleaning, the Cloudinary boundary, and the HTTP workflow.
Calls to Cloudinary are replaced, so nothing here reaches the network."""
import io
from unittest import mock

import cloudinary.exceptions
from django.contrib.admin.models import ADDITION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.db import transaction
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from PIL import Image

from accounts.roles import ADMIN_GROUP, MODERATOR_GROUP, category_group_name
from content.models import Instructor, Portrait, Rank
from content import cloudinary_client, services
from content.cloudinary_client import UploadedImage
from content.images import InvalidImage, prepare_image
from content.models import Content, DojoPhoto, Photo

from .helpers import make_author

UPLOAD_URL = "/admin/content/photo/upload/"
GPS_IFD = 0x8825
ORIENTATION = 0x0112


def image_bytes(image_format="JPEG", size=(40, 20), color=(200, 30, 30), mode="RGB", **save_options):
    output = io.BytesIO()
    Image.new(mode, size, color).save(output, format=image_format, **save_options)
    return output.getvalue()


def as_upload(data=None, name="photo.jpg", content_type="image/jpeg"):
    return SimpleUploadedFile(name, image_bytes() if data is None else data, content_type=content_type)


def jpeg_with_gps_and_orientation():
    exif = Image.Exif()
    exif[ORIENTATION] = 6  # Rotate 90 degrees to display.
    exif[0x010F] = "SecretCameraMaker"
    exif.get_ifd(GPS_IFD)[2] = (37.0, 20.0, 5.0)  # Latitude.
    exif.get_ifd(GPS_IFD)[4] = (121.0, 53.0, 7.0)  # Longitude.
    return image_bytes(size=(40, 20), exif=exif, comment=b"SecretComment")


class PrepareImageTests(TestCase):
    def reopen(self, data):
        return Image.open(io.BytesIO(data))

    def test_keeps_each_allowed_format(self):
        for image_format, name in [("JPEG", "a.jpg"), ("PNG", "a.png"), ("WEBP", "a.webp")]:
            with self.subTest(image_format=image_format):
                result = prepare_image(as_upload(image_bytes(image_format), name=name))
                self.assertEqual(self.reopen(result).format, image_format)

    def test_removes_location_and_all_other_metadata(self):
        original = jpeg_with_gps_and_orientation()
        self.assertTrue(self.reopen(original).getexif().get_ifd(GPS_IFD), "The test file must start with GPS")
        self.assertIn(b"SecretCameraMaker", original)

        result = prepare_image(as_upload(original))

        cleaned = self.reopen(result)
        self.assertEqual(len(cleaned.getexif()), 0)
        self.assertFalse(cleaned.getexif().get_ifd(GPS_IFD))
        self.assertNotIn(b"Exif", result[:200])
        self.assertNotIn(b"SecretCameraMaker", result)
        self.assertNotIn(b"SecretComment", result)

    def test_removes_png_text_chunks(self):
        from PIL.PngImagePlugin import PngInfo

        info = PngInfo()
        info.add_text("Location", "SecretPlace")
        result = prepare_image(as_upload(image_bytes("PNG", pnginfo=info), name="a.png"))
        self.assertNotIn(b"SecretPlace", result)

    def test_applies_rotation_before_removing_the_tag(self):
        cleaned = self.reopen(prepare_image(as_upload(jpeg_with_gps_and_orientation())))
        self.assertEqual(cleaned.size, (20, 40))

    def test_keeps_png_transparency(self):
        data = image_bytes("PNG", mode="RGBA", color=(0, 0, 0, 0))
        cleaned = self.reopen(prepare_image(as_upload(data, name="a.png"))).convert("RGBA")
        self.assertEqual(cleaned.getpixel((0, 0))[3], 0)

    def test_small_images_keep_their_size_and_large_ones_shrink(self):
        self.assertEqual(self.reopen(prepare_image(as_upload(image_bytes(size=(100, 50))))).size, (100, 50))
        with override_settings(PHOTO_UPLOAD_MAX_DIMENSION=50):
            self.assertEqual(self.reopen(prepare_image(as_upload(image_bytes(size=(200, 100))))).size, (50, 25))

    def test_uses_the_content_not_the_name_or_declared_type(self):
        png_named_jpg = as_upload(image_bytes("PNG"), name="trick.jpg", content_type="image/jpeg")
        self.assertEqual(self.reopen(prepare_image(png_named_jpg)).format, "PNG")

    def test_refuses_files_that_are_not_allowed_images(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        cases = {
            "html named jpg": b"<html><script>alert(1)</script></html>",
            "svg": svg,
            "php": b"<?php system($_GET['c']); ?>",
            "random bytes": bytes(range(256)) * 4,
            "gif": image_bytes("GIF", color=1, mode="P"),
            "bmp": image_bytes("BMP"),
            "truncated jpeg": image_bytes()[:40],
        }
        for label, data in cases.items():
            with self.subTest(label), self.assertRaises(InvalidImage):
                prepare_image(as_upload(data))

    def test_refuses_an_empty_file(self):
        with self.assertRaisesMessage(InvalidImage, "empty"):
            prepare_image(as_upload(b""))

    @override_settings(PHOTO_UPLOAD_MAX_BYTES=100)
    def test_refuses_too_many_bytes(self):
        with self.assertRaisesMessage(InvalidImage, "limit"):
            prepare_image(as_upload(image_bytes(size=(200, 200))))

    @override_settings(PHOTO_UPLOAD_MAX_PIXELS=100)
    def test_refuses_too_many_pixels_before_decoding_them(self):
        upload = as_upload(image_bytes(size=(50, 50)))
        with mock.patch.object(Image.Image, "load", side_effect=AssertionError("decoded")) as load:
            with self.assertRaisesMessage(InvalidImage, "too many pixels"):
                prepare_image(upload)
        load.assert_not_called()


class CloudinaryClientTests(TestCase):
    def test_upload_returns_the_https_url_and_id(self):
        response = {"secure_url": "https://res.cloudinary.com/x/a.jpg", "url": "http://x", "public_id": "abc"}
        with mock.patch("cloudinary.uploader.upload", return_value=response) as upload:
            result = cloudinary_client.upload_image(b"bytes")
        self.assertEqual(result, UploadedImage("https://res.cloudinary.com/x/a.jpg", "abc"))
        options = upload.call_args.kwargs
        self.assertEqual(upload.call_args.args, (b"bytes",))
        self.assertEqual(options["resource_type"], "image")
        self.assertIs(options["overwrite"], False)
        self.assertEqual(options["allowed_formats"], "jpg,png,webp")
        self.assertEqual(options["api_secret"], "test-secret")
        self.assertNotIn("use_filename", options)

    def test_failures_become_one_error_without_details(self):
        for error in [cloudinary.exceptions.Error("api_secret=leak"), TimeoutError("slow"), OSError("network")]:
            with self.subTest(error=error), mock.patch("cloudinary.uploader.upload", side_effect=error):
                with self.assertRaises(cloudinary_client.CloudinaryUploadFailed) as caught:
                    cloudinary_client.upload_image(b"x")
                self.assertNotIn("leak", str(caught.exception))

    def test_failures_log_the_type_but_never_the_message(self):
        error = cloudinary.exceptions.Error("api_secret=leak")
        with mock.patch("cloudinary.uploader.upload", side_effect=error):
            with self.assertLogs("dojo.content", "ERROR") as logs, self.assertRaises(
                cloudinary_client.CloudinaryUploadFailed
            ):
                cloudinary_client.upload_image(b"x")
        self.assertNotIn("leak", "".join(logs.output))

    def test_response_without_https_url_is_refused_and_removed(self):
        with mock.patch("cloudinary.uploader.upload", return_value={"url": "http://x/a.jpg", "public_id": "abc"}):
            with mock.patch("cloudinary.uploader.destroy") as destroy:
                with self.assertRaises(cloudinary_client.CloudinaryUploadFailed):
                    cloudinary_client.upload_image(b"x")
        self.assertEqual(destroy.call_args.args, ("abc",))

    def test_response_without_an_id_is_refused(self):
        with mock.patch("cloudinary.uploader.upload", return_value={"secure_url": "https://x/a.jpg"}):
            with self.assertRaises(cloudinary_client.CloudinaryUploadFailed):
                cloudinary_client.upload_image(b"x")

    def test_missing_settings_stop_the_upload(self):
        for name in ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]:
            with self.subTest(name=name), override_settings(**{name: ""}):
                self.assertFalse(cloudinary_client.is_configured())
                with mock.patch("cloudinary.uploader.upload") as upload:
                    with self.assertRaises(cloudinary_client.CloudinaryNotConfigured):
                        cloudinary_client.upload_image(b"x")
                upload.assert_not_called()

    def test_delete_never_raises_and_reports_the_id_if_it_fails(self):
        with mock.patch("cloudinary.uploader.destroy", side_effect=OSError("down")):
            with self.assertLogs("dojo.content", "ERROR") as logs:
                self.assertFalse(cloudinary_client.delete_image("abc"))
        self.assertIn("abc", "".join(logs.output))

    def test_delete_clears_cdn_copies(self):
        with mock.patch("cloudinary.uploader.destroy", return_value={"result": "ok"}) as destroy:
            self.assertTrue(cloudinary_client.delete_image("abc"))
        self.assertIs(destroy.call_args.kwargs["invalidate"], True)


class CloudinaryTestCase(TestCase):
    """Replaces Cloudinary with a fake that records what it was sent."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.uploaded_count = 0

        def fake_upload(data):
            self.uploaded_count += 1
            return UploadedImage(f"https://res.cloudinary.com/test/{self.uploaded_count}.jpg", f"id-{self.uploaded_count}")

        patcher = mock.patch("content.cloudinary_client.upload_image", side_effect=fake_upload)
        self.upload = patcher.start()
        self.addCleanup(patcher.stop)
        patcher = mock.patch("content.cloudinary_client.delete_image", return_value=True)
        self.delete = patcher.start()
        self.addCleanup(patcher.stop)


class CreateUploadedPhotoTests(CloudinaryTestCase):
    def setUp(self):
        super().setUp()
        self.author = make_author()

    def create(self, image=None, **overrides):
        options = {"alt_en": "A photo", "alt_vi": "Một bức ảnh", "author": self.author, **overrides}
        return services.create_uploaded_photo(image or as_upload(), **options)

    def test_saves_the_link_cloudinary_returned_as_a_draft(self):
        photo = self.create()
        stored = Photo.objects.get(pk=photo.pk)
        self.assertEqual(stored.src_link, "https://res.cloudinary.com/test/1.jpg")
        self.assertEqual((stored.alt_en, stored.alt_vi), ("A photo", "Một bức ảnh"))
        self.assertEqual(stored.author, self.author)
        self.assertEqual(stored.version, 1)
        self.assertFalse(stored.is_published)
        self.assertFalse(DojoPhoto.objects.exists())

    def test_sends_the_cleaned_image_not_the_original(self):
        self.create(as_upload(jpeg_with_gps_and_orientation()))
        sent = self.upload.call_args.args[0]
        self.assertNotIn(b"SecretCameraMaker", sent)
        self.assertEqual(Image.open(io.BytesIO(sent)).size, (20, 40))

    def test_publishes_when_asked(self):
        self.assertTrue(Photo.objects.get(pk=self.create(publish=True).pk).is_published)

    def test_carousel_position_goes_after_the_last_one(self):
        first = self.create(add_to_carousel=True)
        second = self.create(add_to_carousel=True)
        self.assertEqual(DojoPhoto.objects.get(pk=first.pk).sort_order, 1)
        self.assertEqual(DojoPhoto.objects.get(pk=second.pk).sort_order, 2)

    def test_records_who_uploaded_it(self):
        photo = self.create()
        entry = LogEntry.objects.get()
        self.assertEqual((entry.user, entry.action_flag, entry.object_id), (self.author, ADDITION, str(photo.pk)))

    def test_trims_alt_text(self):
        photo = self.create(alt_en="  A photo  ")
        self.assertEqual(Photo.objects.get(pk=photo.pk).alt_en, "A photo")

    def test_missing_or_too_long_alt_text_stops_before_uploading(self):
        for case in [{"alt_en": ""}, {"alt_vi": "   "}, {"alt_en": "x" * 501}]:
            with self.subTest(case=case), self.assertRaises(ValidationError):
                self.create(**case)
        self.upload.assert_not_called()
        self.assertFalse(Content.objects.exists())

    def test_invalid_image_stops_before_uploading(self):
        with self.assertRaises(InvalidImage):
            self.create(as_upload(b"not an image"))
        self.upload.assert_not_called()
        self.assertFalse(Content.objects.exists())

    def test_failed_upload_saves_nothing(self):
        self.upload.side_effect = cloudinary_client.CloudinaryUploadFailed
        with self.assertRaises(cloudinary_client.CloudinaryUploadFailed):
            self.create(add_to_carousel=True)
        self.assertFalse(Content.objects.exists())
        self.assertFalse(LogEntry.objects.exists())
        self.delete.assert_not_called()

    def assert_undone(self):
        self.assertEqual(self.delete.call_args.args, ("id-1",))
        self.assertFalse(Content.objects.exists(), "No Contents row may remain")
        self.assertFalse(Photo.objects.exists())
        self.assertFalse(DojoPhoto.objects.exists())
        self.assertFalse(LogEntry.objects.exists())

    def test_database_error_deletes_the_upload_and_saves_nothing(self):
        with mock.patch.object(Photo, "save", side_effect=IntegrityError(1062, "duplicate")):
            with self.assertRaises(services.ContentConstraintError):
                self.create()
        self.assert_undone()

    def test_failure_at_the_carousel_step_undoes_the_photo_too(self):
        with mock.patch.object(DojoPhoto.objects, "create", side_effect=IntegrityError(1452, "bad key")):
            with self.assertRaises(services.ContentConstraintError):
                self.create(add_to_carousel=True)
        self.assert_undone()

    def test_failure_at_the_audit_log_undoes_everything(self):
        with mock.patch.object(LogEntry.objects, "log_actions", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.create(add_to_carousel=True)
        self.assert_undone()

    def test_unusable_url_from_cloudinary_is_refused_and_deleted(self):
        self.upload.side_effect = None
        self.upload.return_value = UploadedImage("https://not a url", "id-1")
        with self.assertRaises(ValidationError):
            self.create()
        self.assert_undone()

    def test_database_error_is_still_reported_if_the_delete_fails_too(self):
        self.delete.return_value = False
        with mock.patch.object(Photo, "save", side_effect=IntegrityError(1062, "duplicate")):
            with self.assertRaises(services.ContentConstraintError):
                self.create()
        self.assertFalse(Content.objects.exists())


class UploadViewTests(CloudinaryTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.make_staff("boss", ADMIN_GROUP)
        self.client.force_login(self.user)

    def make_staff(self, username, *groups):
        user = get_user_model().objects.create_user(username, password="pw-for-tests", is_staff=True)
        user.groups.set(Group.objects.filter(name__in=groups))
        return user

    def post(self, client=None, **overrides):
        data = {"file": as_upload(), "alt_en": "A photo", "alt_vi": "Một bức ảnh", **overrides}
        return (client or self.client).post(UPLOAD_URL, data)

    def test_url_name_works(self):
        self.assertEqual(reverse("admin:content_photo_upload"), UPLOAD_URL)

    def test_page_shows_the_drop_box_and_no_secrets(self):
        response = self.client.get(UPLOAD_URL)
        self.assertContains(response, 'id="photo-files"')
        self.assertContains(response, "multiple")
        for secret in ["test-secret", "test-key"]:
            self.assertNotContains(response, secret)

    @override_settings(CLOUDINARY_API_SECRET="")
    def test_page_explains_when_it_is_not_set_up(self):
        response = self.client.get(UPLOAD_URL)
        self.assertContains(response, "isn't set up yet")
        self.assertNotContains(response, 'id="photo-files"')

    def test_photo_list_links_to_the_upload_page(self):
        self.assertContains(self.client.get("/admin/content/photo/"), UPLOAD_URL)

    def test_successful_upload(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        photo = Photo.objects.get(pk=body["id"])
        self.assertEqual(body["url"], photo.src_link)
        self.assertEqual(body["change_url"], f"/admin/content/photo/{photo.pk}/change/")
        self.assertEqual(photo.author, self.user)

    def test_options_are_applied(self):
        body = self.post(add_to_carousel="on", publish="on").json()
        self.assertTrue(Photo.objects.get(pk=body["id"]).is_published)
        self.assertTrue(DojoPhoto.objects.filter(pk=body["id"]).exists())

    def test_author_and_link_cannot_be_set_by_posting_them(self):
        other = make_author("other")
        body = self.post(author=other.pk, src_link="https://evil.example/x.jpg", version=99).json()
        photo = Photo.objects.get(pk=body["id"])
        self.assertEqual(photo.author, self.user)
        self.assertEqual(photo.src_link, "https://res.cloudinary.com/test/1.jpg")
        self.assertEqual(photo.version, 1)

    def test_each_kind_of_failure_has_its_own_status_and_message(self):
        cases = [
            (cloudinary_client.CloudinaryUploadFailed, 502, "Cloudinary"),
            (cloudinary_client.CloudinaryNotConfigured, 503, "set up"),
        ]
        for error, status, text in cases:
            self.upload.side_effect = error
            with self.subTest(status=status):
                response = self.post()
                self.assertEqual(response.status_code, status)
                self.assertIn(text, response.json()["error"])
        self.assertFalse(Content.objects.exists())

    def test_database_failure_reports_that_the_upload_was_undone(self):
        with mock.patch.object(Photo, "save", side_effect=IntegrityError(1062, "duplicate key secret_column")):
            response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertNotIn("secret_column", response.content.decode())
        self.delete.assert_called_once()

    def test_bad_requests_are_refused_with_a_reason(self):
        bad = as_upload(b"<script>alert(1)</script>")
        for label, data, text in [
            ("not an image", {"file": bad}, "usable image"),
            ("no alt", {"alt_en": ""}, "both languages"),
            ("blank alt", {"alt_vi": "   "}, "both languages"),
            ("long alt", {"alt_vi": "x" * 501}, "both languages"),
        ]:
            with self.subTest(label):
                response = self.post(**data)
                self.assertEqual(response.status_code, 400)
                self.assertIn(text, response.json()["error"])
        self.upload.assert_not_called()

    def test_missing_file_is_refused(self):
        response = self.client.post(UPLOAD_URL, {"alt_en": "A", "alt_vi": "B"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "No file was received.")

    def test_other_methods_are_refused(self):
        for method in ["put", "delete", "patch"]:
            self.assertEqual(getattr(self.client, method)(UPLOAD_URL).status_code, 405, method)

    def test_anonymous_is_sent_to_login_and_nothing_is_uploaded(self):
        response = self.post(client=Client())
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])
        self.upload.assert_not_called()

    def test_csrf_is_required(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(self.post(client=client).status_code, 403)
        self.upload.assert_not_called()

    def client_for(self, *groups):
        client = Client()
        client.force_login(self.make_staff("-".join(groups)[:30].replace(" ", "").replace(":", ""), *groups))
        return client

    def test_moderator_needs_the_photos_category(self):
        for groups in [(MODERATOR_GROUP,), (MODERATOR_GROUP, category_group_name("faqs"))]:
            with self.subTest(groups=groups):
                client = self.client_for(*groups)
                self.assertEqual(client.get(UPLOAD_URL).status_code, 403)
                self.assertEqual(self.post(client=client).status_code, 403)
        self.upload.assert_not_called()

    def test_moderator_with_photos_can_upload_and_use_both_options(self):
        client = self.client_for(MODERATOR_GROUP, category_group_name("photos"))
        body = self.post(client=client, add_to_carousel="on", publish="on").json()
        self.assertTrue(Photo.objects.get(pk=body["id"]).is_published)
        self.assertTrue(DojoPhoto.objects.filter(pk=body["id"]).exists())

    def test_publish_is_ignored_without_permission(self):
        client = self.client_for(category_group_name("photos"))  # No Moderator group.
        response = client.get(UPLOAD_URL)
        self.assertNotContains(response, 'id="photo-publish"')
        body = self.post(client=client, publish="on").json()
        self.assertFalse(Photo.objects.get(pk=body["id"]).is_published)

    def test_new_drafts_do_not_reach_the_public_api(self):
        self.post(add_to_carousel="on")
        self.assertEqual(self.client.get("/api/dojo-photos").json(), [])

    def test_published_upload_reaches_the_public_api(self):
        self.post(add_to_carousel="on", publish="on")
        self.assertEqual(self.client.get("/api/dojo-photos").json()[0]["alt"]["vi"], "Một bức ảnh")

    @override_settings(PHOTO_UPLOAD_RATE_LIMIT=(2, 60))
    def test_rate_limit_is_per_user_and_stops_before_cloudinary(self):
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 429)
        self.assertEqual(self.upload.call_count, 2)
        other = self.client_for(ADMIN_GROUP)
        self.assertEqual(self.post(client=other).status_code, 201)


class PublicIdFromUrlTests(TestCase):
    """The cloud name in the test settings is test-cloud."""

    def test_reads_the_id_from_links_to_this_account(self):
        base = "https://res.cloudinary.com/test-cloud/image/upload"
        for url, expected in [
            (f"{base}/v1793163858/dojo_j5zxql.jpg", "dojo_j5zxql"),
            (f"{base}/sample.jpg", "sample"),
            (f"{base}/v1/folder/inner/name.png", "folder/inner/name"),
            (f"{base}/c_fill,w_100/v1/name.webp", "name"),
            (f"{base}/v1/two%20words.jpg", "two words"),
            (f"{base}/v1/name.jpg?x=1", "name"),
            (f"{base}/v1/no_extension", "no_extension"),
            ("http://res.cloudinary.com/test-cloud/image/upload/v1/name.jpg", "name"),
        ]:
            with self.subTest(url=url):
                self.assertEqual(cloudinary_client.public_id_from_url(url), expected)

    def test_returns_nothing_for_any_other_link(self):
        for url in [
            "https://res.cloudinary.com/someone-else/image/upload/v1/name.jpg",
            "https://evil.example/test-cloud/image/upload/v1/name.jpg",
            "https://res.cloudinary.com.evil.example/test-cloud/image/upload/v1/name.jpg",
            "https://res.cloudinary.com/test-cloud/video/upload/v1/name.mp4",
            "https://res.cloudinary.com/test-cloud/image/fetch/v1/name.jpg",
            "https://res.cloudinary.com/test-cloud/image/upload/",
            "https://res.cloudinary.com/test-cloud/image/upload/v1/",
            "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_100/name.jpg",
            "javascript:alert(1)",
            "not a url",
            "",
            None,
        ]:
            with self.subTest(url=url):
                self.assertIsNone(cloudinary_client.public_id_from_url(url))

    @override_settings(CLOUDINARY_CLOUD_NAME="")
    def test_returns_nothing_when_no_account_is_set(self):
        self.assertIsNone(cloudinary_client.public_id_from_url("https://res.cloudinary.com//image/upload/v1/a.jpg"))


class DeleteImageResponseTests(TestCase):
    def test_already_gone_counts_as_done_and_anything_else_does_not(self):
        for result, expected in [("ok", True), ("not found", True), ("error", False), (None, False)]:
            with self.subTest(result=result), mock.patch(
                "cloudinary.uploader.destroy", return_value={"result": result}
            ):
                if expected:
                    self.assertTrue(cloudinary_client.delete_image("abc"))
                else:
                    with self.assertLogs("dojo.content", "ERROR"):
                        self.assertFalse(cloudinary_client.delete_image("abc"))


OWN_LINK = "https://res.cloudinary.com/test-cloud/image/upload/v1/own_file.jpg"


class DeletePhotoTests(CloudinaryTestCase):
    def setUp(self):
        super().setUp()
        self.author = make_author()
        self.photo = self.make_photo(OWN_LINK)

    def make_photo(self, link):
        return Photo.objects.create(author=self.author, src_link=link, alt_en="A", alt_vi="B")

    def delete_now(self, photo, version=1, **options):
        with self.captureOnCommitCallbacks(execute=True):
            services.delete_photo(photo, version, **options)

    def test_deletes_the_record_and_then_the_file(self):
        pk = self.photo.pk
        self.delete_now(self.photo)
        self.assertFalse(Photo.objects.filter(pk=pk).exists())
        self.assertFalse(Content.objects.filter(pk=pk).exists())
        self.delete.assert_called_once_with("own_file")

    def test_file_is_not_touched_before_commit(self):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            services.delete_photo(self.photo, 1)
        self.delete.assert_not_called()
        self.assertEqual(len(callbacks), 1)

    def test_stale_version_keeps_the_record_and_the_file(self):
        Content.objects.filter(pk=self.photo.pk).update(version=2)
        with self.captureOnCommitCallbacks(execute=True), self.assertRaises(services.StaleVersionError):
            services.delete_photo(self.photo, 1)
        self.delete.assert_not_called()
        self.assertTrue(Photo.objects.filter(pk=self.photo.pk).exists())

    def test_missing_version_keeps_the_record_and_the_file(self):
        with self.captureOnCommitCallbacks(execute=True), self.assertRaises(services.InvalidVersionError):
            services.delete_photo(self.photo, None)
        self.delete.assert_not_called()

    def test_failed_database_delete_keeps_the_file(self):
        with mock.patch.object(Photo, "delete", side_effect=RuntimeError("boom")):
            with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError):
                services.delete_photo(self.photo, 1)
        self.delete.assert_not_called()
        self.assertEqual(Content.objects.get(pk=self.photo.pk).version, 1)

    def test_links_elsewhere_are_never_deleted(self):
        for link in [
            "https://res.cloudinary.com/someone-else/image/upload/v1/theirs.jpg",
            "https://example.org/photo.jpg",
        ]:
            with self.subTest(link=link):
                self.delete_now(self.make_photo(link))
                self.delete.assert_not_called()

    def test_file_used_by_another_photo_is_kept_until_the_last_one_goes(self):
        twin = self.make_photo(OWN_LINK)
        self.delete_now(self.photo)
        self.delete.assert_not_called()
        self.delete_now(twin)
        self.delete.assert_called_once_with("own_file")

    def test_failed_file_delete_keeps_the_record_deleted_and_reports_it(self):
        self.delete.return_value = False
        kept = mock.Mock()
        pk = self.photo.pk
        self.delete_now(self.photo, on_file_kept=kept)
        kept.assert_called_once_with("own_file")
        self.assertFalse(Photo.objects.filter(pk=pk).exists())

    def test_removes_the_carousel_and_portrait_links_but_not_the_instructor(self):
        rank = Rank.objects.create(dan_level=1, rank_en="Shodan", rank_vi="x")
        person = Instructor.objects.create(author=self.author, name="A", rank=rank)
        Portrait.objects.create(photo=self.photo, instructor=person)
        DojoPhoto.objects.create(photo=self.photo)
        self.delete_now(self.photo)
        self.assertFalse(Portrait.objects.exists())
        self.assertFalse(DojoPhoto.objects.exists())
        self.assertTrue(Instructor.objects.filter(pk=person.pk).exists())


class DeletePhotoAdminTests(CloudinaryTestCase):
    def setUp(self):
        super().setUp()
        self.boss = get_user_model().objects.create_user("boss", password="pw-for-tests", is_staff=True)
        self.boss.groups.set(Group.objects.filter(name=ADMIN_GROUP))
        self.client.force_login(self.boss)
        self.photo = Photo.objects.create(author=self.boss, src_link=OWN_LINK, alt_en="A", alt_vi="B")
        self.url = f"/admin/content/photo/{self.photo.pk}/delete/"

    def post(self, client=None, version=1):
        with self.captureOnCommitCallbacks(execute=True):
            return (client or self.client).post(self.url, {"post": "yes", "expected_version": version}, follow=True)

    def test_confirmation_page_warns_about_the_file(self):
        self.assertContains(self.client.get(self.url), "permanently deletes the image file from Cloudinary")

    def test_no_warning_for_a_link_that_is_not_ours(self):
        Photo.objects.filter(pk=self.photo.pk).update(src_link="https://example.org/a.jpg")
        self.assertNotContains(self.client.get(self.url), "permanently deletes")

    def test_admin_deletes_both(self):
        self.post()
        self.assertFalse(Photo.objects.filter(pk=self.photo.pk).exists())
        self.delete.assert_called_once_with("own_file")

    def test_stale_page_keeps_both(self):
        Content.objects.filter(pk=self.photo.pk).update(version=2)
        self.assertEqual(self.post().status_code, 409)
        self.delete.assert_not_called()
        self.assertTrue(Photo.objects.filter(pk=self.photo.pk).exists())

    def test_moderator_with_the_photos_category_cannot_delete(self):
        moderator = get_user_model().objects.create_user("mod", password="pw-for-tests", is_staff=True)
        moderator.groups.set(Group.objects.filter(name__in=[MODERATOR_GROUP, category_group_name("photos")]))
        client = Client()
        client.force_login(moderator)
        self.assertEqual(self.post(client=client).status_code, 403)
        self.delete.assert_not_called()
        self.assertTrue(Photo.objects.filter(pk=self.photo.pk).exists())

    def test_removing_a_carousel_link_does_not_delete_the_file(self):
        DojoPhoto.objects.create(photo=self.photo)
        data = {
            "src_link": OWN_LINK, "alt_en": "A", "alt_vi": "B", "expected_version": 1, "_save": "Save",
            "dojo_photo-TOTAL_FORMS": "1", "dojo_photo-INITIAL_FORMS": "1",
            "dojo_photo-MIN_NUM_FORMS": "0", "dojo_photo-MAX_NUM_FORMS": "1",
            "dojo_photo-0-photo": self.photo.pk, "dojo_photo-0-sort_order": "0", "dojo_photo-0-DELETE": "on",
            "portrait-TOTAL_FORMS": "0", "portrait-INITIAL_FORMS": "0",
            "portrait-MIN_NUM_FORMS": "0", "portrait-MAX_NUM_FORMS": "1",
        }
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/admin/content/photo/{self.photo.pk}/change/", data)
        self.assertEqual(response.status_code, 302)
        self.assertFalse(DojoPhoto.objects.exists())
        self.delete.assert_not_called()


class DeletePhotoCommitTests(TransactionTestCase):
    """With real commits, because this is the rule that protects a file for good."""

    def setUp(self):
        self.author = make_author()
        self.photo = Photo.objects.create(author=self.author, src_link=OWN_LINK, alt_en="A", alt_vi="B")

    def test_file_goes_only_after_commit(self):
        with mock.patch("content.cloudinary_client.delete_image", return_value=True) as delete:
            with transaction.atomic():
                services.delete_photo(self.photo, 1)
                delete.assert_not_called()
            delete.assert_called_once_with("own_file")

    def test_failed_file_delete_warns_the_admin_on_the_next_page(self):
        boss = get_user_model().objects.create_user("boss", password="pw-for-tests", is_staff=True)
        boss.groups.set(Group.objects.filter(name=ADMIN_GROUP))
        self.client.force_login(boss)
        pk = self.photo.pk
        with mock.patch("content.cloudinary_client.delete_image", return_value=False):
            response = self.client.post(
                f"/admin/content/photo/{pk}/delete/", {"post": "yes", "expected_version": 1}, follow=True
            )
        self.assertContains(response, "still on Cloudinary: own_file")
        self.assertFalse(Photo.objects.filter(pk=pk).exists())

    def test_outer_rollback_keeps_the_record_and_the_file(self):
        pk = self.photo.pk
        with mock.patch("content.cloudinary_client.delete_image", return_value=True) as delete:
            with self.assertRaises(RuntimeError), transaction.atomic():
                services.delete_photo(self.photo, 1)
                raise RuntimeError("A later step failed")
        delete.assert_not_called()
        self.assertTrue(Photo.objects.filter(pk=pk).exists())
        self.assertEqual(Content.objects.get(pk=pk).version, 1)
