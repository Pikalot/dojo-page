"""The permission matrix, as data. README.md has the same table for people.

A role is Django groups, so permissions are enforced by Django's own checks on
every admin request:
- Admin: everything in the content app, and managing users (never deleting).
- Moderator: may publish, and read the lookup tables. Can't edit any content
  until given a category, so each one is explicitly authorized.
- User: no groups, so no permissions.
"""
from django.contrib.auth.models import Group, Permission

ROLE_USER = "user"
ROLE_MODERATOR = "moderator"
ROLE_ADMIN = "admin"
ROLE_CHOICES = [(ROLE_USER, "User"), (ROLE_MODERATOR, "Moderator"), (ROLE_ADMIN, "Admin")]

ADMIN_GROUP = "Admin"
MODERATOR_GROUP = "Moderator"

# Category key -> (label, models editable with it, models also deletable with it).
# Removing a photo from the carousel or an instructor only deletes the link
# between them, not content, so moderators may do it.
CATEGORIES = {
    "announcements": ("Announcements", ["announcement"], []),
    "instructors": ("Instructors", ["instructor"], []),
    "schedules": ("Schedules", ["schedule"], []),
    "faqs": ("FAQs", ["faq"], []),
    "photos": ("Photos", ["photo", "dojophoto", "portrait"], ["dojophoto", "portrait"]),
}
CATEGORY_CHOICES = [(key, value[0]) for key, value in CATEGORIES.items()]


def category_group_name(key):
    return f"Category: {CATEGORIES[key][0]}"


def _content_perms(actions, models):
    codenames = [f"{action}_{model}" for action in actions for model in models]
    return Permission.objects.filter(content_type__app_label="content", codename__in=codenames)


def sync_role_groups(**kwargs):
    """Makes the groups match this file. Safe to run repeatedly."""
    admin, _ = Group.objects.get_or_create(name=ADMIN_GROUP)
    admin.permissions.set(
        Permission.objects.filter(content_type__app_label="content")
        | Permission.objects.filter(
            content_type__app_label="auth",
            codename__in=["view_user", "add_user", "change_user"],
        )
    )

    moderator, _ = Group.objects.get_or_create(name=MODERATOR_GROUP)
    moderator.permissions.set(
        Permission.objects.filter(content_type__app_label="content", codename="publish_content")
        | _content_perms(["view"], ["rank", "role", "classtype"])
    )

    for key, (_, editable, deletable) in CATEGORIES.items():
        group, _ = Group.objects.get_or_create(name=category_group_name(key))
        group.permissions.set(
            _content_perms(["view", "add", "change"], editable) | _content_perms(["delete"], deletable)
        )
