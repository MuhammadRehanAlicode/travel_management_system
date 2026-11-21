from django.shortcuts import redirect
from django.urls import path
from . import views

urlpatterns = [
    path("", lambda r: redirect("/dashboard/")),
    path("login/", views.login_page, name="login"),
    path("dashboard/", views.app_page, {"module": "dashboard"}, name="dashboard"),
    path("reports/", views.app_page, {"module": "reports"}, name="reports"),
    path("settings/", views.app_page, {"module": "settings"}, name="settings"),
    path("company-settings/", views.app_page, {"module": "company"}, name="company"),
    path("<slug:module>/", views.app_page, name="module"),
]
