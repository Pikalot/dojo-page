from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from accounts.ratelimit import rate_limit_password_reset
from content import views

urlpatterns = [
    # The admin's login page shows a "forgotten password" link once the
    # admin_password_reset name exists. Public registration does not exist.
    path(
        "admin/password_reset/",
        rate_limit_password_reset(auth_views.PasswordResetView.as_view(
            extra_context={"site_header": admin.site.site_header},
        )),
        name="admin_password_reset",
    ),
    path("admin/password_reset/done/", auth_views.PasswordResetDoneView.as_view(), name="password_reset_done"),
    path("reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("reset/done/", auth_views.PasswordResetCompleteView.as_view(), name="password_reset_complete"),
    path("admin/", admin.site.urls),
    path("api/announcements", views.announcements, name="api-announcements"),
    path("api/schedule", views.schedule, name="api-schedule"),
    path("api/instructors", views.instructors, name="api-instructors"),
    path("api/faq", views.faq, name="api-faq"),
    path("api/dojo-photos", views.dojo_photos, name="api-dojo-photos"),
]
