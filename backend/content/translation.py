"""Translation between English and Vietnamese through Azure Translator.

Only staff reach this, through content/translate_views.py, and the key stays on
the server. Text is translated when an editor leaves a field, never on page view.
"""
import html
import json
import logging
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request

import certifi
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger("dojo.content")

LANGUAGES = ("en", "vi")
_TIMEOUT_SECONDS = 10
# Python's installer for macOS ships without trusted certificates, so the default
# would fail there with CERTIFICATE_VERIFY_FAILED. Verification stays on.
_TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_CACHE_PREFIX = "translation-characters"

# Stay as written in both languages. Longer terms first, so "Kyu-shinsa" isn't
# split by a shorter match.
GLOSSARY = sorted(
    [
        "Tenshinkai", "Aikikai", "Hombu", "Aikido", "Aikidō", "aikidoka", "aikidōka",
        "Rokudan", "Godan", "Yondan", "Sandan", "Nidan", "Shodan",
        "Kyu-shinsa", "Dan-shinsa", "shinsa", "konin",
        "keikogi", "hakama", "ukemi", "seiza", "sensei",
    ],
    key=len,
    reverse=True,
)
_GLOSSARY_PATTERN = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(term) for term in GLOSSARY) + r")(?!\w)", re.IGNORECASE
)
_PROTECT_TAG = re.compile(r"</?span[^>]*>", re.IGNORECASE)


class TranslationError(Exception):
    """Base class. Nothing here should ever stop an editor from saving."""


class InvalidTranslationRequest(TranslationError):
    pass


class TextTooLong(TranslationError):
    pass


class TranslationNotConfigured(TranslationError):
    pass


class TranslationLimitReached(TranslationError):
    """The daily budget or the provider's quota or rate limit."""


class TranslationFailed(TranslationError):
    """Details are logged, not carried here: this reaches the editor."""


def is_configured():
    return bool(settings.AZURE_TRANSLATOR_KEY)


def _to_markup(line):
    """Escapes a line for HTML mode, which Azure needs for protecting terms."""
    return _GLOSSARY_PATTERN.sub(
        lambda match: f'<span class="notranslate">{match.group(0)}</span>',
        html.escape(line, quote=False),
    )


def _from_markup(text):
    return html.unescape(_PROTECT_TAG.sub("", text))


def _spend_budget(characters):
    """Refuses once today's budget is used, so one busy day can't drain the month."""
    key = f"{_CACHE_PREFIX}:{timezone.now().date().isoformat()}"
    cache.add(key, 0, 25 * 60 * 60)
    try:
        spent = cache.incr(key, characters)
    except ValueError:  # It expired between the two calls.
        cache.set(key, characters, 25 * 60 * 60)
        spent = characters
    if spent > settings.TRANSLATION_DAILY_CHARACTER_LIMIT:
        raise TranslationLimitReached


def _call_azure(lines, source, target):
    query = urllib.parse.urlencode(
        {"api-version": "3.0", "from": source, "to": target, "textType": "html"}
    )
    headers = {
        "Ocp-Apim-Subscription-Key": settings.AZURE_TRANSLATOR_KEY,
        "Content-Type": "application/json; charset=UTF-8",
    }
    if settings.AZURE_TRANSLATOR_REGION:
        headers["Ocp-Apim-Subscription-Region"] = settings.AZURE_TRANSLATOR_REGION
    request = urllib.request.Request(
        f"{settings.AZURE_TRANSLATOR_ENDPOINT}?{query}",
        data=json.dumps([{"text": _to_markup(line)} for line in lines]).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS, context=_TLS_CONTEXT) as response:  # noqa: S310
            results = json.load(response)
        return [_from_markup(result["translations"][0]["text"]) for result in results]
    except urllib.error.HTTPError as exc:
        logger.error("Azure Translator responded with %s", exc.code)
        # 403: free quota used up. 429: too many requests.
        if exc.code in (403, 429):
            raise TranslationLimitReached from exc
        raise TranslationFailed from exc
    except urllib.error.URLError as exc:
        # The reason says why the connection failed. It holds no key or text.
        logger.error("Could not reach Azure Translator: %s", exc.reason)
        raise TranslationFailed from exc
    except (TimeoutError, OSError, ValueError, KeyError, IndexError, TypeError) as exc:
        logger.error("Azure Translator request failed: %s", type(exc).__name__)
        raise TranslationFailed from exc


def translate(text, source, target):
    """Returns text in the target language, keeping its line breaks."""
    if source not in LANGUAGES or target not in LANGUAGES or source == target:
        raise InvalidTranslationRequest
    if not isinstance(text, str):
        raise InvalidTranslationRequest
    if len(text) > settings.TRANSLATION_MAX_CHARACTERS:
        raise TextTooLong
    if not text.strip():
        return ""
    if not is_configured():
        raise TranslationNotConfigured

    # Line by line, because HTML mode may not keep line breaks, and paragraphs
    # on the site depend on them. Blank lines aren't sent.
    lines = text.split("\n")
    filled = [index for index, line in enumerate(lines) if line.strip()]
    if len(filled) > 1000:  # Azure's limit per request.
        raise TextTooLong
    _spend_budget(sum(len(lines[index]) for index in filled))

    translated = _call_azure([lines[index] for index in filled], source, target)
    if len(translated) != len(filled):
        logger.error("Azure Translator returned the wrong number of lines")
        raise TranslationFailed
    for index, line in zip(filled, translated):
        lines[index] = line
    return "\n".join(lines)
