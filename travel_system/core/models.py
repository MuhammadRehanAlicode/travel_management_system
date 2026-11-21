from datetime import date
from decimal import Decimal
from django.db import models
from django.db.models import Sum


def money(v):
    return v if v is not None else Decimal("0")


class Customer(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def balance(self):
        """Positive = customer owes us (receivable). Negative = we owe customer (payable)."""
        billed = money(self.trips.aggregate(s=Sum("total_amount"))["s"])
        received = money(self.payments.filter(payment_type="received").aggregate(s=Sum("amount"))["s"])
        paid = money(self.payments.filter(payment_type="paid").aggregate(s=Sum("amount"))["s"])
        return billed - received + paid


class Driver(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=40, blank=True)
    license_no = models.CharField(max_length=60, blank=True)
    license_expiry = models.DateField(null=True, blank=True)
    labor_card_no = models.CharField(max_length=60, blank=True)
    labor_card_expiry = models.DateField(null=True, blank=True)
    joined_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def expense_balance(self):
        credit = money(self.expenses.filter(entry_type="credit").aggregate(s=Sum("amount"))["s"])
        debit = money(self.expenses.filter(entry_type="debit").aggregate(s=Sum("amount"))["s"])
        return credit - debit


class Vehicle(models.Model):
    TYPES = [("truck", "Truck"), ("trailer", "Trailer"), ("pickup", "Pickup"), ("bus", "Bus"), ("other", "Other")]
    STATUSES = [("active", "Active"), ("inactive", "Inactive"), ("maintenance", "Maintenance")]
    DOC_FIELDS = [("insurance_expiry", "Insurance"), ("fitness_expiry", "Fitness"),
                  ("permit_expiry", "Permit"), ("mulkiya_expiry", "Mulkiya"),
                  ("operating_card_expiry", "Operating Card")]

    number = models.CharField(max_length=40, unique=True)
    owner_name = models.CharField(max_length=150, blank=True)
    make_model = models.CharField(max_length=120, blank=True)
    vehicle_type = models.CharField(max_length=20, choices=TYPES, default="truck")
    capacity_tons = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    fuel_type = models.CharField(max_length=30, default="Diesel")
    status = models.CharField(max_length=20, choices=STATUSES, default="active")
    notes = models.TextField(blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    fitness_expiry = models.DateField(null=True, blank=True)
    permit_expiry = models.DateField(null=True, blank=True)
    mulkiya_expiry = models.DateField(null=True, blank=True)
    operating_card_expiry = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["number"]

    def __str__(self):
        return self.number


class Trip(models.Model):
    STATUSES = [("pending", "Pending"), ("in_progress", "In Progress"),
                ("completed", "Completed"), ("cancelled", "Cancelled")]
    LOAD_TYPES = [("receiving", "Receiving"), ("delivery", "Delivery")]

    trip_no = models.CharField(max_length=20, unique=True, blank=True)
    trip_date = models.DateField(default=date.today)
    origin = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="trips")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="trips")
    external_vehicle = models.CharField(max_length=60, blank=True)
    driver = models.ForeignKey(Driver, null=True, blank=True, on_delete=models.SET_NULL, related_name="trips")
    load_type = models.CharField(max_length=20, choices=LOAD_TYPES, default="receiving")
    direction = models.CharField(max_length=20, default="Inbound")
    load_tons = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    status = models.CharField(max_length=20, choices=STATUSES, default="pending")
    is_multi_stop = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.trip_no:
            self.trip_no = f"TRIP-{self.pk:03d}"
            super().save(update_fields=["trip_no"])

    def __str__(self):
        return self.trip_no

    @property
    def paid_amount(self):
        return money(self.payments.filter(payment_type="received").aggregate(s=Sum("amount"))["s"])

    @property
    def balance(self):
        return self.total_amount - self.paid_amount


class TripStop(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="stops")
    sequence = models.PositiveIntegerField(default=1)
    location = models.CharField(max_length=200)
    load_tons = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["trip", "sequence"]


class Payment(models.Model):
    TYPES = [("received", "Received"), ("paid", "Paid")]
    MODES = [("cash", "Cash"), ("bank_transfer", "Bank Transfer"), ("cheque", "Cheque"), ("card", "Card")]

    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    trip = models.ForeignKey(Trip, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    title = models.CharField(max_length=200, blank=True)
    payment_type = models.CharField(max_length=10, choices=TYPES, default="received")
    mode = models.CharField(max_length=20, choices=MODES, default="cash")
    amount = models.DecimalField(max_digits=12, decimal_places=3)
    payment_date = models.DateField(default=date.today)
    reference = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-payment_date", "-id"]


class Salary(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="salaries")
    month = models.DateField(help_text="First day of the salary month")
    basic = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    allowance = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    deduction = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-month", "driver__name"]
        unique_together = ("driver", "month")

    @property
    def net(self):
        return self.basic + self.allowance - self.deduction


class DriverExpense(models.Model):
    ENTRY = [("credit", "Credit (given to driver)"), ("debit", "Debit (spent by driver)")]
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="expenses")
    expense_date = models.DateField(default=date.today)
    entry_type = models.CharField(max_length=10, choices=ENTRY, default="debit")
    category = models.CharField(max_length=80, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=3)
    description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-expense_date", "-id"]


class TrailerRent(models.Model):
    STATUSES = [("active", "Active"), ("returned", "Returned"), ("overdue", "Overdue")]
    trailer = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="rents")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="trailer_rents")
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(null=True, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    status = models.CharField(max_length=20, choices=STATUSES, default="active")
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-start_date", "-id"]

    @property
    def total_amount(self):
        end = self.end_date or date.today()
        days = max((end - self.start_date).days, 0) + 1
        return self.daily_rate * days


class Invoice(models.Model):
    STATUSES = [("draft", "Draft"), ("sent", "Sent"), ("partial", "Partially Paid"),
                ("paid", "Paid"), ("overdue", "Overdue")]
    number = models.CharField(max_length=30, unique=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="invoices")
    trip = models.ForeignKey(Trip, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    issue_date = models.DateField(default=date.today)
    due_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=3)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    status = models.CharField(max_length=20, choices=STATUSES, default="draft")
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-id"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.number:
            self.number = f"INV-{self.pk:05d}"
            super().save(update_fields=["number"])


class Expense(models.Model):
    CATS = [("fuel", "Fuel"), ("toll", "Toll"), ("office", "Office"), ("salary", "Salary"),
            ("rent", "Rent"), ("insurance", "Insurance"), ("other", "Other")]
    expense_date = models.DateField(default=date.today)
    category = models.CharField(max_length=20, choices=CATS, default="other")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    amount = models.DecimalField(max_digits=12, decimal_places=3)
    description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-expense_date", "-id"]


class Maintenance(models.Model):
    TYPES = [("service", "Service"), ("repair", "Repair"), ("tyres", "Tyres"),
             ("oil", "Oil Change"), ("other", "Other")]
    STATUSES = [("scheduled", "Scheduled"), ("in_progress", "In Progress"), ("done", "Done")]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="maintenance")
    service_date = models.DateField(default=date.today)
    maintenance_type = models.CharField(max_length=20, choices=TYPES, default="service")
    status = models.CharField(max_length=20, choices=STATUSES, default="done")
    cost = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    vendor = models.CharField(max_length=150, blank=True)
    next_due = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-service_date", "-id"]


class CompanySettings(models.Model):
    name = models.CharField(max_length=200, default="My Logistics Company")
    currency = models.CharField(max_length=10, default="OMR")
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
