"""Rate limits for login and password reset, counted in Django's cache.

Limitation: the default cache is per process. With several server processes,
each counts separately, so production should run one process or configure a
shared cache. See CLIENT_IP_HEADER in settings for where client addresses come from.
"""
import hashlib
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.template.response import TemplateResponse


def client_ip(request):
    if settings.CLIENT_IP_HEADER:
        forwarded = request.META.get(settings.CLIENT_IP_HEADER, "").strip()
        if forwarded:
            return forwarded
    return request.META.get("REMOTE_ADDR", "")


def _key(scope, value):
    # Hashed: usernames are user input, and cache keys have character limits.
    return f"ratelimit:{scope}:{hashlib.sha256(value.encode()).hexdigest()}"


def is_blocked(scope, value, limit):
    return cache.get(_key(scope, value), 0) >= limit


def record_attempt(scope, value, window):
    key = _key(scope, value)
    cache.add(key, 0, window)  # Does nothing if already there, so the window doesn't slide.
    try:
        cache.incr(key)
    except ValueError:  # It expired between the two calls.
        cache.set(key, 1, window)


def reset(scope, value):
    cache.delete(_key(scope, value))


def rate_limited_response(request):
    return TemplateResponse(request, "admin/accounts/rate_limited.html", {"title": "Too many attempts"}, status=429)


def login_identities(request):
    """Returns [(scope, value, limit, window)] for a login attempt. Both matter:
    per account stops guessing one password, per IP stops trying many accounts."""
    username = request.POST.get("username", "").strip().lower()
    ip = client_ip(request)
    per_account = settings.LOGIN_RATE_LIMIT_PER_ACCOUNT
    per_ip = settings.LOGIN_RATE_LIMIT_PER_IP
    # Account and IP together, so an attacker can't lock a real user out from elsewhere.
    return [
        ("login-account", f"{ip}|{username}", *per_account),
        ("login-ip", ip, *per_ip),
    ]


def rate_limit_password_reset(view):
    """Only sending counts, so it can't be used to flood someone's inbox."""

    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if request.method != "POST":
            return view(request, *args, **kwargs)
        limit, window = settings.PASSWORD_RESET_RATE_LIMIT
        ip = client_ip(request)
        if is_blocked("password-reset", ip, limit):
            return rate_limited_response(request).render()
        record_attempt("password-reset", ip, window)
        return view(request, *args, **kwargs)

    return wrapper
