"""The only code that talks to Cloudinary. Runs on the server, because the API
secret must never reach the browser."""
import logging
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import cloudinary.exceptions
import cloudinary.uploader
from django.conf import settings

logger = logging.getLogger("dojo.content")

_ALLOWED_FORMATS = "jpg,png,webp"
_TIMEOUT_SECONDS = 60


class CloudinaryNotConfigured(Exception):
    pass


class CloudinaryUploadFailed(Exception):
    """Details are logged, not carried here: this reaches the person uploading."""


@dataclass(frozen=True)
class UploadedImage:
    url: str
    public_id: str


def is_configured():
    return all(
        [settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]
    )


def public_id_from_url(url):
    """Returns the id of a file on this project's Cloudinary account, or None for
    any other link, which must never lead to a delete. Reading it from the link
    also covers photos that were added before upload existed.

    Format: https://res.cloudinary.com/<cloud>/image/upload/[options/][v123/]<id>.<ext>
    """
    parsed = urlparse(url or "")
    parts = [unquote(part) for part in parsed.path.split("/") if part]
    if parsed.scheme not in ("http", "https") or parsed.hostname != "res.cloudinary.com":
        return None
    if len(parts) < 4 or parts[0] != settings.CLOUDINARY_CLOUD_NAME or parts[1:3] != ["image", "upload"]:
        return None

    rest = parts[3:]
    versions = [index for index, part in enumerate(rest) if re.fullmatch(r"v\d+", part)]
    if versions:
        rest = rest[versions[0] + 1 :]
    elif "," in rest[0]:
        return None  # Resize options with no version: can't tell where the id starts.
    if not rest:
        return None
    return "/".join(rest).rsplit(".", 1)[0] or None


def _credentials():
    return {
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        "api_secret": settings.CLOUDINARY_API_SECRET,
    }


def upload_image(image_bytes):
    """Stores an image under a random name, so no file names are published."""
    if not is_configured():
        raise CloudinaryNotConfigured
    try:
        response = cloudinary.uploader.upload(
            image_bytes,
            resource_type="image",
            overwrite=False,
            allowed_formats=_ALLOWED_FORMATS,
            timeout=_TIMEOUT_SECONDS,
            **_credentials(),
        )
    except Exception as exc:  # The SDK can also raise network errors of its own.
        logger.error("Cloudinary upload failed: %s", type(exc).__name__)
        raise CloudinaryUploadFailed from exc

    url, public_id = response.get("secure_url"), response.get("public_id")
    if not public_id:
        logger.error("Cloudinary upload response had no public_id")
        raise CloudinaryUploadFailed
    if not (url or "").startswith("https://"):
        logger.error("Cloudinary upload response had no HTTPS URL: %s", public_id)
        delete_image(public_id)
        raise CloudinaryUploadFailed
    return UploadedImage(url=url, public_id=public_id)


def delete_image(public_id):
    """Best effort, for undoing an upload or removing a deleted photo's file. Returns whether it worked. Never raises,
    because it runs while another error is already being handled. A failure logs
    the id, so the leftover file can be removed by hand."""
    try:
        response = cloudinary.uploader.destroy(public_id, invalidate=True, timeout=_TIMEOUT_SECONDS, **_credentials())
    except Exception as exc:  # See upload_image.
        logger.error("Could not delete Cloudinary image %s: %s", public_id, type(exc).__name__)
        return False
    # "not found" means it is already gone, which is what was wanted.
    if response.get("result") not in ("ok", "not found"):
        logger.error("Could not delete Cloudinary image %s: unexpected response", public_id)
        return False
    return True
