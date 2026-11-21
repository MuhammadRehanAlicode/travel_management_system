from django.contrib import admin
from . import models as m

for model in (m.Customer, m.Vehicle, m.Driver, m.Trip, m.TripStop, m.Payment, m.Salary,
              m.DriverExpense, m.TrailerRent, m.Invoice, m.Expense, m.Maintenance, m.CompanySettings):
    admin.site.register(model)
