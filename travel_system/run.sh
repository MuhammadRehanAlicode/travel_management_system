#!/usr/bin/env bash
set -e
python -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations core
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
