from datetime import date
from django.contrib.auth.models import User
from rest_framework import serializers
from . import models as m


def expiry_state(d, soon_days=30):
    if not d:
        return None
    delta = (d - date.today()).days
    if delta < 0:
        return "expired"
    if delta <= soon_days:
        return "expiring"
    return "valid"


class CustomerSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    trips_count = serializers.SerializerMethodField()
    payments_count = serializers.SerializerMethodField()
    invoices_count = serializers.SerializerMethodField()

    class Meta:
        model = m.Customer
        fields = ["id", "name", "email", "phone", "address", "is_active", "balance",
                  "trips_count", "payments_count", "invoices_count"]

    def get_trips_count(self, o): return o.trips.count()
    def get_payments_count(self, o): return o.payments.count()
    def get_invoices_count(self, o): return o.invoices.count()


class DriverSerializer(serializers.ModelSerializer):
    license_state = serializers.SerializerMethodField()
    labor_card_state = serializers.SerializerMethodField()
    license_days_left = serializers.SerializerMethodField()
    trips_count = serializers.SerializerMethodField()
    completed_trips = serializers.SerializerMethodField()
    earnings = serializers.SerializerMethodField()
    expense_balance = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    expenses_count = serializers.SerializerMethodField()

    class Meta:
        model = m.Driver
        fields = "__all__"

    def get_license_state(self, o): return expiry_state(o.license_expiry)
    def get_labor_card_state(self, o): return expiry_state(o.labor_card_expiry)
    def get_license_days_left(self, o): return (o.license_expiry - date.today()).days if o.license_expiry else None
    def get_trips_count(self, o): return o.trips.count()
    def get_completed_trips(self, o): return o.trips.filter(status="completed").count()
    def get_expenses_count(self, o): return o.expenses.count()

    def get_earnings(self, o):
        from django.db.models import Sum
        return o.trips.filter(status="completed").aggregate(s=Sum("total_amount"))["s"] or 0


class VehicleSerializer(serializers.ModelSerializer):
    doc_issues = serializers.SerializerMethodField()
    trips_count = serializers.SerializerMethodField()

    class Meta:
        model = m.Vehicle
        fields = "__all__"

    def get_trips_count(self, o): return o.trips.count()

    def get_doc_issues(self, o):
        out = []
        for field, label in m.Vehicle.DOC_FIELDS:
            st = expiry_state(getattr(o, field))
            if st in ("expired", "expiring"):
                out.append({"doc": label, "state": st, "date": getattr(o, field)})
        return out


class TripStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.TripStop
        fields = ["id", "sequence", "location", "load_tons", "amount", "notes"]


class TripSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    vehicle_number = serializers.CharField(source="vehicle.number", read_only=True, default=None)
    driver_name = serializers.CharField(source="driver.name", read_only=True, default=None)
    paid_amount = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    balance = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    stops = TripStopSerializer(many=True, required=False)

    class Meta:
        model = m.Trip
        fields = "__all__"
        read_only_fields = ["trip_no"]

    def _save_stops(self, trip, stops):
        trip.stops.all().delete()
        total = 0
        for i, s in enumerate(stops, 1):
            s.pop("id", None)
            s["sequence"] = s.get("sequence") or i
            m.TripStop.objects.create(trip=trip, **s)
            total += s.get("amount") or 0
        if stops:
            trip.is_multi_stop = True
            if not trip.total_amount:
                trip.total_amount = total
            trip.save()

    def create(self, data):
        stops = data.pop("stops", [])
        trip = super().create(data)
        if stops:
            self._save_stops(trip, stops)
        return trip

    def update(self, inst, data):
        stops = data.pop("stops", None)
        trip = super().update(inst, data)
        if stops is not None:
            self._save_stops(trip, stops)
        return trip


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    trip_no = serializers.CharField(source="trip.trip_no", read_only=True, default=None)

    class Meta:
        model = m.Payment
        fields = "__all__"

    def validate_amount(self, v):
        if v <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return v


class SalarySerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.name", read_only=True)
    net = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = m.Salary
        fields = "__all__"


class DriverExpenseSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.name", read_only=True)

    class Meta:
        model = m.DriverExpense
        fields = "__all__"


class TrailerRentSerializer(serializers.ModelSerializer):
    trailer_number = serializers.CharField(source="trailer.number", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = m.TrailerRent
        fields = "__all__"


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    trip_no = serializers.CharField(source="trip.trip_no", read_only=True, default=None)
    balance = serializers.SerializerMethodField()

    class Meta:
        model = m.Invoice
        fields = "__all__"
        read_only_fields = ["number"]

    def get_balance(self, o): return o.amount - o.paid_amount


class ExpenseSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.number", read_only=True, default=None)

    class Meta:
        model = m.Expense
        fields = "__all__"


class MaintenanceSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.number", read_only=True)

    class Meta:
        model = m.Maintenance
        fields = "__all__"


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.CompanySettings
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[("admin", "Admin"), ("staff", "Staff")], required=False)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "is_active", "password", "role", "last_login"]
        read_only_fields = ["last_login"]

    def to_representation(self, o):
        data = super().to_representation(o)
        data["role"] = "admin" if o.is_superuser else "staff"
        return data

    def create(self, data):
        role = data.pop("role", "staff")
        pwd = data.pop("password", "") or None
        if not pwd:
            raise serializers.ValidationError({"password": "Password is required."})
        user = User(**data)
        user.set_password(pwd)
        user.is_superuser = role == "admin"
        user.is_staff = True
        user.save()
        return user

    def update(self, inst, data):
        role = data.pop("role", None)
        pwd = data.pop("password", None)
        for k, v in data.items():
            setattr(inst, k, v)
        if pwd:
            inst.set_password(pwd)
        if role:
            inst.is_superuser = role == "admin"
        inst.save()
        return inst
