"""Changing who can do what. All role and activation changes come through here,
so the last-administrator rule can't be sidestepped."""
import logging

from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q

from .roles import (
    ADMIN_GROUP,
    CATEGORIES,
    MODERATOR_GROUP,
    ROLE_ADMIN,
    ROLE_CHOICES,
    ROLE_MODERATOR,
    ROLE_USER,
    category_group_name,
)

logger = logging.getLogger("dojo.accounts")
User = get_user_model()


class RoleChangeError(Exception):
    """The change was refused; nothing was saved. The message is safe to show."""


class LastAdminError(RoleChangeError):
    pass


def _is_admin(user):
    return user.is_superuser or user.groups.filter(name=ADMIN_GROUP).exists()


def get_user_role(user):
    if _is_admin(user):
        return ROLE_ADMIN
    if user.groups.filter(name=MODERATOR_GROUP).exists():
        return ROLE_MODERATOR
    return ROLE_USER


def get_user_categories(user):
    names = set(user.groups.values_list("name", flat=True))
    return [key for key in CATEGORIES if category_group_name(key) in names]


def _other_active_admins_exist(target_id):
    return (
        User.objects.filter(Q(is_superuser=True) | Q(groups__name=ADMIN_GROUP), is_active=True)
        .exclude(pk=target_id)
        .exists()
    )


def update_user_access(actor, target_id, *, role, categories=(), is_active=True):
    """Sets a user's role, moderator categories and active flag, all or nothing.

    Raises PermissionDenied if actor may not do this, and RoleChangeError if the
    request is invalid or would leave no active administrator.
    """
    if role not in dict(ROLE_CHOICES):
        raise RoleChangeError(f"Unknown role: {role}")
    categories = list(dict.fromkeys(categories))
    unknown = [key for key in categories if key not in CATEGORIES]
    if unknown:
        raise RoleChangeError(f"Unknown categories: {', '.join(map(str, unknown))}")
    if categories and role != ROLE_MODERATOR:
        raise RoleChangeError("Only moderators have categories.")

    with transaction.atomic():
        # One lock for all access changes. Without it, two admins demoting each
        # other at once would each see the other still in place, and both succeed.
        Group.objects.select_for_update().get(name=ADMIN_GROUP)

        # Read after the lock, so the checks see any change that just committed.
        fresh_actor = User.objects.filter(pk=actor.pk, is_active=True).first()
        if fresh_actor is None or not _is_admin(fresh_actor):
            raise PermissionDenied
        target = User.objects.filter(pk=target_id).first()
        if target is None:
            raise RoleChangeError("That user no longer exists.")
        # Otherwise an admin could reset a superuser's access and take over.
        if target.is_superuser and not fresh_actor.is_superuser:
            raise PermissionDenied

        remains_admin = role == ROLE_ADMIN and is_active
        if target.is_active and _is_admin(target) and not remains_admin:
            if not _other_active_admins_exist(target.pk):
                raise LastAdminError("This is the last active administrator, so this change was not saved.")

        before = f"{get_user_role(target)}, active={target.is_active}"

        groups = []
        if role == ROLE_ADMIN:
            groups.append(ADMIN_GROUP)
        elif role == ROLE_MODERATOR:
            groups.append(MODERATOR_GROUP)
            groups.extend(category_group_name(key) for key in categories)
        target.groups.set(Group.objects.filter(name__in=groups))

        target.is_active = is_active
        target.is_staff = role in (ROLE_ADMIN, ROLE_MODERATOR)  # May open the admin at all.
        # Only a superuser reaches here with a superuser target, and an explicit
        # move away from admin has to remove that flag too.
        if role != ROLE_ADMIN:
            target.is_superuser = False
        target.save(update_fields=["is_active", "is_staff", "is_superuser"])

        after = f"{get_user_role(target)}, active={target.is_active}"
        if before != after or categories:
            message = f"Access changed from [{before}] to [{after}]"
            if categories:
                message += f"; categories: {', '.join(categories)}"
            # Inside the transaction: the record exists only if the change does.
            LogEntry.objects.log_actions(fresh_actor.pk, [target], CHANGE, change_message=message)
            logger.info("User %s: %s (by user %s)", target.pk, message, fresh_actor.pk)
    return target
