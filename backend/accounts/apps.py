from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccountsConfig(AppConfig):
    name = "accounts"
    default_auto_field = "django.db.models.AutoField"

    def ready(self):
        from .roles import sync_role_groups

        # After migrate, because permissions are only created at that point.
        post_migrate.connect(sync_role_groups, sender=self)
