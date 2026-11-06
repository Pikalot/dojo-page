"""Production server settings. Gunicorn reads this file when started from backend/."""

# Only Nginx on this machine may connect. Reaching Gunicorn directly would let
# anyone fake the X-Real-IP header that rate limits rely on.
bind = "127.0.0.1:8000"

# One process, because rate limits are counted per process in the default cache.
# Threads still let it handle several requests at once.
workers = 1
threads = 4

# Long enough for a large photo upload through Django to Cloudinary.
timeout = 120

accesslog = "-"
errorlog = "-"
