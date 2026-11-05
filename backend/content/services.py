"""The only code allowed to write content, so every write is version-checked.

Strategy: optimistic concurrency control with an integer token.

    UPDATE Contents SET version = version + 1, updated_at = NOW(6)
    WHERE content_id = ? AND version = ?

Checking and writing in one statement is what makes it atomic: there is no gap
between reading the version and changing it for another editor to slip into.
A concurrent UPDATE on the row waits for the row lock, then re-evaluates the
WHERE clause against the committed value, matches nothing and is rejected. The
lock is held until commit, so the rest of the save can't interleave either.

The version lives on Contents but the edited text lives in the subtype table,
so the claim and the subtype write share one transaction. If any later step
fails, the version bump rolls back with it.
"""
import logging
from contextlib import contextmanager

from django.db import DataError, IntegrityError, OperationalError, transaction
from django.db.models import F
from django.db.models.functions import Now

from .models import Content

logger = logging.getLogger("dojo.content")

# MySQL: lock wait timeout, deadlock. Both mean the transaction did nothing and
# trying again later is safe.
_RETRYABLE_MYSQL_ERRORS = {1205, 1213}


class ContentError(Exception):
    """Base class: the write did not happen, and everything was rolled back."""


class InvalidVersionError(ContentError):
    """The request did not carry a usable version."""


class StaleVersionError(ContentError):
    """Someone else changed the record after this editor loaded it."""

    def __init__(self, content_id, expected_version, current_version):
        super().__init__(
            f"Content {content_id}: expected version {expected_version}, found {current_version}."
        )
        self.content_id = content_id
        self.expected_version = expected_version
        self.current_version = current_version


class ContentGoneError(ContentError):
    """The record was deleted after this editor loaded it."""

    def __init__(self, content_id):
        super().__init__(f"Content {content_id} no longer exists.")
        self.content_id = content_id


class ContentConstraintError(ContentError):
    """The database refused the data, such as a duplicate slot created by a
    concurrent request after the form had already validated."""


class ContentBusyError(ContentError):
    """A deadlock or lock timeout. Nothing was saved; it is safe to try again."""


def parse_version(raw):
    """Turns a submitted version into a positive int, or raises InvalidVersionError."""
    # bool is an int in Python; True must not pass as version 1.
    if isinstance(raw, bool):
        raise InvalidVersionError(f"Invalid version: {raw!r}")
    if isinstance(raw, int):
        version = raw
    elif isinstance(raw, str) and raw.strip().isascii() and raw.strip().isdigit():
        version = int(raw.strip())
    else:
        raise InvalidVersionError(f"Invalid version: {raw!r}")
    if version < 1:
        raise InvalidVersionError(f"Invalid version: {raw!r}")
    return version


@contextmanager
def translate_database_errors():
    """Must wrap the atomic block, so these fire after the rollback has happened."""
    try:
        yield
    except (IntegrityError, DataError) as exc:
        raise ContentConstraintError(str(exc)) from exc
    except OperationalError as exc:
        if exc.args and exc.args[0] in _RETRYABLE_MYSQL_ERRORS:
            raise ContentBusyError(str(exc)) from exc
        raise


def _claim_version(content_id, expected_version):
    """Compares and increments in one statement. Must run inside a transaction,
    which then holds the row lock until commit. Returns the new version."""
    claimed = Content.objects.filter(pk=content_id, version=expected_version).update(
        version=F("version") + 1, updated_at=Now()
    )
    if claimed:
        return expected_version + 1

    # Only explains the failure; nothing is decided from this read.
    current = Content.objects.filter(pk=content_id).values_list("version", flat=True).first()
    if current is None:
        raise ContentGoneError(content_id)
    raise StaleVersionError(content_id, expected_version, current)


def _require_saved_content(obj):
    if not isinstance(obj, Content):
        raise TypeError(f"Expected a Content subtype, got {type(obj).__name__}.")
    if obj.pk is None:
        raise ValueError("This record has not been created yet; use create_content().")


def create_content(obj, author):
    """Saves a new record at version 1, supertype and subtype rows together."""
    if not isinstance(obj, Content):
        raise TypeError(f"Expected a Content subtype, got {type(obj).__name__}.")
    if obj.pk is not None:
        raise ValueError("This record already exists; use save_content().")
    obj.author = author
    obj.version = 1
    with translate_database_errors(), transaction.atomic():
        obj.save()
    logger.info("Content %s created by user %s", obj.pk, author.pk)
    return obj


def save_content(obj, expected_version):
    """Saves an edit if nobody else has changed the record since expected_version.

    On any failure nothing is written, and obj.version keeps its old value.
    """
    _require_saved_content(obj)
    expected_version = parse_version(expected_version)
    previous_version = obj.version
    try:
        with translate_database_errors(), transaction.atomic():
            # save() writes every Contents column from this object, so it must
            # carry the new version or it would put the old one back.
            obj.version = _claim_version(obj.pk, expected_version)
            obj.save()
    except Exception:
        obj.version = previous_version
        raise
    logger.info("Content %s saved at version %s", obj.pk, obj.version)
    return obj


def delete_content(obj, expected_version):
    """Deletes a record unless it changed after the editor decided to delete it."""
    _require_saved_content(obj)
    expected_version = parse_version(expected_version)
    content_id = obj.pk
    with translate_database_errors(), transaction.atomic():
        _claim_version(content_id, expected_version)
        obj.delete()
    logger.info("Content %s deleted", content_id)


def set_published(content_ids, is_published):
    """Publishes or unpublishes in one statement: all rows or none.

    An explicit bulk action rather than an edit, so there is no version to
    compare. It still bumps the version of each row it changes, so an editor
    with one of them open gets a conflict instead of undoing this. Returns how
    many rows changed.
    """
    with translate_database_errors(), transaction.atomic():
        return (
            Content.objects.filter(pk__in=list(content_ids))
            .exclude(is_published=is_published)
            .update(is_published=is_published, version=F("version") + 1, updated_at=Now())
        )
