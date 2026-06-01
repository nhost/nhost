#!/usr/bin/env bash
#
# Dumps schema and data from the local Nhost PostgreSQL database and
# imports it into a SQLite3 database.
#
# Usage:
#   ./integration/sqlite/setup.sh [path/to/db.sqlite]
#
# If no path is given the database is created at integration/sqlite/dev.db
#
# Prerequisites:
#   - pg_dump and psql available on PATH
#   - PostgreSQL running at localhost:5432 with the "local" database
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${1:-$SCRIPT_DIR/dev.db}"
PG="postgres://postgres:postgres@localhost:5432/local"

TABLES=(
    auth.provider_requests
    auth.providers
    auth.refresh_token_types
    auth.refresh_tokens
    auth.roles
    auth.user_providers
    auth.user_roles
    auth.user_security_keys
    auth.users
    public.department_files
    public.department_roles
    public.departments
    public.kb_entries
    public.kb_entry_departments
    public.news
    public.user_departments
    public.user_profiles
    storage.buckets
    storage.files
    storage.virus
)

rm -f "$DB"

echo "Creating SQLite database at $DB ..."

# ──────────────────────────────────────────────
# Step 1: Create the SQLite schema.
#
# We translate PG types/syntax by hand because
# automated translation of pg_dump DDL is fragile.
# ──────────────────────────────────────────────
sqlite3 "$DB" <<'SCHEMA'
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── auth tables ──────────────────────────────

CREATE TABLE auth_providers (
    id TEXT PRIMARY KEY
);

CREATE TABLE auth_roles (
    role TEXT PRIMARY KEY
);

CREATE TABLE auth_provider_requests (
    id      TEXT PRIMARY KEY,
    options TEXT  -- JSON
);

CREATE TABLE auth_refresh_token_types (
    value   TEXT PRIMARY KEY,
    comment TEXT
);

CREATE TABLE auth_users (
    id                         TEXT PRIMARY KEY,
    created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                 TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen                  TEXT,
    disabled                   INTEGER NOT NULL DEFAULT 0,
    display_name               TEXT NOT NULL DEFAULT '',
    avatar_url                 TEXT NOT NULL DEFAULT '',
    locale                     TEXT NOT NULL,
    email                      TEXT,
    phone_number               TEXT,
    password_hash              TEXT,
    email_verified             INTEGER NOT NULL DEFAULT 0,
    phone_number_verified      INTEGER NOT NULL DEFAULT 0,
    new_email                  TEXT,
    otp_method_last_used       TEXT,
    otp_hash                   TEXT,
    otp_hash_expires_at        TEXT NOT NULL DEFAULT (datetime('now')),
    default_role               TEXT NOT NULL DEFAULT 'user' REFERENCES auth_roles(role) ON UPDATE CASCADE ON DELETE RESTRICT,
    is_anonymous               INTEGER NOT NULL DEFAULT 0,
    totp_secret                TEXT,
    active_mfa_type            TEXT,
    ticket                     TEXT,
    ticket_expires_at          TEXT NOT NULL DEFAULT (datetime('now')),
    metadata                   TEXT,  -- JSON stored as text
    webauthn_current_challenge TEXT
);

CREATE TABLE auth_refresh_tokens (
    id                 TEXT PRIMARY KEY,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at         TEXT NOT NULL,
    user_id            TEXT NOT NULL REFERENCES auth_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    metadata           TEXT,  -- JSON
    type               TEXT NOT NULL DEFAULT 'regular' REFERENCES auth_refresh_token_types(value) ON UPDATE RESTRICT ON DELETE RESTRICT,
    refresh_token_hash TEXT
);

CREATE TABLE auth_user_providers (
    id               TEXT PRIMARY KEY,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    user_id          TEXT NOT NULL REFERENCES auth_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    access_token     TEXT NOT NULL,
    refresh_token    TEXT,
    provider_id      TEXT NOT NULL REFERENCES auth_providers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    provider_user_id TEXT NOT NULL,
    UNIQUE (provider_id, provider_user_id)
);

CREATE TABLE auth_user_roles (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id    TEXT NOT NULL REFERENCES auth_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    role       TEXT NOT NULL REFERENCES auth_roles(role) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE (user_id, role)
);

CREATE TABLE auth_user_security_keys (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL REFERENCES auth_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    credential_id         TEXT NOT NULL UNIQUE,
    credential_public_key BLOB,
    counter               INTEGER NOT NULL DEFAULT 0,
    transports            TEXT NOT NULL DEFAULT '',
    nickname              TEXT
);

-- ── storage tables ───────────────────────────

CREATE TABLE storage_buckets (
    id                      TEXT PRIMARY KEY,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
    download_expiration     INTEGER NOT NULL DEFAULT 30,
    min_upload_file_size    INTEGER NOT NULL DEFAULT 1,
    max_upload_file_size    INTEGER NOT NULL DEFAULT 50000000,
    cache_control           TEXT DEFAULT 'max-age=3600',
    presigned_urls_enabled  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE storage_files (
    id                  TEXT PRIMARY KEY,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    bucket_id           TEXT NOT NULL DEFAULT 'default' REFERENCES storage_buckets(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name                TEXT,
    size                INTEGER,
    mime_type           TEXT,
    etag                TEXT,
    is_uploaded         INTEGER DEFAULT 0,
    uploaded_by_user_id TEXT,
    metadata            TEXT  -- JSON stored as text
);

CREATE TABLE storage_virus (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    file_id      TEXT NOT NULL REFERENCES storage_files(id),
    filename     TEXT NOT NULL,
    virus        TEXT NOT NULL,
    user_session TEXT NOT NULL  -- JSON
);

-- ── public tables ────────────────────────────

CREATE TABLE departments (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    budget          REAL,
    has_high_budget INTEGER GENERATED ALWAYS AS (budget > 500000) STORED,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE department_roles (
    value   TEXT PRIMARY KEY,
    comment TEXT
);

CREATE TABLE user_departments (
    user_id       TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    role          TEXT DEFAULT 'member',
    joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
    is_active     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, department_id),
    CONSTRAINT fk_user_departments_role
        FOREIGN KEY (role) REFERENCES department_roles(value)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE department_files (
    id            TEXT PRIMARY KEY,
    file_id       TEXT NOT NULL REFERENCES storage_files(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    description   TEXT
);

CREATE TABLE kb_entries (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    summary             TEXT,
    content             TEXT NOT NULL,
    uploader_id         TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    embeddings          TEXT,  -- vector(1536) stored as text
    embeddings_outdated INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE kb_entry_departments (
    id            TEXT PRIMARY KEY,
    kb_entry_id   TEXT NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(kb_entry_id, department_id)
);

CREATE INDEX idx_kb_entries_uploader_id             ON kb_entries(uploader_id);
CREATE INDEX idx_kb_entry_departments_kb_entry_id   ON kb_entry_departments(kb_entry_id);
CREATE INDEX idx_kb_entry_departments_department_id ON kb_entry_departments(department_id);

CREATE TABLE news (
    id            TEXT PRIMARY KEY,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    is_public     INTEGER NOT NULL DEFAULT 0,
    title         TEXT NOT NULL UNIQUE,
    content       TEXT NOT NULL,
    department_id TEXT NOT NULL REFERENCES departments(id) ON UPDATE CASCADE ON DELETE CASCADE,
    author_id     TEXT NOT NULL REFERENCES auth_users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE user_profiles (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id    TEXT NOT NULL UNIQUE,
    address    TEXT NOT NULL
);
SCHEMA

echo "Schema created."

# ──────────────────────────────────────────────
# Step 2: Dump data from PostgreSQL and convert
#         INSERT statements for SQLite.
# ──────────────────────────────────────────────
echo "Dumping data from PostgreSQL ..."

TABLE_FLAGS=""
for t in "${TABLES[@]}"; do
    TABLE_FLAGS="$TABLE_FLAGS --table=$t"
done

pg_dump "$PG" \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-acl \
    $TABLE_FLAGS \
    2>/dev/null \
| sed \
    -e '/^--/d' \
    -e '/^$/d' \
    -e '/^SET /d' \
    -e '/^SELECT /d' \
    -e '/^\\restrict/d' \
    -e '/^\\unrestrict/d' \
    -e 's/INSERT INTO auth\./INSERT INTO auth_/' \
    -e 's/INSERT INTO storage\./INSERT INTO storage_/' \
    -e 's/INSERT INTO public\./INSERT INTO /' \
    -e 's/, true)/, 1)/g' \
    -e 's/, false)/, 0)/g' \
    -e 's/(true, /(1, /g' \
    -e 's/(false, /(0, /g' \
    -e 's/, true,/, 1,/g' \
    -e 's/, false,/, 0,/g' \
> /tmp/sqlite_data.sql

LINE_COUNT=$(wc -l < /tmp/sqlite_data.sql)
echo "Exported $LINE_COUNT INSERT statements."

# ──────────────────────────────────────────────
# Step 3: Import data into SQLite.
# ──────────────────────────────────────────────
echo "Importing data into SQLite ..."

# Wrap all inserts in a transaction for speed.
{
    echo "PRAGMA foreign_keys = OFF;"
    echo "BEGIN TRANSACTION;"
    cat /tmp/sqlite_data.sql
    echo "COMMIT;"
    echo "PRAGMA foreign_keys = ON;"
} | sqlite3 "$DB"

rm -f /tmp/sqlite_data.sql

echo ""
echo "Done. Tables:"
sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | while read -r t; do
    printf "  %-30s %s rows\n" "$t" "$(sqlite3 "$DB" "SELECT COUNT(*) FROM \"$t\";")"
done
