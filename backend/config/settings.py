"""Django settings. Everything secret or environment-specific comes from the
environment (or backend/.env locally); see .env.example."""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_required(name):
    value = os.environ.get(name)
    if not value:
        raise ImproperlyConfigured(f"Set the {name} environment variable (see .env.example).")
    return value


def env_list(name):
    return [item.strip() for item in os.environ.get(name, "").split(",") if item.strip()]


SECRET_KEY = env_required("DJANGO_SECRET_KEY")
# Off unless explicitly turned on, so a missing variable can't expose debug pages.
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "config.apps.DojoAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "content",
    # Last: its post_migrate step needs every other app's permissions to exist.
    "accounts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("DB_NAME", "Tenshinkai"),
        "USER": env_required("DB_USER"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            # Strict mode rejects oversized values instead of silently cutting
            # them. UTC keeps database defaults consistent with Django's times.
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES', time_zone='+00:00'",
            # Spelled out because the version check depends on it: a concurrent
            # commit must be visible to this transaction's conditional UPDATE
            # and to the re-read that explains why it matched no row.
            "isolation_level": "read committed",
        },
        "TEST": {"CHARSET": "utf8mb4", "COLLATION": "utf8mb4_unicode_ci"},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Los_Angeles"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

LOGIN_URL = "admin:login"

if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = True
    DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Photo upload. The API secret stays on the server; see content/cloudinary_client.py.
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")
PHOTO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
PHOTO_UPLOAD_MAX_PIXELS = 50_000_000
PHOTO_UPLOAD_MAX_DIMENSION = 2400  # Longest side after resizing; plenty for a full-screen viewer.

# Automatic translation. The key stays on the server; see content/translation.py.
AZURE_TRANSLATOR_KEY = os.environ.get("AZURE_TRANSLATOR_KEY", "")
AZURE_TRANSLATOR_REGION = os.environ.get("AZURE_TRANSLATOR_REGION", "")
AZURE_TRANSLATOR_ENDPOINT = os.environ.get(
    "AZURE_TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com/translate"
)
TRANSLATION_MAX_CHARACTERS = 5000
# About a thirtieth of the 2 million free characters a month.
TRANSLATION_DAILY_CHARACTER_LIMIT = 60_000

# Sensitive endpoints: (allowed attempts, window in seconds). See accounts/ratelimit.py.
LOGIN_RATE_LIMIT_PER_ACCOUNT = (5, 15 * 60)
LOGIN_RATE_LIMIT_PER_IP = (20, 15 * 60)
PASSWORD_RESET_RATE_LIMIT = (5, 60 * 60)
PHOTO_UPLOAD_RATE_LIMIT = (100, 60 * 60)  # Per user. Protects the Cloudinary quota.
TRANSLATION_RATE_LIMIT = (200, 60 * 60)  # Per user. Protects the translation quota.

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# Where rate limits read the visitor's address. Empty means REMOTE_ADDR.
CLIENT_IP_HEADER = ""

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    # The HTTPS proxy in front of Django must set this header and strip any
    # copy sent by the client; otherwise visitors could claim to be on HTTPS.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # Behind a proxy, REMOTE_ADDR is the proxy, so every visitor would share one
    # rate limit. The proxy must overwrite this header with the real address, and
    # Django must not be reachable except through it, or visitors could fake it.
    CLIENT_IP_HEADER = "HTTP_X_REAL_IP"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "dojo": {"handlers": ["console"], "level": "INFO"},
    },
}
