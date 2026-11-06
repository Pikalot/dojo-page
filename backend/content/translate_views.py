"""The admin's translation endpoint. Wrapped in admin_view in config/urls.py, which
requires a signed-in staff user and a CSRF token."""
import json

from django.conf import settings
from django.http import HttpResponseNotAllowed, JsonResponse

from accounts import ratelimit

from . import translation


def translate_view(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    def failed(message, status):
        return JsonResponse({"error": message}, status=status)

    try:
        payload = json.loads(request.body)
        text, source, target = payload["text"], payload["source"], payload["target"]
    except (ValueError, KeyError, TypeError):
        return failed("Invalid request.", 400)

    limit, window = settings.TRANSLATION_RATE_LIMIT
    user_key = str(request.user.pk)
    if ratelimit.is_blocked("translate", user_key, limit):
        return failed("Too many translations. Please wait a while.", 429)
    ratelimit.record_attempt("translate", user_key, window)

    try:
        return JsonResponse({"translation": translation.translate(text, source, target)})
    except translation.InvalidTranslationRequest:
        return failed("Invalid request.", 400)
    except translation.TextTooLong:
        return failed("This text is too long to translate automatically.", 413)
    except translation.TranslationNotConfigured:
        return failed("Automatic translation isn't set up yet.", 503)
    except translation.TranslationLimitReached:
        return failed("The translation limit has been reached for now.", 429)
    except translation.TranslationFailed:
        return failed("The translation service didn't respond.", 502)
