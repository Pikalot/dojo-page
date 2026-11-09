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

from django.contrib.admin.models import ADDITION, LogEntry
from django.db import DataError, IntegrityError, OperationalError, transaction
from django.db.models import F, Max
from django.db.models.functions import Now

from . import cloudinary_client
from .images import prepare_image
from .models import Content, DojoPhoto, Photo

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


def create_uploaded_photo(image_file, *, alt_en, alt_vi, author, add_to_carousel=False, publish=False):
    """Cleans an image, stores it on Cloudinary and records it, for one photo.

    Cloudinary can't join a database transaction, so the order matters. Everything
    that can be refused is checked before the upload, nothing holds a database
    lock during the upload, and if saving fails afterwards, the upload is deleted.

    Raises ValidationError, images.InvalidImage or a cloudinary_client error before
    anything is stored, and a ContentError if saving failed and was undone.
    """
    photo = Photo(alt_en=alt_en.strip(), alt_vi=alt_vi.strip(), is_published=publish, author=author)
    photo.full_clean(exclude=["src_link", "content_ptr"])
    image_bytes = prepare_image(image_file)

    uploaded = cloudinary_client.upload_image(image_bytes)
    try:
        photo.src_link = uploaded.url
        photo.clean_fields(exclude=[f.name for f in Photo._meta.fields if f.name != "src_link"])
        with translate_database_errors(), transaction.atomic():
            create_content(photo, author)
            if add_to_carousel:
                # Two uploads at once may get the same number; the API then orders by id.
                highest = DojoPhoto.objects.aggregate(highest=Max("sort_order"))["highest"]
                DojoPhoto.objects.create(photo=photo, sort_order=(highest or 0) + 1)
            # Inside the transaction: the record exists only if the photo does.
            LogEntry.objects.log_actions(author.pk, [photo], ADDITION, change_message="Uploaded to Cloudinary")
    except Exception:
        cloudinary_client.delete_image(uploaded.public_id)
        raise
    return photo


def delete_photo(photo, expected_version, on_file_kept=None):
    """Deletes a photo record and then its file on Cloudinary.

    A file can't be restored, so it goes only after the record's deletion has
    really committed, including any transaction the caller has open. A rollback or
    a version conflict therefore leaves the file alone. Links to anything but this
    project's account, and files another photo still uses, are kept.

    If the file can't be removed, the record stays deleted and on_file_kept(id) is
    called, so the person can be told. The id is also logged.
    """
    _require_saved_content(photo)
    public_id = cloudinary_client.public_id_from_url(photo.src_link)
    in_use_elsewhere = Photo.objects.filter(src_link=photo.src_link).exclude(pk=photo.pk).exists()

    delete_content(photo, expected_version)

    if public_id is None or in_use_elsewhere:
        return

    def remove_file():
        if not cloudinary_client.delete_image(public_id) and on_file_kept:
            on_file_kept(public_id)

    transaction.on_commit(remove_file)
