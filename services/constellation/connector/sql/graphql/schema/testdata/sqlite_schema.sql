-- SQLite test schema mirroring the integration Postgres `local` database.
--
-- Generated from `pg_dump` of the integration env, then transformed for SQLite:
--   * Schemas dropped (SQLite is flat); table names stripped of `schema.`.
--   * `auth.schema_migrations` and `storage.schema_migrations` skipped
--     (name collision + not tracked in metadata).
--   * `auth.email` domain replaced with TEXT.
--   * `gen_random_uuid()` defaults dropped (SQLite has no such function).
--   * `now()` -> CURRENT_TIMESTAMP.
--   * `'x'::text` / `'x'::character varying` casts stripped.
--   * `bytea` -> BLOB.
--   * `public.vector(1536)` -> BLOB (treated as opaque by the queries that matter).
--   * Functions, triggers, COMMENT, and non-unique indexes dropped.
--
-- Types preserved (UUID, NUMERIC(12,2), JSONB, TIMESTAMP WITH TIME ZONE,
-- CHARACTER VARYING(255)) so `mapSQLiteType` produces the same normalized
-- type names as the Postgres introspection.

-- ===========================================================================
-- auth schema
-- ===========================================================================

CREATE TABLE provider_requests (
    id UUID NOT NULL PRIMARY KEY,
    options JSONB
);

CREATE TABLE providers (
    id TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE refresh_token_types (
    value TEXT NOT NULL PRIMARY KEY,
    comment TEXT
);

CREATE TABLE roles (
    role TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE users (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    disabled BOOLEAN NOT NULL DEFAULT 0,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    locale CHARACTER VARYING(2) NOT NULL,
    email TEXT,
    phone_number TEXT,
    password_hash TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT 0,
    phone_number_verified BOOLEAN NOT NULL DEFAULT 0,
    new_email TEXT,
    otp_method_last_used TEXT,
    otp_hash TEXT,
    otp_hash_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    default_role TEXT NOT NULL DEFAULT 'user',
    is_anonymous BOOLEAN NOT NULL DEFAULT 0,
    totp_secret TEXT,
    active_mfa_type TEXT,
    ticket TEXT,
    ticket_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    webauthn_current_challenge TEXT,
    CONSTRAINT active_mfa_types_check CHECK (active_mfa_type = 'totp' OR active_mfa_type = 'sms'),
    FOREIGN KEY (default_role) REFERENCES roles(role)
);
CREATE UNIQUE INDEX users_email_key ON users(email);
CREATE UNIQUE INDEX users_phone_number_key ON users(phone_number);

CREATE TABLE refresh_tokens (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id UUID NOT NULL,
    metadata JSONB,
    type TEXT NOT NULL DEFAULT 'regular',
    refresh_token_hash CHARACTER VARYING(255),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (type) REFERENCES refresh_token_types(value)
);

CREATE TABLE user_providers (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    provider_id TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);
CREATE UNIQUE INDEX user_providers_provider_id_provider_user_id_key
    ON user_providers(provider_id, provider_user_id);

CREATE TABLE user_roles (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role) REFERENCES roles(role)
);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON user_roles(user_id, role);

CREATE TABLE user_security_keys (
    id UUID NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL,
    credential_id TEXT NOT NULL,
    credential_public_key BLOB,
    counter INTEGER NOT NULL DEFAULT 0,
    transports CHARACTER VARYING(255) NOT NULL DEFAULT '',
    nickname TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX user_security_key_credential_id_key
    ON user_security_keys(credential_id);

-- ===========================================================================
-- auth OAuth2 identity-provider tables (auth >= 0.50)
-- ===========================================================================

CREATE TABLE oauth2_clients (
    client_id TEXT NOT NULL PRIMARY KEY,
    client_secret_hash TEXT,
    redirect_uris TEXT NOT NULL DEFAULT '{}',
    scopes TEXT NOT NULL DEFAULT '{openid,profile,email,phone,offline_access,graphql}',
    type TEXT NOT NULL DEFAULT 'registered',
    metadata JSONB,
    metadata_document_fetched_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE oauth2_auth_requests (
    id UUID NOT NULL PRIMARY KEY,
    client_id TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '{}',
    redirect_uri TEXT NOT NULL,
    state TEXT,
    nonce TEXT,
    response_type TEXT NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    resource TEXT,
    user_id UUID,
    done BOOLEAN NOT NULL DEFAULT 0,
    auth_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (client_id) REFERENCES oauth2_clients(client_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE oauth2_authorization_codes (
    id UUID NOT NULL PRIMARY KEY,
    code_hash TEXT NOT NULL,
    auth_request_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (auth_request_id) REFERENCES oauth2_auth_requests(id)
);
CREATE UNIQUE INDEX oauth2_authorization_codes_code_hash_key
    ON oauth2_authorization_codes(code_hash);

CREATE TABLE oauth2_refresh_tokens (
    id UUID NOT NULL PRIMARY KEY,
    token_hash TEXT NOT NULL,
    auth_request_id UUID,
    client_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    scopes TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (auth_request_id) REFERENCES oauth2_auth_requests(id),
    FOREIGN KEY (client_id) REFERENCES oauth2_clients(client_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX oauth2_refresh_tokens_token_hash_key
    ON oauth2_refresh_tokens(token_hash);

-- ===========================================================================
-- public schema
-- ===========================================================================

CREATE TABLE department_roles (
    value TEXT NOT NULL PRIMARY KEY,
    comment TEXT
);

CREATE TABLE departments (
    id UUID NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    budget NUMERIC(12,2),
    has_high_budget BOOLEAN GENERATED ALWAYS AS (budget > 500000) STORED,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX departments_name_key ON departments(name);

CREATE TABLE user_departments (
    user_id UUID NOT NULL,
    department_id UUID NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (role) REFERENCES department_roles(value)
);

CREATE TABLE kb_entries (
    id UUID NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    uploader_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    embeddings BLOB,
    embeddings_outdated BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE kb_entry_departments (
    id UUID NOT NULL PRIMARY KEY,
    kb_entry_id UUID NOT NULL,
    department_id UUID NOT NULL,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE UNIQUE INDEX kb_entry_departments_kb_entry_id_department_id_key
    ON kb_entry_departments(kb_entry_id, department_id);

CREATE TABLE news (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    department_id UUID NOT NULL,
    author_id UUID NOT NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX news_title_key ON news(title);

CREATE TABLE user_profiles (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    address TEXT NOT NULL
);
CREATE UNIQUE INDEX user_profiles_user_id_key ON user_profiles(user_id);

-- ===========================================================================
-- storage schema
-- ===========================================================================

CREATE TABLE buckets (
    id TEXT NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    download_expiration INTEGER NOT NULL DEFAULT 30,
    min_upload_file_size INTEGER NOT NULL DEFAULT 1,
    max_upload_file_size INTEGER NOT NULL DEFAULT 50000000,
    cache_control TEXT DEFAULT 'max-age=3600',
    presigned_urls_enabled BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT download_expiration_valid_range
        CHECK (download_expiration >= 1 AND download_expiration <= 604800)
);

CREATE TABLE files (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bucket_id TEXT NOT NULL DEFAULT 'default',
    name TEXT,
    size INTEGER,
    mime_type TEXT,
    etag TEXT,
    is_uploaded BOOLEAN DEFAULT 0,
    uploaded_by_user_id UUID,
    metadata JSONB,
    FOREIGN KEY (bucket_id) REFERENCES buckets(id)
);

CREATE TABLE virus (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_id UUID NOT NULL,
    filename TEXT NOT NULL,
    virus TEXT NOT NULL,
    user_session JSONB NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE TABLE department_files (
    id UUID NOT NULL PRIMARY KEY,
    file_id UUID NOT NULL,
    department_id UUID NOT NULL,
    description TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (file_id) REFERENCES files(id)
);

-- ===========================================================================
-- views
-- ===========================================================================

CREATE VIEW published_news AS
    SELECT id, created_at, updated_at, title, content, department_id, author_id
    FROM news
    WHERE is_public = 1;

CREATE VIEW content_feed AS
    SELECT id, 'news' AS source, title, content, created_at
    FROM news WHERE is_public = 1
    UNION ALL
    SELECT id, 'kb_entry' AS source, title, content, created_at
    FROM kb_entries;

-- ===========================================================================
-- Seed data for enum tables (tables marked is_enum: true in metadata).
-- The SQLite introspector reads rows from these tables to populate
-- EnumValues, so they need at least one row or schema generation fails.
-- ===========================================================================

INSERT INTO refresh_token_types (value, comment) VALUES
    ('pat', 'Personal access token'),
    ('regular', 'Regular refresh token');

INSERT INTO department_roles (value, comment) VALUES
    ('member', 'Regular department member'),
    ('manager', 'Department manager');

-- exercise_logs / exercise_log_sets fixture (composite-FK post-check regression).
CREATE TABLE exercise_logs (
    id UUID NOT NULL,
    kind TEXT NOT NULL,
    owner_id UUID NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (id, kind)
);

CREATE TABLE exercise_log_sets (
    id UUID NOT NULL PRIMARY KEY,
    parent_id UUID NOT NULL,
    parent_kind TEXT NOT NULL DEFAULT 'strength' CHECK (parent_kind = 'strength'),
    reps INTEGER,
    FOREIGN KEY (parent_id, parent_kind) REFERENCES exercise_logs(id, kind)
);
