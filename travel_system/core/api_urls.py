from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views as v

router = DefaultRouter()
router.register("customers", v.CustomerViewSet)
router.register("vehicles", v.VehicleViewSet)
router.register("trips", v.TripViewSet)
router.register("payments", v.PaymentViewSet)
router.register("drivers", v.DriverViewSet)
router.register("salaries", v.SalaryViewSet)
router.register("driver-expenses", v.DriverExpenseViewSet)
router.register("trailer-rents", v.TrailerRentViewSet)
router.register("invoices", v.InvoiceViewSet)
router.register("expenses", v.ExpenseViewSet)
router.register("maintenance", v.MaintenanceViewSet)
router.register("users", v.UserViewSet)

urlpatterns = [
    path("auth/login/", v.api_login),
    path("auth/logout/", v.api_logout),
    path("auth/me/", v.api_me),
    path("auth/change-password/", v.api_change_password),
    path("company/", v.api_company),
    path("dashboard/", v.api_dashboard),
    path("reports/", v.api_reports),
    path("", include(router.urls)),
]
