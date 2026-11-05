"""Checks an uploaded image and rebuilds it without its metadata.

Phone photos often carry the GPS position where they were taken. Cloudinary's
documentation doesn't say whether stored originals keep that, so it never leaves
this server: the image is decoded and written out again from its pixels alone.
That also proves the file really is an image, whatever its name or declared type.
"""
import io

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

# Detected from the file's content. SVG is left out on purpose: it can run scripts.
_ALLOWED_FORMATS = {
    "JPEG": {"quality": 90, "optimize": True},
    "PNG": {"optimize": True},
    "WEBP": {"quality": 90},
}
_NOT_AN_IMAGE = "This file isn't a usable image. Please use a JPEG, PNG or WebP photo."


class InvalidImage(Exception):
    """The file was refused. The message is safe to show to the person uploading."""


def prepare_image(uploaded_file):
    """Returns the bytes to upload: same picture, upright, resized if huge, no metadata."""
    if uploaded_file.size == 0:
        raise InvalidImage("This file is empty.")
    if uploaded_file.size > settings.PHOTO_UPLOAD_MAX_BYTES:
        limit = settings.PHOTO_UPLOAD_MAX_BYTES // (1024 * 1024)
        raise InvalidImage(f"This file is larger than the {limit} MB limit.")

    try:
        image = Image.open(uploaded_file, formats=list(_ALLOWED_FORMATS))
        # Opening only reads the header, so this check runs before the pixels are
        # decoded. A tiny file can otherwise expand to gigabytes in memory.
        width, height = image.size
        if width * height > settings.PHOTO_UPLOAD_MAX_PIXELS:
            raise InvalidImage("This image has too many pixels. Please use a smaller version.")
        image_format = image.format
        image.load()
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError) as exc:
        raise InvalidImage(_NOT_AN_IMAGE) from exc

    # Phones often store a sideways photo plus a tag saying to rotate it. The tag
    # is about to be removed, so apply it first.
    upright = ImageOps.exif_transpose(image)
    limit = settings.PHOTO_UPLOAD_MAX_DIMENSION
    upright.thumbnail((limit, limit))

    # Only the pixels carry over to this new image, and no metadata is passed to save().
    if image_format == "JPEG":
        mode = "RGB"
    else:
        mode = "RGBA" if "A" in upright.getbands() or "transparency" in upright.info else "RGB"
    clean = Image.new(mode, upright.size)
    clean.paste(upright.convert(mode))

    output = io.BytesIO()
    clean.save(output, format=image_format, **_ALLOWED_FORMATS[image_format])
    return output.getvalue()
