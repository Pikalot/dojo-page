from django.contrib.admin.apps import AdminConfig


class DojoAdminConfig(AdminConfig):
    default_site = "accounts.admin_site.DojoAdminSite"
