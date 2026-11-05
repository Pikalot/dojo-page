"""The editing interface. Every save and delete of content goes through
content.services, inside the transaction the admin opens for each POST. That
transaction also covers inline rows and the audit log entry, so a failure at any
step undoes the whole request."""
from django import forms
from django.contrib import admin, messages
from django.conf import settings
from django.contrib.admin.utils import unquote
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponseNotAllowed, JsonResponse
from django.template.response import TemplateResponse
from django.urls import path, reverse

from accounts import ratelimit

from . import cloudinary_client, services
from .images import InvalidImage
from .models import (
    Announcement,
    ClassType,
    DojoPhoto,
    Faq,
    Instructor,
    Photo,
    Portrait,
    Rank,
    Role,
    Schedule,
)


class VersionedContentForm(forms.ModelForm):
    """Carries the version the editor loaded through a hidden field. A form
    re-shown after a validation error keeps the original value, so a conflict is
    still caught."""

    expected_version = forms.IntegerField(widget=forms.HiddenInput, required=False, min_value=1)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["expected_version"].initial = self.instance.version

    def clean(self):
        cleaned_data = super().clean()
        if not self.instance.pk:
            return cleaned_data
        # A hidden field's own error wouldn't be visible next to anything.
        self.errors.pop("expected_version", None)
        if not cleaned_data.get("expected_version"):
            cleaned_data.pop("expected_version", None)
            self.add_error(None, "This page is missing its version information. Reload it and try again.")
        return cleaned_data


class VersionedContentAdmin(admin.ModelAdmin):
    form = VersionedContentForm
    readonly_fields = ("version", "author", "created_at", "updated_at")
    list_filter = ("is_published",)
    actions = ("publish_selected", "unpublish_selected")
    delete_confirmation_template = "admin/content/delete_confirmation.html"

    # Publishing

    def has_publish_permission(self, request):
        return request.user.has_perm("content.publish_content")

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        # Read-only fields are left off the form, so posting one has no effect.
        if not self.has_publish_permission(request):
            fields.append("is_published")
        return fields

    def _set_published(self, request, queryset, is_published):
        # An action only needs view access to appear, so check the right to edit.
        if not self.has_change_permission(request):
            self.message_user(request, "You don't have permission to change these.", messages.ERROR)
            return
        try:
            changed = services.set_published(queryset.values_list("pk", flat=True), is_published)
        except services.ContentError:
            self.message_user(request, "Nothing was changed. Please try again.", messages.ERROR)
            return
        state = "published" if is_published else "unpublished"
        self.message_user(request, f"{changed} item(s) {state}.", messages.SUCCESS)

    @admin.action(description="Publish selected", permissions=["publish"])
    def publish_selected(self, request, queryset):
        self._set_published(request, queryset, True)

    @admin.action(description="Unpublish selected", permissions=["publish"])
    def unpublish_selected(self, request, queryset):
        self._set_published(request, queryset, False)

    # Saving and deleting

    def save_model(self, request, obj, form, change):
        if change:
            services.save_content(obj, form.cleaned_data["expected_version"])
        else:
            services.create_content(obj, request.user)

    def delete_model(self, request, obj):
        services.delete_content(obj, request.POST.get("expected_version"))

    def render_delete_form(self, request, context):
        context["expected_version"] = context["object"].version
        return super().render_delete_form(request, context)

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            # Errors raised inside must leave through the admin's atomic block,
            # so it rolls back, including any inline rows already written.
            with services.translate_database_errors():
                return super().changeform_view(request, object_id, form_url, extra_context)
        except services.ContentError as exc:
            return self._failure_response(request, object_id, exc)

    def delete_view(self, request, object_id, extra_context=None):
        try:
            with services.translate_database_errors():
                return super().delete_view(request, object_id, extra_context)
        except services.ContentError as exc:
            return self._failure_response(request, object_id, exc, deleting=True)

    # When a save is refused

    def _failure_response(self, request, object_id, exc, deleting=False):
        context = {
            **self.admin_site.each_context(request),
            "opts": self.opts,
            "title": "Your changes were not saved",
            "deleting": deleting,
            "list_url": reverse(f"admin:{self.opts.app_label}_{self.opts.model_name}_changelist"),
        }
        if object_id:
            context["change_url"] = reverse(
                f"admin:{self.opts.app_label}_{self.opts.model_name}_change", args=[object_id]
            )
        if isinstance(exc, services.StaleVersionError):
            status = 409
            context["reason"] = "conflict"
            context["current_version"] = exc.current_version
            if deleting:
                context["delete_url"] = reverse(
                    f"admin:{self.opts.app_label}_{self.opts.model_name}_delete", args=[object_id]
                )
            else:
                context["rows"] = self._conflict_rows(request, object_id)
                context["repost"] = [
                    (key, value)
                    for key, values in request.POST.lists()
                    if key not in ("csrfmiddlewaretoken", "expected_version")
                    for value in values
                ]
        elif isinstance(exc, services.ContentGoneError):
            status, context["reason"] = 409, "gone"
        elif isinstance(exc, services.ContentConstraintError):
            status, context["reason"] = 409, "constraint"
        elif isinstance(exc, services.ContentBusyError):
            status, context["reason"] = 503, "busy"
        else:
            status, context["reason"] = 400, "invalid"
        return TemplateResponse(request, "admin/content/save_failed.html", context, status=status)

    def _conflict_rows(self, request, object_id):
        """What this editor submitted beside what is in the database now."""
        pk = unquote(object_id)
        # Two copies, because validating a form writes its values to its instance.
        current = self.get_queryset(request).get(pk=pk)
        scratch = self.get_queryset(request).get(pk=pk)
        form = self.get_form(request, scratch, change=True)(request.POST, instance=scratch)
        form.is_valid()

        rows = []
        for name, field in form.fields.items():
            if name == "expected_version":
                continue
            theirs = self._display_value(current, name)
            mine = form.cleaned_data.get(name, form[name].value())
            model_field = self.opts.get_field(name)
            if model_field.choices:
                mine = dict(model_field.flatchoices).get(mine, mine)
            mine = "" if mine is None else str(mine)
            rows.append({"label": field.label, "mine": mine, "theirs": theirs, "differs": mine != theirs})
        return rows

    def _display_value(self, obj, name):
        model_field = self.opts.get_field(name)
        if model_field.choices:
            return str(getattr(obj, f"get_{name}_display")())
        value = getattr(obj, name)
        return "" if value is None else str(value)


@admin.register(Announcement)
class AnnouncementAdmin(VersionedContentAdmin):
    list_display = ("title_en", "date", "is_published", "updated_at")
    search_fields = ("title_en", "title_vi")
    date_hierarchy = "date"


@admin.register(Instructor)
class InstructorAdmin(VersionedContentAdmin):
    list_display = ("name", "rank", "role", "is_published", "updated_at")
    list_filter = ("is_published", "rank", "role")
    list_select_related = ("rank", "role")
    search_fields = ("name",)


@admin.register(Faq)
class FaqAdmin(VersionedContentAdmin):
    list_display = ("question_en", "is_published", "updated_at")
    search_fields = ("question_en", "question_vi")


@admin.register(Schedule)
class ScheduleAdmin(VersionedContentAdmin):
    list_display = ("day_of_wk", "start_time", "end_time", "class_type", "is_published")
    list_filter = ("is_published", "class_type", "day_of_wk")
    list_select_related = ("class_type",)
    ordering = ("day_of_wk", "start_time")


class DojoPhotoInline(admin.TabularInline):
    model = DojoPhoto
    max_num = 1
    can_delete = True
    verbose_name = "carousel position"
    verbose_name_plural = "About carousel"


class PortraitInline(admin.TabularInline):
    model = Portrait
    max_num = 1
    can_delete = True
    verbose_name = "instructor portrait"
    verbose_name_plural = "Instructor portrait"


@admin.register(Photo)
class PhotoAdmin(VersionedContentAdmin):
    list_display = ("alt_en", "is_published", "updated_at")
    search_fields = ("alt_en", "alt_vi")
    inlines = (DojoPhotoInline, PortraitInline)

    def delete_model(self, request, obj):
        def tell_about_kept_file(public_id):
            self.message_user(
                request,
                f"The photo was deleted, but its file is still on Cloudinary: {public_id}. Please remove it there.",
                messages.WARNING,
            )

        services.delete_photo(obj, request.POST.get("expected_version"), on_file_kept=tell_about_kept_file)

    def render_delete_form(self, request, context):
        context["deletes_cloudinary_file"] = (
            cloudinary_client.public_id_from_url(context["object"].src_link) is not None
        )
        return super().render_delete_form(request, context)

    def get_urls(self):
        # admin_view adds the sign-in check and CSRF protection.
        return [
            path("upload/", self.admin_site.admin_view(self.upload_view), name="content_photo_upload"),
            *super().get_urls(),
        ]

    def upload_view(self, request):
        """The drop-box page on GET. On POST, stores one photo and answers in JSON."""
        if not self.has_add_permission(request):
            raise PermissionDenied
        can_publish = self.has_publish_permission(request)
        can_add_to_carousel = request.user.has_perm("content.add_dojophoto")

        if request.method == "GET":
            context = {
                **self.admin_site.each_context(request),
                "opts": self.opts,
                "title": "Upload photos",
                "configured": cloudinary_client.is_configured(),
                "can_publish": can_publish,
                "can_add_to_carousel": can_add_to_carousel,
                "max_bytes": settings.PHOTO_UPLOAD_MAX_BYTES,
                "max_mb": settings.PHOTO_UPLOAD_MAX_BYTES // (1024 * 1024),
            }
            return TemplateResponse(request, "admin/content/photo_upload.html", context)
        if request.method != "POST":
            return HttpResponseNotAllowed(["GET", "POST"])

        def failed(message, status):
            return JsonResponse({"error": message}, status=status)

        limit, window = settings.PHOTO_UPLOAD_RATE_LIMIT
        user_key = str(request.user.pk)
        if ratelimit.is_blocked("photo-upload", user_key, limit):
            return failed("Too many uploads. Please wait a while and try again.", 429)

        image_file = request.FILES.get("file")
        if image_file is None:
            return failed("No file was received.", 400)

        ratelimit.record_attempt("photo-upload", user_key, window)
        try:
            photo = services.create_uploaded_photo(
                image_file,
                alt_en=request.POST.get("alt_en", ""),
                alt_vi=request.POST.get("alt_vi", ""),
                author=request.user,
                # Asking without the permission is ignored, like other read-only fields.
                add_to_carousel=can_add_to_carousel and "add_to_carousel" in request.POST,
                publish=can_publish and "publish" in request.POST,
            )
        except InvalidImage as exc:
            return failed(str(exc), 400)
        except ValidationError as exc:
            if {"alt_en", "alt_vi"} & set(exc.message_dict):
                return failed("Please describe the photo in both languages, in 500 characters or fewer.", 400)
            return failed("This photo could not be saved.", 400)
        except cloudinary_client.CloudinaryNotConfigured:
            return failed("Photo upload isn't set up yet.", 503)
        except cloudinary_client.CloudinaryUploadFailed:
            return failed("Cloudinary didn't accept this photo. Nothing was saved. Please try again.", 502)
        except services.ContentError:
            return failed("This photo could not be saved, and its upload was undone. Please try again.", 409)

        return JsonResponse(
            {
                "id": photo.pk,
                "url": photo.src_link,
                "change_url": reverse("admin:content_photo_change", args=[photo.pk]),
            },
            status=201,
        )


# Lookup tables. Not content: they carry no version (see README), and only
# admins can change them.

@admin.register(Rank)
class RankAdmin(admin.ModelAdmin):
    list_display = ("rank_en", "rank_vi", "dan_level")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("role_en", "role_vi", "seniority")


@admin.register(ClassType)
class ClassTypeAdmin(admin.ModelAdmin):
    list_display = ("class_name_en", "class_name_vi")
