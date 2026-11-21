import random
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from core import models as m


class Command(BaseCommand):
    help = "Create an admin user and demo data (fictional)."

    def handle(self, *args, **opts):
        random.seed(7)
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.com", "admin123")
        c = m.CompanySettings.get()
        c.name = "Demo Trade & Logistics"; c.currency = "OMR"; c.save()
        if m.Customer.objects.exists():
            self.stdout.write("Demo data already present."); return
        today = date.today()
        customers = [m.Customer.objects.create(name=n, phone=f"9{random.randint(1000000, 9999999)}",
                     email=f"{n.split()[0].lower()}@example.com", is_active=i % 4 != 3)
                     for i, n in enumerate(["Al Noor Dairy", "Gulf Egg Farm", "Desert Bay Beverages", "Sohar Steel Works",
                                            "Muscat Freight Co", "Salalah Water", "Oman Fresh Produce", "Nizwa Building Supplies"])]
        drivers = []
        for i, n in enumerate(["Ahmed Khan", "Bilal Raza", "Imran Ali", "Farhan Shah", "Kamran Butt", "Usman Tariq"]):
            drivers.append(m.Driver.objects.create(
                name=n, phone=f"7{random.randint(1000000, 9999999)}", license_no=str(100000 + i * 1111),
                license_expiry=today + timedelta(days=random.choice([-20, 10, 120, 300, 500])),
                labor_card_no=str(200000 + i * 777), labor_card_expiry=today + timedelta(days=random.choice([-5, 20, 200, 400])),
                joined_date=today - timedelta(days=random.randint(100, 900)), is_active=i != 5))
        vehicles = []
        for i, (num, t) in enumerate([("1092-DK", "trailer"), ("1192-WB", "truck"), ("2170-RH", "trailer"),
                                      ("2203-ML", "trailer"), ("4066-DA", "trailer"), ("5074-YR", "truck"), ("7513-DA", "truck")]):
            vehicles.append(m.Vehicle.objects.create(
                number=num, owner_name="Company", make_model=random.choice(["Volvo 420", "Scania R", "Mercedes Actros"]),
                vehicle_type=t, capacity_tons=30, status="active",
                insurance_expiry=today + timedelta(days=random.choice([-10, 25, 200])),
                fitness_expiry=today + timedelta(days=random.choice([-30, 40, 250])),
                permit_expiry=today + timedelta(days=random.choice([15, 180])),
                mulkiya_expiry=today + timedelta(days=random.choice([-3, 90, 365])),
                operating_card_expiry=today + timedelta(days=random.choice([-60, 100, 300]))))
        places = ["Muscat", "Salalah", "Sohar", "Nizwa", "Sur", "Duqm"]
        for i in range(40):
            o, d = random.sample(places, 2)
            amt = Decimal(random.choice([250, 350, 420, 600, 850]))
            t = m.Trip.objects.create(
                trip_date=today - timedelta(days=random.randint(0, 200)), origin=o, destination=d,
                customer=random.choice(customers), vehicle=random.choice(vehicles), driver=random.choice(drivers[:5]),
                load_tons=random.choice([12, 20, 26, 30]), distance_km=random.choice([0, 300, 850, 1000]),
                total_amount=amt, status=random.choice(["completed"] * 4 + ["pending", "in_progress"]))
            if i % 3 == 0:
                m.Payment.objects.create(customer=t.customer, trip=t, title="Trip payment", payment_type="received",
                                         mode=random.choice(["cash", "bank_transfer"]), amount=amt, payment_date=t.trip_date,
                                         reference=t.trip_no)
        for cu in customers[:3]:
            m.Payment.objects.create(customer=cu, title="Advance", payment_type="paid", mode="cash", amount=50)
        for d in drivers[:5]:
            for _ in range(4):
                m.DriverExpense.objects.create(driver=d, entry_type=random.choice(["credit", "debit"]),
                                               category=random.choice(["Fuel", "Toll", "Food"]),
                                               amount=random.choice([10, 25, 40, 100]),
                                               expense_date=today - timedelta(days=random.randint(0, 60)))
            m.Salary.objects.create(driver=d, month=today.replace(day=1), basic=300, allowance=50, deduction=0)
        for v in vehicles[:4]:
            m.Maintenance.objects.create(vehicle=v, maintenance_type="service", cost=random.choice([40, 120, 300]),
                                         vendor="City Garage", next_due=today + timedelta(days=60))
            m.Expense.objects.create(vehicle=v, category="fuel", amount=random.choice([60, 90, 140]),
                                     description="Diesel top-up")
        m.TrailerRent.objects.create(trailer=vehicles[0], customer=customers[0], daily_rate=15)
        inv_customer = customers[1]
        m.Invoice.objects.create(customer=inv_customer, amount=500, due_date=today - timedelta(days=5), status="sent")
        self.stdout.write(self.style.SUCCESS("Seeded. Login: admin / admin123"))
