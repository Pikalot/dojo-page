from django.contrib.admin import AdminSite

from . import ratelimit


class DojoAdminSite(AdminSite):
    site_header = "Tenshinkai Aikido administration"
    site_title = "Tenshinkai Aikido"
    index_title = "Site content"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # It deletes without a version check, and without the per-object
        # confirmation. Content is deleted one record at a time.
        self.disable_action("delete_selected")

    def login(self, request, extra_context=None):
        if request.method != "POST":
            return super().login(request, extra_context)

        identities = ratelimit.login_identities(request)
        # Checked before authenticating, so a blocked guess learns nothing.
        if any(ratelimit.is_blocked(scope, value, limit) for scope, value, limit, _ in identities):
            return ratelimit.rate_limited_response(request)

        response = super().login(request, extra_context)
        if request.user.is_authenticated and request.user.is_staff:
            # Only the per-account count: a success must not excuse guessing
            # against other accounts from the same address.
            scope, value, _, _ = identities[0]
            ratelimit.reset(scope, value)
        else:
            for scope, value, _, window in identities:
                ratelimit.record_attempt(scope, value, window)
        return response
