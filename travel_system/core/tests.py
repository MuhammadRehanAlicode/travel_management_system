from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from . import models as m


class ApiFlowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin", "a@x.com", "pass1234")
        self.client.force_authenticate(self.admin)
        self.cust = m.Customer.objects.create(name="Test Customer")
        self.driver = m.Driver.objects.create(name="Driver One", license_expiry=date.today() + timedelta(days=10))
        self.vehicle = m.Vehicle.objects.create(number="1111-AA", insurance_expiry=date.today() - timedelta(days=2))

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/customers/").status_code, (401, 403))

    def test_customer_crud_and_search(self):
        r = self.client.post("/api/customers/", {"name": "New Co", "email": "n@x.com"}, format="json")
        self.assertEqual(r.status_code, 201)
        r = self.client.get("/api/customers/?search=New")
        self.assertEqual(r.data["count"], 1)
        cid = r.data["results"][0]["id"]
        self.assertEqual(self.client.patch(f"/api/customers/{cid}/", {"phone": "123"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/customers/{cid}/").status_code, 204)

    def test_trip_numbering_balance_and_ledger(self):
        r = self.client.post("/api/trips/", {"origin": "A", "destination": "B", "customer": self.cust.id,
                             "total_amount": "250.000", "status": "completed"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["trip_no"].startswith("TRIP-"))
        trip_id = r.data["id"]
        self.client.post("/api/payments/", {"customer": self.cust.id, "trip": trip_id, "payment_type": "received",
                         "mode": "cash", "amount": "100.000"}, format="json")
        self.assertEqual(self.cust.balance, Decimal("150"))
        led = self.client.get(f"/api/customers/{self.cust.id}/ledger/")
        self.assertEqual(len(led.data["rows"]), 2)
        self.assertEqual(Decimal(str(led.data["balance"])), Decimal("150"))
        self.assertEqual(self.client.get("/api/customers/?balance=receivable").data["count"], 1)

    def test_multistop_trip(self):
        r = self.client.post("/api/trips/", {"origin": "A", "destination": "C", "customer": self.cust.id, "is_multi_stop": True,
                             "stops": [{"sequence": 1, "location": "B", "amount": "10"}, {"sequence": 2, "location": "C", "amount": "20"}]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data["stops"]), 2)

    def test_payment_rejects_zero(self):
        r = self.client.post("/api/payments/", {"payment_type": "received", "mode": "cash", "amount": "0"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_vehicle_doc_issues_and_dashboard(self):
        v = self.client.get("/api/vehicles/").data["results"][0]
        self.assertEqual(v["doc_issues"][0]["state"], "expired")
        d = self.client.get("/api/dashboard/").data
        self.assertTrue(any(x["name"] == "1111-AA" for x in d["expired"]))
        self.assertTrue(any(x["name"] == "Driver One" for x in d["expiring"]))

    def test_driver_expense_ledger_and_toggle(self):
        self.client.post("/api/driver-expenses/", {"driver": self.driver.id, "entry_type": "credit", "amount": "100"}, format="json")
        self.client.post("/api/driver-expenses/", {"driver": self.driver.id, "entry_type": "debit", "amount": "30"}, format="json")
        led = self.client.get(f"/api/drivers/{self.driver.id}/ledger/").data
        self.assertEqual(Decimal(str(led["balance"])), Decimal("70"))
        self.assertFalse(self.client.post(f"/api/drivers/{self.driver.id}/toggle/").data["is_active"])

    def test_invoice_payment_flow(self):
        r = self.client.post("/api/invoices/", {"customer": self.cust.id, "amount": "200"}, format="json")
        self.assertTrue(r.data["number"].startswith("INV-"))
        r2 = self.client.post(f"/api/invoices/{r.data['id']}/record_payment/", {"amount": "200"}, format="json")
        self.assertEqual(r2.data["status"], "paid")

    def test_salary_pay_and_reports(self):
        sal = self.client.post("/api/salaries/", {"driver": self.driver.id, "month": "2026-11-01", "basic": "300", "allowance": "50"}, format="json")
        self.assertEqual(self.client.post(f"/api/salaries/{sal.data['id']}/pay/").data["is_paid"], True)
        self.assertEqual(self.client.get("/api/reports/").status_code, 200)

    def test_user_management_admin_only(self):
        r = self.client.post("/api/users/", {"username": "bob", "password": "secret12", "role": "staff"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.client.force_authenticate(User.objects.get(username="bob"))
        self.assertEqual(self.client.get("/api/users/").status_code, 403)

    def test_pages_render(self):
        self.client.force_login(self.admin)
        for url in ["/dashboard/", "/customers/", "/vehicles/", "/trips/", "/payments/", "/drivers/", "/salaries/",
                    "/driver-expenses/", "/trailer-rents/", "/invoices/", "/expenses/", "/maintenance/", "/reports/", "/user-management/"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
