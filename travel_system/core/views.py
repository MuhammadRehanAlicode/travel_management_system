from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from . import models as m
from . import serializers as s
from .serializers import expiry_state

Z = Decimal("0")


def val(x):
    return x or Z


# ---------------------------------------------------------------- generic base
class BaseViewSet(viewsets.ModelViewSet):
    """Search (?search=), exact filters (?field=value), date range (?date_from=&date_to=)."""
    search_fields = []
    filter_fields = []
    date_field = None

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        q = p.get("search", "").strip()
        if q and self.search_fields:
            cond = Q()
            for f in self.search_fields:
                cond |= Q(**{f + "__icontains": q})
            qs = qs.filter(cond)
        for f in self.filter_fields:
            v = p.get(f)
            if v not in (None, "", "all"):
                if v in ("true", "false"):
                    v = v == "true"
                qs = qs.filter(**{f: v})
        if self.date_field:
            if p.get("date_from"):
                qs = qs.filter(**{self.date_field + "__gte": p["date_from"]})
            if p.get("date_to"):
                qs = qs.filter(**{self.date_field + "__lte": p["date_to"]})
        return qs


class CustomerViewSet(BaseViewSet):
    queryset = m.Customer.objects.all()
    serializer_class = s.CustomerSerializer
    search_fields = ["name", "email", "phone"]
    filter_fields = ["is_active"]

    def get_queryset(self):
        qs = super().get_queryset()
        bal = self.request.query_params.get("balance")
        if bal in ("receivable", "payable"):
            ids = [c.id for c in qs if (c.balance > 0) == (bal == "receivable") and c.balance != 0]
            qs = qs.filter(id__in=ids)
        return qs

    @action(detail=False)
    def summary(self, request):
        custs = list(m.Customer.objects.all())
        bals = [c.balance for c in custs]
        return Response({
            "total": len(custs),
            "receivable": sum((b for b in bals if b > 0), Z),
            "payable": sum((b for b in bals if b < 0), Z),
            "active": sum(1 for c in custs if c.is_active),
        })

    @action(detail=True)
    def ledger(self, request, pk=None):
        c = self.get_object()
        rows = []
        for t in c.trips.all():
            rows.append({"date": t.trip_date, "ref": t.trip_no, "desc": f"{t.origin} → {t.destination}",
                         "debit": t.total_amount, "credit": Z})
        for p in c.payments.all():
            if p.payment_type == "received":
                rows.append({"date": p.payment_date, "ref": p.reference or "Payment", "desc": p.title or "Payment received",
                             "debit": Z, "credit": p.amount})
            else:
                rows.append({"date": p.payment_date, "ref": p.reference or "Payment", "desc": p.title or "Payment paid out",
                             "debit": p.amount, "credit": Z})
        rows.sort(key=lambda r: r["date"])
        run = Z
        for r in rows:
            run += r["debit"] - r["credit"]
            r["balance"] = run
        return Response({"customer": c.name, "balance": run, "rows": rows})


class DriverViewSet(BaseViewSet):
    queryset = m.Driver.objects.all()
    serializer_class = s.DriverSerializer
    search_fields = ["name", "phone", "license_no"]
    filter_fields = ["is_active"]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        today = date.today()
        soon = today + timedelta(days=30)
        ls = p.get("license_status")
        if ls == "expired": qs = qs.filter(license_expiry__lt=today)
        elif ls == "expiring": qs = qs.filter(license_expiry__gte=today, license_expiry__lte=soon)
        elif ls == "valid": qs = qs.filter(license_expiry__gt=soon)
        lc = p.get("labor_status")
        if lc == "expired": qs = qs.filter(labor_card_expiry__lt=today)
        elif lc == "expiring": qs = qs.filter(labor_card_expiry__gte=today, labor_card_expiry__lte=soon)
        elif lc == "valid": qs = qs.filter(labor_card_expiry__gt=soon)
        return qs

    @action(detail=False)
    def summary(self, request):
        today = date.today(); soon = today + timedelta(days=30)
        d = m.Driver.objects
        return Response({
            "total": d.count(), "active": d.filter(is_active=True).count(),
            "license_expiring": d.filter(license_expiry__gte=today, license_expiry__lte=soon).count(),
            "license_expired": d.filter(license_expiry__lt=today).count(),
            "labor_expiring": d.filter(labor_card_expiry__gte=today, labor_card_expiry__lte=soon).count(),
        })

    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        d = self.get_object(); d.is_active = not d.is_active; d.save()
        return Response(s.DriverSerializer(d).data)

    @action(detail=True)
    def ledger(self, request, pk=None):
        d = self.get_object()
        rows, run = [], Z
        for e in d.expenses.order_by("expense_date", "id"):
            run += e.amount if e.entry_type == "credit" else -e.amount
            rows.append({"id": e.id, "date": e.expense_date, "category": e.category, "desc": e.description,
                         "credit": e.amount if e.entry_type == "credit" else Z,
                         "debit": e.amount if e.entry_type == "debit" else Z, "balance": run})
        return Response({"driver": d.name, "balance": run, "rows": rows})


class VehicleViewSet(BaseViewSet):
    queryset = m.Vehicle.objects.all()
    serializer_class = s.VehicleSerializer
    search_fields = ["number", "make_model", "owner_name"]
    filter_fields = ["status", "vehicle_type"]


class TripViewSet(BaseViewSet):
    queryset = m.Trip.objects.select_related("customer", "vehicle", "driver").prefetch_related("stops")
    serializer_class = s.TripSerializer
    search_fields = ["trip_no", "origin", "destination", "customer__name", "external_vehicle"]
    filter_fields = ["status", "customer", "driver", "vehicle", "load_type"]
    date_field = "trip_date"


class PaymentViewSet(BaseViewSet):
    queryset = m.Payment.objects.select_related("customer", "trip")
    serializer_class = s.PaymentSerializer
    search_fields = ["title", "reference", "customer__name", "notes"]
    filter_fields = ["payment_type", "mode", "customer"]
    date_field = "payment_date"

    @action(detail=False)
    def summary(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rec = val(qs.filter(payment_type="received").aggregate(x=Sum("amount"))["x"])
        paid = val(qs.filter(payment_type="paid").aggregate(x=Sum("amount"))["x"])
        return Response({"count": qs.count(), "received": rec, "paid": paid, "net": rec - paid})


class SalaryViewSet(BaseViewSet):
    queryset = m.Salary.objects.select_related("driver")
    serializer_class = s.SalarySerializer
    search_fields = ["driver__name"]
    filter_fields = ["driver", "is_paid"]
    date_field = "month"

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        sal = self.get_object(); sal.is_paid = True; sal.paid_date = date.today(); sal.save()
        return Response(s.SalarySerializer(sal).data)


class DriverExpenseViewSet(BaseViewSet):
    queryset = m.DriverExpense.objects.select_related("driver")
    serializer_class = s.DriverExpenseSerializer
    search_fields = ["driver__name", "description", "category"]
    filter_fields = ["driver", "entry_type"]
    date_field = "expense_date"

    @action(detail=False)
    def summary(self, request):
        drivers = m.Driver.objects.all()
        active = drivers.filter(is_active=True)
        bals = [d.expense_balance for d in active]
        return Response({
            "active_drivers": active.count(), "total_drivers": drivers.count(),
            "total_balance": sum(bals, Z), "total_expenses": m.DriverExpense.objects.count(),
            "avg_balance": (sum(bals, Z) / len(bals)) if bals else Z,
        })


class TrailerRentViewSet(BaseViewSet):
    queryset = m.TrailerRent.objects.select_related("trailer", "customer")
    serializer_class = s.TrailerRentSerializer
    search_fields = ["trailer__number", "customer__name"]
    filter_fields = ["status", "customer"]
    date_field = "start_date"


class InvoiceViewSet(BaseViewSet):
    queryset = m.Invoice.objects.select_related("customer", "trip")
    serializer_class = s.InvoiceSerializer
    search_fields = ["number", "customer__name"]
    filter_fields = ["status", "customer"]
    date_field = "issue_date"

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        inv = self.get_object()
        amt = Decimal(str(request.data.get("amount", 0) or 0))
        if amt <= 0:
            return Response({"amount": ["Enter an amount greater than zero."]}, status=400)
        inv.paid_amount += amt
        inv.status = "paid" if inv.paid_amount >= inv.amount else "partial"
        inv.save()
        m.Payment.objects.create(customer=inv.customer, trip=inv.trip, title=f"Invoice {inv.number}",
                                 payment_type="received", mode=request.data.get("mode", "cash"),
                                 amount=amt, reference=inv.number)
        return Response(s.InvoiceSerializer(inv).data)


class ExpenseViewSet(BaseViewSet):
    queryset = m.Expense.objects.select_related("vehicle")
    serializer_class = s.ExpenseSerializer
    search_fields = ["description", "vehicle__number"]
    filter_fields = ["category", "vehicle"]
    date_field = "expense_date"


class MaintenanceViewSet(BaseViewSet):
    queryset = m.Maintenance.objects.select_related("vehicle")
    serializer_class = s.MaintenanceSerializer
    search_fields = ["vehicle__number", "vendor", "description"]
    filter_fields = ["status", "maintenance_type", "vehicle"]
    date_field = "service_date"


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("username")
    serializer_class = s.UserSerializer
    permission_classes = [IsAdmin]

    def perform_destroy(self, inst):
        if inst == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot delete your own account.")
        inst.delete()


# ---------------------------------------------------------------- auth + misc API
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def api_login(request):
    user = authenticate(request, username=request.data.get("username"), password=request.data.get("password"))
    if not user or not user.is_active:
        return Response({"detail": "Invalid username or password."}, status=400)
    login(request, user)
    return Response({"username": user.username})


@api_view(["POST"])
def api_logout(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
def api_me(request):
    u = request.user
    return Response({"username": u.username, "email": u.email, "is_admin": u.is_superuser,
                     "company": s.CompanySettingsSerializer(m.CompanySettings.get()).data})


@api_view(["POST"])
def api_change_password(request):
    u = request.user
    if not u.check_password(request.data.get("current", "")):
        return Response({"current": ["Current password is incorrect."]}, status=400)
    new = request.data.get("new", "")
    if len(new) < 6:
        return Response({"new": ["Use at least 6 characters."]}, status=400)
    u.set_password(new); u.save()
    login(request, u)
    return Response({"ok": True})


@api_view(["GET", "PUT"])
def api_company(request):
    obj = m.CompanySettings.get()
    if request.method == "PUT":
        if not request.user.is_superuser:
            return Response({"detail": "Admins only."}, status=403)
        ser = s.CompanySettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
    return Response(s.CompanySettingsSerializer(obj).data)


@api_view(["GET"])
def api_dashboard(request):
    today = date.today(); soon = today + timedelta(days=30)
    custs = list(m.Customer.objects.all())
    bals = [c.balance for c in custs]
    month_start = today.replace(day=1)
    trips = m.Trip.objects
    expired, expiring = [], []

    def add(kind, name, label, d):
        st = expiry_state(d)
        if st == "expired":
            expired.append({"kind": kind, "name": name, "doc": label, "date": d, "days": (today - d).days})
        elif st == "expiring":
            expiring.append({"kind": kind, "name": name, "doc": label, "date": d, "days": (d - today).days})

    for v in m.Vehicle.objects.filter(status="active"):
        for f, label in m.Vehicle.DOC_FIELDS:
            add("vehicle", v.number, label, getattr(v, f))
    for d in m.Driver.objects.filter(is_active=True):
        add("driver", d.name, "License", d.license_expiry)
        add("driver", d.name, "Labor Card", d.labor_card_expiry)
    expired.sort(key=lambda x: x["days"]); expiring.sort(key=lambda x: x["days"])

    monthly = (m.Trip.objects.annotate(mth=TruncMonth("trip_date")).values("mth")
               .annotate(n=Count("id"), amt=Sum("total_amount")).order_by("-mth")[:6])
    return Response({
        "trips": {"total": trips.count(), "this_month": trips.filter(trip_date__gte=month_start).count(),
                  "completed": trips.filter(status="completed").count(),
                  "pending": trips.filter(status__in=["pending", "in_progress"]).count()},
        "vehicles": {"total": m.Vehicle.objects.count(), "active": m.Vehicle.objects.filter(status="active").count()},
        "drivers": {"total": m.Driver.objects.count(), "active": m.Driver.objects.filter(is_active=True).count()},
        "customers": {"total": len(custs), "receivable": sum((b for b in bals if b > 0), Z),
                      "payable": sum((b for b in bals if b < 0), Z)},
        "revenue_month": val(trips.filter(trip_date__gte=month_start).aggregate(x=Sum("total_amount"))["x"]),
        "overdue_invoices": m.Invoice.objects.filter(due_date__lt=today).exclude(status="paid").count(),
        "expired": expired, "expiring": expiring,
        "monthly": [{"month": r["mth"], "trips": r["n"], "amount": r["amt"]} for r in reversed(list(monthly))],
    })


@api_view(["GET"])
def api_reports(request):
    p = request.query_params
    df, dt = p.get("date_from"), p.get("date_to")

    def rng(qs, field):
        if df: qs = qs.filter(**{field + "__gte": df})
        if dt: qs = qs.filter(**{field + "__lte": dt})
        return qs

    trips = rng(m.Trip.objects.exclude(status="cancelled"), "trip_date")
    pays = rng(m.Payment.objects, "payment_date")
    exps = rng(m.Expense.objects, "expense_date")
    maint = rng(m.Maintenance.objects, "service_date")
    dexp = rng(m.DriverExpense.objects.filter(entry_type="debit"), "expense_date")
    sal = rng(m.Salary.objects.filter(is_paid=True), "month")

    revenue = val(trips.aggregate(x=Sum("total_amount"))["x"])
    c_exp = val(exps.aggregate(x=Sum("amount"))["x"])
    c_main = val(maint.aggregate(x=Sum("cost"))["x"])
    c_dexp = val(dexp.aggregate(x=Sum("amount"))["x"])
    c_sal = sum((x.net for x in sal), Z)
    total_cost = c_exp + c_main + c_dexp + c_sal

    by_customer = list(trips.values("customer__name").annotate(trips=Count("id"), amount=Sum("total_amount")).order_by("-amount")[:10])
    by_vehicle = list(trips.exclude(vehicle=None).values("vehicle__number").annotate(trips=Count("id"), amount=Sum("total_amount")).order_by("-amount")[:10])
    by_driver = list(trips.exclude(driver=None).values("driver__name").annotate(trips=Count("id"), amount=Sum("total_amount")).order_by("-amount")[:10])
    exp_cat = list(exps.values("category").annotate(amount=Sum("amount")).order_by("-amount"))
    return Response({
        "summary": {"revenue": revenue, "expenses": c_exp, "maintenance": c_main, "driver_expenses": c_dexp,
                    "salaries": c_sal, "total_cost": total_cost, "profit": revenue - total_cost,
                    "trips": trips.count(),
                    "received": val(pays.filter(payment_type="received").aggregate(x=Sum("amount"))["x"]),
                    "paid": val(pays.filter(payment_type="paid").aggregate(x=Sum("amount"))["x"])},
        "by_customer": [{"name": r["customer__name"], "trips": r["trips"], "amount": r["amount"]} for r in by_customer],
        "by_vehicle": [{"name": r["vehicle__number"], "trips": r["trips"], "amount": r["amount"]} for r in by_vehicle],
        "by_driver": [{"name": r["driver__name"], "trips": r["trips"], "amount": r["amount"]} for r in by_driver],
        "expense_categories": exp_cat,
    })


# ---------------------------------------------------------------- HTML pages
MODULES = {
    "customers": "Customers", "vehicles": "Vehicles", "trips": "Trips", "payments": "Payments",
    "drivers": "Drivers", "salaries": "Salaries", "driver-expenses": "Driver Expenses",
    "trailer-rents": "Trailer Rents", "invoices": "Invoices", "expenses": "Expenses",
    "maintenance": "Maintenance", "user-management": "User Management",
}


@ensure_csrf_cookie
def login_page(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return render(request, "login.html")


@ensure_csrf_cookie
def app_page(request, module="dashboard"):
    if not request.user.is_authenticated:
        return redirect("/login/?next=" + request.path)
    return render(request, "app.html", {"module": module, "title": MODULES.get(module, module.title())})
