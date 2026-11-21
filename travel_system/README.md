# Logistics / Travel Management System

Django + Django REST Framework + SQL (SQLite by default, MySQL/PostgreSQL supported) with an HTML + Tailwind CSS frontend.

## Quick start
```bash
./run.sh                       # Linux/macOS
# or manually:
pip install -r requirements.txt
python manage.py makemigrations core
python manage.py migrate
python manage.py seed_demo      # creates admin / admin123 + fictional demo data
python manage.py runserver
```
Open http://127.0.0.1:8000 and sign in with `admin` / `admin123` (change it under Settings).

## Run the automated tests
```bash
python manage.py test
```

## Use MySQL / PostgreSQL
```bash
export DB_ENGINE=mysql DB_NAME=logistics DB_USER=root DB_PASSWORD=secret DB_HOST=127.0.0.1
```
(install `mysqlclient` or `psycopg2-binary` first)

## Deploy on Railway

1. Push this `travel_system` folder to a GitHub repository and create a Railway project from that repository.
2. Add a Railway PostgreSQL service and make sure its `DATABASE_URL` variable is available to the Django service (Railway can reference the PostgreSQL service's `DATABASE_URL`).
3. Set these variables on the Django service:
   - `SECRET_KEY`: a new, private random value
   - `DEBUG`: `0`
   - `ALLOWED_HOSTS`: `your-app-domain.up.railway.app` (replace with the Railway domain)
   - `CSRF_TRUSTED_ORIGINS`: `https://your-app-domain.up.railway.app` (replace with the Railway domain)
4. Generate a Railway domain in the service's Networking settings. The deployment start command runs database migrations and collects static files before starting Gunicorn.
5. Create your admin account from the Railway service shell with `python manage.py createsuperuser`.

The included `railway.toml` and `Procfile` configure the web process. Do not use the demo `seed_demo` command on a public deployment; it creates a predictable `admin` / `admin123` account.

## Modules
Dashboard (expired / expiring documents), Customers (ledger, receivable/payable), Vehicles (document expiry),
Trips (+ multi-stop), Payments, Drivers (license / labor-card tracking), Salaries, Driver Expenses (credit/debit ledger),
Trailer Rents, Invoices (record payments), Expenses, Maintenance, Reports (P&L), User Management (admin only), Settings.

## REST API (all under /api/, session auth)
`customers, vehicles, trips, payments, drivers, salaries, driver-expenses, trailer-rents, invoices, expenses, maintenance, users`
support list (`?search=&page=&date_from=&date_to=` + field filters), create, retrieve, PATCH, DELETE.
Extras: `customers/{id}/ledger/`, `drivers/{id}/ledger/`, `drivers/{id}/toggle/`, `salaries/{id}/pay/`,
`invoices/{id}/record_payment/`, `dashboard/`, `reports/`, `auth/login|logout|me|change-password/`, `company/`.

## Notes
Tailwind is loaded from its CDN (needs internet in the browser). For production, set `SECRET_KEY`, `DEBUG=0`, `ALLOWED_HOSTS`, and run `collectstatic`.
