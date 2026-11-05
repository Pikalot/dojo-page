"""User management. Roles are chosen from a list and applied by
accounts.services; the raw is_staff, is_superuser, groups and permissions fields
are never on the form, so they can't be set by posting them either."""
from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm
from django.contrib.auth.models import Group
from django.http import HttpResponseRedirect

from . import services
from .roles import CATEGORY_CHOICES, ROLE_CHOICES, ROLE_MODERATOR

User = get_user_model()


class DojoUserChangeForm(UserChangeForm):
    role = forms.ChoiceField(choices=ROLE_CHOICES)
    categories = forms.MultipleChoiceField(
        choices=CATEGORY_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        help_text="What a moderator may create and edit. Ignored for other roles.",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["role"].initial = services.get_user_role(self.instance)
            self.fields["categories"].initial = services.get_user_categories(self.instance)


# Replaces Django's stock user admin, which exposes the raw permission fields.
admin.site.unregister(User)


@admin.register(User)
class DojoUserAdmin(UserAdmin):
    form = DojoUserChangeForm
    actions = []
    list_display = ("username", "email", "role", "is_active", "last_login")
    list_filter = ("is_active",)
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email")}),
        ("Access", {"fields": ("is_active", "role", "categories")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    readonly_fields = ("last_login", "date_joined")

    @admin.display(description="Role")
    def role(self, obj):
        return dict(ROLE_CHOICES)[services.get_user_role(obj)]

    def has_delete_permission(self, request, obj=None):
        # Deactivate instead. Users are the recorded authors of content.
        return False

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.is_superuser and not request.user.is_superuser:
            return False  # Includes the password form, which would be a takeover.
        return super().has_change_permission(request, obj)

    def save_model(self, request, obj, form, change):
        if not change:
            super().save_model(request, obj, form, change)  # New users start with no access.
            return
        # The form already put is_active on obj. Only the service may change it.
        requested_active = form.cleaned_data["is_active"]
        obj.is_active = form.initial["is_active"]
        super().save_model(request, obj, form, change)

        role = form.cleaned_data["role"]
        services.update_user_access(
            request.user,
            obj.pk,
            role=role,
            categories=form.cleaned_data["categories"] if role == ROLE_MODERATOR else (),
            is_active=requested_active,
        )

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except services.RoleChangeError as exc:
            # The admin's transaction has rolled back everything from this save.
            messages.error(request, str(exc))
            return HttpResponseRedirect(request.path)


# Groups define the roles (accounts/roles.py); editing them here would change
# what every role means, so they're not offered at all.
admin.site.unregister(Group)
