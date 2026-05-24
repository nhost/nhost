-- =============================================================================
-- Consolidated DDL for schema generation tests
-- =============================================================================
-- Combines Nhost standard auth/storage tables with application tables.
-- Excluded: extensions (pgvector), functions, triggers, seed data (except enums).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ── Auth Schema ─────────────────────────────────────────────────────────────

CREATE TABLE auth.roles (
  role TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE auth.providers (
  id TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE auth.provider_requests (
  id      UUID NOT NULL PRIMARY KEY,
  options JSONB
);

CREATE TABLE auth.refresh_token_types (
  value   TEXT PRIMARY KEY,
  comment TEXT
);

CREATE TABLE auth.users (
  id                         UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at                 TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                 TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen                  TIMESTAMPTZ,
  disabled                   BOOLEAN DEFAULT false NOT NULL,
  display_name               TEXT DEFAULT '' NOT NULL,
  avatar_url                 TEXT DEFAULT '' NOT NULL,
  locale                     VARCHAR(2) NOT NULL DEFAULT 'en',
  email                      citext UNIQUE,
  phone_number               TEXT UNIQUE,
  password_hash              TEXT,
  email_verified             BOOLEAN DEFAULT false NOT NULL,
  phone_number_verified      BOOLEAN DEFAULT false NOT NULL,
  new_email                  citext,
  otp_method_last_used       TEXT,
  otp_hash                   TEXT,
  otp_hash_expires_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  default_role               TEXT DEFAULT 'user' NOT NULL REFERENCES auth.roles(role) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_anonymous               BOOLEAN DEFAULT false NOT NULL,
  totp_secret                TEXT,
  active_mfa_type            TEXT,
  ticket                     TEXT,
  ticket_expires_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata                   JSONB,
  webauthn_current_challenge TEXT
);

CREATE TABLE auth.refresh_tokens (
  id                 UUID NOT NULL PRIMARY KEY,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  metadata           JSONB,
  type               TEXT NOT NULL DEFAULT 'regular' REFERENCES auth.refresh_token_types(value) ON UPDATE RESTRICT ON DELETE RESTRICT,
  refresh_token_hash TEXT
);

CREATE TABLE auth.user_providers (
  id               UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,
  provider_id      TEXT NOT NULL REFERENCES auth.providers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  provider_user_id TEXT NOT NULL,
  UNIQUE (user_id, provider_id),
  UNIQUE (provider_id, provider_user_id)
);

CREATE TABLE auth.user_roles (
  id         UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  role       TEXT NOT NULL REFERENCES auth.roles(role) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (user_id, role)
);

CREATE TABLE auth.user_security_keys (
  id                    UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  credential_id         TEXT NOT NULL UNIQUE,
  credential_public_key BYTEA,
  counter               BIGINT NOT NULL DEFAULT 0,
  transports            TEXT NOT NULL DEFAULT '',
  nickname              TEXT
);

-- ── OAuth2 identity-provider tables (auth >= 0.50) ──────────────────────────

CREATE TABLE auth.oauth2_clients (
  client_id                    TEXT NOT NULL PRIMARY KEY,
  client_secret_hash           TEXT,
  redirect_uris                TEXT[] NOT NULL DEFAULT '{}',
  scopes                       TEXT[] NOT NULL DEFAULT '{openid,profile,email,phone,offline_access,graphql}',
  type                         TEXT NOT NULL DEFAULT 'registered',
  metadata                     JSONB,
  metadata_document_fetched_at TIMESTAMPTZ,
  created_by                   UUID REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE auth.oauth2_auth_requests (
  id                    UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  client_id             TEXT NOT NULL REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE,
  scopes                TEXT[] NOT NULL DEFAULT '{}',
  redirect_uri          TEXT NOT NULL,
  state                 TEXT,
  nonce                 TEXT,
  response_type         TEXT NOT NULL,
  code_challenge        TEXT,
  code_challenge_method TEXT,
  resource              TEXT,
  user_id               UUID REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  done                  BOOLEAN DEFAULT false NOT NULL,
  auth_time             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth.oauth2_authorization_codes (
  id              UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  code_hash       TEXT NOT NULL UNIQUE,
  auth_request_id UUID NOT NULL REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth.oauth2_refresh_tokens (
  id              UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  auth_request_id UUID REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE SET NULL,
  client_id       TEXT NOT NULL REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL
);

-- ── Storage Schema ──────────────────────────────────────────────────────────

CREATE TABLE storage.buckets (
  id                     TEXT NOT NULL PRIMARY KEY,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  download_expiration    INT NOT NULL DEFAULT 30,
  min_upload_file_size   INT NOT NULL DEFAULT 1,
  max_upload_file_size   INT NOT NULL DEFAULT 50000000,
  cache_control          TEXT DEFAULT 'max-age=3600',
  presigned_urls_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE storage.files (
  id                  UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  bucket_id           TEXT NOT NULL DEFAULT 'default' REFERENCES storage.buckets(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name                TEXT,
  size                INT,
  mime_type           TEXT,
  etag                TEXT,
  is_uploaded         BOOLEAN DEFAULT false,
  uploaded_by_user_id UUID,
  metadata            JSONB
);

CREATE TABLE storage.virus (
  id           UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  file_id      UUID NOT NULL REFERENCES storage.files(id),
  filename     TEXT NOT NULL,
  virus        TEXT NOT NULL,
  user_session JSONB NOT NULL
);

-- ── Public Schema ───────────────────────────────────────────────────────────

CREATE TABLE public.departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  budget          DECIMAL(12,2),
  has_high_budget BOOLEAN GENERATED ALWAYS AS (budget > 500000) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.department_roles (
  value   TEXT PRIMARY KEY,
  comment TEXT
);

CREATE TABLE public.user_departments (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role          TEXT DEFAULT 'member' REFERENCES public.department_roles(value) ON DELETE RESTRICT ON UPDATE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, department_id)
);

CREATE TABLE public.department_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id       UUID NOT NULL REFERENCES storage.files(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  description   TEXT
);

CREATE TABLE public.kb_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  summary             TEXT,
  content             TEXT NOT NULL,
  uploader_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  embeddings_outdated BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.kb_entry_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_entry_id   UUID NOT NULL REFERENCES public.kb_entries(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  UNIQUE(kb_entry_id, department_id)
);

CREATE TABLE public.news (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_public     BOOLEAN NOT NULL DEFAULT false,
  title         TEXT NOT NULL UNIQUE,
  content       TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE public.user_profiles (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID NOT NULL UNIQUE,
  address    TEXT NOT NULL
);

-- ── Views ───────────────────────────────────────────────────────────────────

CREATE VIEW public.published_news AS
  SELECT id, created_at, updated_at, title, content, department_id, author_id
  FROM public.news
  WHERE is_public = true;

-- Non-updatable view (UNION ALL) used to verify view introspection
-- reports IsView=true, IsInsertable=false, IsUpdatable=false.
CREATE VIEW public.content_feed AS
  SELECT n.id, 'news'::text AS source, n.title, n.content, n.created_at
  FROM public.news n
  WHERE n.is_public = true
  UNION ALL
  SELECT k.id, 'kb_entry'::text AS source, k.title, k.content, k.created_at
  FROM public.kb_entries k;

-- ── Table Comments (Nhost auth standard) ────────────────────────────────────

COMMENT ON TABLE auth.users IS 'User account information. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.roles IS 'Persistent Hasura roles for users. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.providers IS 'List of available Oauth providers. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.provider_requests IS 'Oauth requests, inserted before redirecting to the provider''s site. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.user_providers IS 'Active providers for a given user. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.user_roles IS 'Roles of users. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.user_security_keys IS 'User webauthn security keys. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMENT ON TABLE auth.refresh_tokens IS 'User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don''t modify its structure as Hasura Auth relies on it to function properly.';

-- ── Tracked Functions ───────────────────────────────────────────────────────

CREATE FUNCTION public.search_news(search text)
  RETURNS SETOF public.news AS $$
    SELECT * FROM public.news
    WHERE title ILIKE ('%' || search || '%') OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;

CREATE FUNCTION public.search_news_2(search text)
  RETURNS SETOF public.news AS $$
    SELECT * FROM public.news
    WHERE title ILIKE ('%' || search || '%') OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;

CREATE FUNCTION public.search_news_3(search text)
  RETURNS SETOF public.news AS $$
    SELECT * FROM public.news
    WHERE title ILIKE ('%' || search || '%') OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_department_manager(department_id UUID)
  RETURNS public.user_departments
  LANGUAGE sql STABLE AS $$
    SELECT * FROM public.user_departments
    WHERE department_id = department_id AND role = 'manager' LIMIT 1;
  $$;

CREATE OR REPLACE FUNCTION public.set_department_manager(p_user_id UUID, p_department_id UUID, session json)
  RETURNS public.user_departments
  LANGUAGE plpgsql VOLATILE AS $$
  DECLARE result public.user_departments;
  BEGIN
    UPDATE public.user_departments SET role = 'member'
    WHERE department_id = p_department_id AND role = 'manager';
    INSERT INTO public.user_departments (user_id, department_id, role)
    VALUES (p_user_id, p_department_id, 'manager')
    ON CONFLICT (user_id, department_id) DO UPDATE SET role = 'manager'
    RETURNING * INTO result;
    RETURN result;
  END;
  $$;

CREATE OR REPLACE FUNCTION public.deactivate_department(p_department_id UUID, session json)
  RETURNS SETOF public.user_departments
  LANGUAGE plpgsql VOLATILE AS $$
  BEGIN
    RETURN QUERY UPDATE public.user_departments
    SET is_active = false WHERE department_id = p_department_id RETURNING *;
  END;
  $$;

-- ── Enum seed data (required for introspection of is_enum tables) ───────────

INSERT INTO auth.roles (role) VALUES ('user'), ('me'), ('admin');
INSERT INTO auth.providers (id) VALUES ('github'), ('google');
INSERT INTO auth.refresh_token_types (value, comment) VALUES
  ('pat', 'Personal access token'),
  ('regular', 'Regular refresh token');
INSERT INTO public.department_roles (value, comment) VALUES
  ('member', 'Regular department member'),
  ('manager', 'Department manager');
