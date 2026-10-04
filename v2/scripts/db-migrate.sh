#!/usr/bin/env sh
# DB-01 migration: apply server/db/schema.sql to $DATABASE_URL (Tiger Data / Postgres). Idempotent.
# The server also runs it automatically on startup when DATABASE_URL is set.
set -e
: "${DATABASE_URL:?set DATABASE_URL}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../server/db/schema.sql"
