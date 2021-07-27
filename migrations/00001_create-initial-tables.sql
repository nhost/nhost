-- start a transaction
BEGIN;
-- functions
CREATE FUNCTION auth.set_current_timestamp_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
DECLARE
  _new record;
BEGIN
  _new := new;
  _new. "updated_at" = now();
  RETURN _new;
END;
$$;

-- domains
CREATE DOMAIN auth.email AS public.citext CHECK (value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$');

-- tables
CREATE TABLE auth.user_providers (
  id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  provider_id text NOT NULL,
  provider_user_id text NOT NULL,
  UNIQUE (user_id, provider_id),
  UNIQUE (provider_id, provider_user_id)
);

CREATE TABLE auth.user_roles (
  id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  UNIQUE (user_id, ROLE)
);

CREATE TABLE auth.users (
  id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  display_name text,
  avatar_url text,
  locale varchar(2),
  is_active boolean DEFAULT FALSE NOT NULL,
  last_activate_email_sent_at timestamp with time zone DEFAULT now() NOT NULL,
  email_verified boolean DEFAULT FALSE NOT NULL,
  last_verify_email_sent_at timestamp with time zone DEFAULT now() NOT NULL,
  email auth.email UNIQUE,
  new_email auth.email UNIQUE,
  password_hash text,
  default_role text DEFAULT 'user' ::text NOT NULL,
  is_anonymous boolean DEFAULT FALSE NOT NULL,
  otp_secret text,
  mfa_enabled boolean DEFAULT FALSE NOT NULL,
  ticket text,
  ticket_expires_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (email),
  UNIQUE (new_email)
);

CREATE TABLE auth.providers (
  id text NOT NULL PRIMARY KEY
);

CREATE TABLE auth.refresh_tokens (
  refresh_token uuid NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  user_id uuid NOT NULL
);

CREATE TABLE auth.roles (
  role text NOT NULL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS auth.whitelist (
  email auth.email NOT NULL PRIMARY KEY
);

-- FKs
ALTER TABLE auth.user_providers
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE auth.user_providers
  ADD CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES auth.providers (id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE auth.user_roles
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE auth.user_roles
  ADD CONSTRAINT fk_role FOREIGN KEY (ROLE) REFERENCES auth.roles (ROLE) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE auth.users
  ADD CONSTRAINT fk_default_role FOREIGN KEY (default_role) REFERENCES auth.roles (ROLE) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE auth.refresh_tokens
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

-- triggers

CREATE TRIGGER set_auth_user_providers_updated_at
  BEFORE UPDATE ON auth.user_providers
  FOR EACH ROW
  EXECUTE FUNCTION auth.set_current_timestamp_updated_at ();

CREATE TRIGGER set_auth_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.set_current_timestamp_updated_at ();

-- data

INSERT INTO auth.roles (ROLE)
  VALUES ('user'), ('anonymous'), ('me');

INSERT INTO auth.providers (id)
  VALUES
    ('github'),
    ('facebook'),
    ('twitter'),
    ('google'),
    ('apple'),
    ('linkedin'),
    ('windowslive'),
    ('spotify'),
    ('strava'),
    ('gitlab'),
    ('bitbucket');

-- commit the change (or roll it back later)
COMMIT;

