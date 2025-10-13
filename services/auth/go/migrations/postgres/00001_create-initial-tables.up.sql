-- start a transaction
BEGIN;

-- extensions
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


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
  refresh_token text,
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
  last_seen timestamp with time zone,
  disabled boolean DEFAULT false NOT NULL,
  display_name text DEFAULT '' NOT NULl,
  avatar_url text DEFAULT '' NOT NULL,
  locale varchar(2) NOT NULL,
  email auth.email UNIQUE,
  phone_number text UNIQUE,
  password_hash text,
  email_verified boolean DEFAULT FALSE NOT NULL,
  phone_number_verified boolean DEFAULT FALSE NOT NULL,
  new_email auth.email,
  otp_method_last_used text, -- used to verify the method (sms or email)
  otp_hash text,
  otp_hash_expires_at timestamp with time zone DEFAULT now() NOT NULL,
  default_role text DEFAULT 'user' NOT NULL,
  is_anonymous boolean DEFAULT FALSE NOT NULL,
  totp_secret text,
  active_mfa_type text, -- sms or totp
  ticket text,
  ticket_expires_at timestamp with time zone DEFAULT now() NOT NULL
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

CREATE TABLE auth.provider_requests (
  id uuid NOT NULL PRIMARY KEY,
  redirect_url text NOT NULL
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

-- checks

ALTER TABLE auth.users
ADD CONSTRAINT active_mfa_types_check
CHECK (
	active_mfa_type = 'totp'
	OR active_mfa_type = 'sms'
);

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

