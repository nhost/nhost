--
-- PostgreSQL database dump
--


-- Dumped from database version 14.6 (Debian 14.6-1.pgdg110+1)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: nhost_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO nhost_admin;

--
-- Name: email; Type: DOMAIN; Schema: auth; Owner: postgres
--

CREATE DOMAIN auth.email AS public.citext
	CONSTRAINT email_check CHECK ((VALUE OPERATOR(public.~) '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'::public.citext));


ALTER DOMAIN auth.email OWNER TO postgres;

--
-- Name: generate_oauth2_client_id(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.generate_oauth2_client_id() RETURNS text
    LANGUAGE sql
    AS $$
    SELECT 'nhoa_' || substring(encode(sha256(gen_random_uuid()::text::bytea), 'hex') from 1 for 16);
$$;


ALTER FUNCTION auth.generate_oauth2_client_id() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: oauth2_clients; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth2_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text DEFAULT auth.generate_oauth2_client_id() NOT NULL,
    client_secret_hash text,
    client_name text NOT NULL,
    client_uri text,
    logo_uri text,
    redirect_uris text[] DEFAULT '{}'::text[] NOT NULL,
    grant_types text[] DEFAULT '{authorization_code}'::text[] NOT NULL,
    response_types text[] DEFAULT '{code}'::text[] NOT NULL,
    scopes text[] DEFAULT '{openid,profile,email,phone,offline_access,graphql}'::text[] NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    token_endpoint_auth_method text DEFAULT 'client_secret_basic'::text NOT NULL,
    id_token_signed_response_alg text DEFAULT 'RS256'::text NOT NULL,
    access_token_lifetime integer DEFAULT 900 NOT NULL,
    refresh_token_lifetime integer DEFAULT 2592000 NOT NULL,
    type text DEFAULT 'registered'::text NOT NULL,
    metadata jsonb,
    metadata_document_fetched_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.oauth2_clients OWNER TO postgres;

--
-- Name: TABLE oauth2_clients; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.oauth2_clients IS 'Registered OAuth2 client applications for the identity provider.';


--
-- Name: create_oauth2_client(json, text, text[], text, text, text, text[], text[], text[], text, text, integer, integer, text, jsonb); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.create_oauth2_client(hasura_session json, client_name text, redirect_uris text[] DEFAULT '{}'::text[], client_secret text DEFAULT NULL::text, client_uri text DEFAULT NULL::text, logo_uri text DEFAULT NULL::text, grant_types text[] DEFAULT '{authorization_code}'::text[], response_types text[] DEFAULT '{code}'::text[], scopes text[] DEFAULT '{openid,profile,email,phone,offline_access,graphql}'::text[], token_endpoint_auth_method text DEFAULT 'client_secret_basic'::text, id_token_signed_response_alg text DEFAULT 'RS256'::text, access_token_lifetime integer DEFAULT 900, refresh_token_lifetime integer DEFAULT 2592000, type text DEFAULT 'registered'::text, metadata jsonb DEFAULT NULL::jsonb) RETURNS auth.oauth2_clients
    LANGUAGE plpgsql
    AS $$
DECLARE
    secret_hash text := NULL;
    is_public boolean;
    v_auth_method text;
    v_created_by uuid;
    result auth.oauth2_clients;
BEGIN
    -- Extract user ID from Hasura session
    v_created_by := (hasura_session ->> 'x-hasura-user-id')::uuid;

    -- Hash secret if provided
    IF client_secret IS NOT NULL AND client_secret <> '' THEN
        secret_hash := crypt(client_secret, gen_salt('bf', 10));
    END IF;

    -- Derive is_public from secret presence
    is_public := (secret_hash IS NULL);

    -- Force auth method to 'none' for public clients
    v_auth_method := CASE WHEN is_public THEN 'none' ELSE token_endpoint_auth_method END;

    INSERT INTO auth.oauth2_clients (
        client_name,
        client_secret_hash,
        redirect_uris,
        client_uri,
        logo_uri,
        grant_types,
        response_types,
        scopes,
        is_public,
        token_endpoint_auth_method,
        id_token_signed_response_alg,
        access_token_lifetime,
        refresh_token_lifetime,
        type,
        metadata,
        created_by
    ) VALUES (
        create_oauth2_client.client_name,
        secret_hash,
        create_oauth2_client.redirect_uris,
        create_oauth2_client.client_uri,
        create_oauth2_client.logo_uri,
        create_oauth2_client.grant_types,
        create_oauth2_client.response_types,
        create_oauth2_client.scopes,
        is_public,
        v_auth_method,
        create_oauth2_client.id_token_signed_response_alg,
        create_oauth2_client.access_token_lifetime,
        create_oauth2_client.refresh_token_lifetime,
        create_oauth2_client.type,
        create_oauth2_client.metadata,
        v_created_by
    )
    RETURNING * INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION auth.create_oauth2_client(hasura_session json, client_name text, redirect_uris text[], client_secret text, client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb) OWNER TO postgres;

--
-- Name: modify_oauth2_client(text, text, text, text[], text, text, text[], text[], text[], text, text, integer, integer, text, jsonb); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.modify_oauth2_client(p_client_id text, client_name text DEFAULT NULL::text, client_secret text DEFAULT NULL::text, redirect_uris text[] DEFAULT NULL::text[], client_uri text DEFAULT NULL::text, logo_uri text DEFAULT NULL::text, grant_types text[] DEFAULT NULL::text[], response_types text[] DEFAULT NULL::text[], scopes text[] DEFAULT NULL::text[], token_endpoint_auth_method text DEFAULT NULL::text, id_token_signed_response_alg text DEFAULT NULL::text, access_token_lifetime integer DEFAULT NULL::integer, refresh_token_lifetime integer DEFAULT NULL::integer, type text DEFAULT NULL::text, metadata jsonb DEFAULT NULL::jsonb) RETURNS auth.oauth2_clients
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_secret_hash text;
    new_is_public boolean;
    v_auth_method text;
    result auth.oauth2_clients;
BEGIN
    -- Resolve secret hash: NULL = keep, '' = remove, else = hash new
    IF client_secret IS NULL THEN
        -- Keep existing
        SELECT o.client_secret_hash INTO new_secret_hash
        FROM auth.oauth2_clients o WHERE o.client_id = p_client_id;
    ELSIF client_secret = '' THEN
        new_secret_hash := NULL;
    ELSE
        new_secret_hash := crypt(client_secret, gen_salt('bf', 10));
    END IF;

    -- Derive is_public from resolved secret
    new_is_public := (new_secret_hash IS NULL);

    -- Resolve auth method: force 'none' for public, otherwise use provided or keep existing
    IF new_is_public THEN
        v_auth_method := 'none';
    ELSIF token_endpoint_auth_method IS NOT NULL THEN
        v_auth_method := token_endpoint_auth_method;
    ELSE
        SELECT o.token_endpoint_auth_method INTO v_auth_method
        FROM auth.oauth2_clients o WHERE o.client_id = p_client_id;
    END IF;

    UPDATE auth.oauth2_clients SET
        client_name                 = COALESCE(modify_oauth2_client.client_name, auth.oauth2_clients.client_name),
        client_secret_hash          = new_secret_hash,
        redirect_uris               = COALESCE(modify_oauth2_client.redirect_uris, auth.oauth2_clients.redirect_uris),
        client_uri                  = COALESCE(modify_oauth2_client.client_uri, auth.oauth2_clients.client_uri),
        logo_uri                    = COALESCE(modify_oauth2_client.logo_uri, auth.oauth2_clients.logo_uri),
        grant_types                 = COALESCE(modify_oauth2_client.grant_types, auth.oauth2_clients.grant_types),
        response_types              = COALESCE(modify_oauth2_client.response_types, auth.oauth2_clients.response_types),
        scopes                      = COALESCE(modify_oauth2_client.scopes, auth.oauth2_clients.scopes),
        is_public                   = new_is_public,
        token_endpoint_auth_method  = v_auth_method,
        id_token_signed_response_alg = COALESCE(modify_oauth2_client.id_token_signed_response_alg, auth.oauth2_clients.id_token_signed_response_alg),
        access_token_lifetime       = COALESCE(modify_oauth2_client.access_token_lifetime, auth.oauth2_clients.access_token_lifetime),
        refresh_token_lifetime      = COALESCE(modify_oauth2_client.refresh_token_lifetime, auth.oauth2_clients.refresh_token_lifetime),
        type                        = COALESCE(modify_oauth2_client.type, auth.oauth2_clients.type),
        metadata                    = COALESCE(modify_oauth2_client.metadata, auth.oauth2_clients.metadata)
    WHERE auth.oauth2_clients.client_id = p_client_id
    RETURNING * INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION auth.modify_oauth2_client(p_client_id text, client_name text, client_secret text, redirect_uris text[], client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb) OWNER TO postgres;

--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.set_current_timestamp_updated_at() RETURNS trigger
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


ALTER FUNCTION auth.set_current_timestamp_updated_at() OWNER TO postgres;

--
-- Name: oauth2_auth_requests; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth2_auth_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    redirect_uri text NOT NULL,
    state text,
    nonce text,
    response_type text NOT NULL,
    code_challenge text,
    code_challenge_method text,
    resource text,
    user_id uuid,
    done boolean DEFAULT false NOT NULL,
    auth_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth2_auth_requests OWNER TO postgres;

--
-- Name: TABLE oauth2_auth_requests; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.oauth2_auth_requests IS 'In-flight OAuth2 authorization requests.';


--
-- Name: oauth2_authorization_codes; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth2_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_hash text NOT NULL,
    auth_request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth2_authorization_codes OWNER TO postgres;

--
-- Name: TABLE oauth2_authorization_codes; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.oauth2_authorization_codes IS 'OAuth2 authorization codes pending exchange for tokens.';


--
-- Name: oauth2_client_types; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth2_client_types (
    value text NOT NULL,
    comment text
);


ALTER TABLE auth.oauth2_client_types OWNER TO postgres;

--
-- Name: oauth2_refresh_tokens; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth2_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    auth_request_id uuid,
    client_id text NOT NULL,
    user_id uuid NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth2_refresh_tokens OWNER TO postgres;

--
-- Name: TABLE oauth2_refresh_tokens; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.oauth2_refresh_tokens IS 'OAuth2 refresh tokens with client and scope binding.';


--
-- Name: provider_requests; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.provider_requests (
    id uuid NOT NULL,
    options jsonb
);


ALTER TABLE auth.provider_requests OWNER TO postgres;

--
-- Name: TABLE provider_requests; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.provider_requests IS 'Oauth requests, inserted before redirecting to the provider''s site. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: providers; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.providers (
    id text NOT NULL
);


ALTER TABLE auth.providers OWNER TO postgres;

--
-- Name: TABLE providers; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.providers IS 'List of available Oauth providers. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: refresh_token_types; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.refresh_token_types (
    value text NOT NULL,
    comment text
);


ALTER TABLE auth.refresh_token_types OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    user_id uuid NOT NULL,
    metadata jsonb,
    type text DEFAULT 'regular'::text NOT NULL,
    refresh_token_hash character varying(255)
);


ALTER TABLE auth.refresh_tokens OWNER TO postgres;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.refresh_tokens IS 'User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: roles; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.roles (
    role text NOT NULL
);


ALTER TABLE auth.roles OWNER TO postgres;

--
-- Name: TABLE roles; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.roles IS 'Persistent Hasura roles for users. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO postgres;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.schema_migrations IS 'Internal table for tracking migrations. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: user_providers; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.user_providers (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    provider_id text NOT NULL,
    provider_user_id text NOT NULL
);


ALTER TABLE auth.user_providers OWNER TO postgres;

--
-- Name: TABLE user_providers; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.user_providers IS 'Active providers for a given user. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: user_roles; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.user_roles (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL
);


ALTER TABLE auth.user_roles OWNER TO postgres;

--
-- Name: TABLE user_roles; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.user_roles IS 'Roles of users. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: user_security_keys; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.user_security_keys (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id text NOT NULL,
    credential_public_key bytea,
    counter bigint DEFAULT 0 NOT NULL,
    transports character varying(255) DEFAULT ''::character varying NOT NULL,
    nickname text
);


ALTER TABLE auth.user_security_keys OWNER TO postgres;

--
-- Name: TABLE user_security_keys; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.user_security_keys IS 'User webauthn security keys. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.users (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone,
    disabled boolean DEFAULT false NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    avatar_url text DEFAULT ''::text NOT NULL,
    locale character varying(3) NOT NULL,
    email auth.email,
    phone_number text,
    password_hash text,
    email_verified boolean DEFAULT false NOT NULL,
    phone_number_verified boolean DEFAULT false NOT NULL,
    new_email auth.email,
    otp_method_last_used text,
    otp_hash text,
    otp_hash_expires_at timestamp with time zone DEFAULT now() NOT NULL,
    default_role text DEFAULT 'user'::text NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    totp_secret text,
    active_mfa_type text,
    ticket text,
    ticket_expires_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb,
    webauthn_current_challenge text,
    CONSTRAINT active_mfa_types_check CHECK (((active_mfa_type = 'totp'::text) OR (active_mfa_type = 'sms'::text)))
);


ALTER TABLE auth.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.users IS 'User account information. Don''t modify its structure as Hasura Auth relies on it to function properly.';


--
-- Name: oauth2_auth_requests oauth2_auth_requests_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_auth_requests
    ADD CONSTRAINT oauth2_auth_requests_pkey PRIMARY KEY (id);


--
-- Name: oauth2_authorization_codes oauth2_authorization_codes_code_hash_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_authorization_codes
    ADD CONSTRAINT oauth2_authorization_codes_code_hash_key UNIQUE (code_hash);


--
-- Name: oauth2_authorization_codes oauth2_authorization_codes_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_authorization_codes
    ADD CONSTRAINT oauth2_authorization_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth2_client_types oauth2_client_types_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_client_types
    ADD CONSTRAINT oauth2_client_types_pkey PRIMARY KEY (value);


--
-- Name: oauth2_clients oauth2_clients_client_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_clients
    ADD CONSTRAINT oauth2_clients_client_id_key UNIQUE (client_id);


--
-- Name: oauth2_clients oauth2_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_clients
    ADD CONSTRAINT oauth2_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth2_refresh_tokens oauth2_refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_refresh_tokens
    ADD CONSTRAINT oauth2_refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: oauth2_refresh_tokens oauth2_refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_refresh_tokens
    ADD CONSTRAINT oauth2_refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: provider_requests provider_requests_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.provider_requests
    ADD CONSTRAINT provider_requests_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: refresh_token_types refresh_token_types_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_token_types
    ADD CONSTRAINT refresh_token_types_pkey PRIMARY KEY (value);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: user_providers user_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_providers
    ADD CONSTRAINT user_providers_pkey PRIMARY KEY (id);


--
-- Name: user_providers user_providers_provider_id_provider_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_providers
    ADD CONSTRAINT user_providers_provider_id_provider_user_id_key UNIQUE (provider_id, provider_user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_security_keys user_security_key_credential_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_security_keys
    ADD CONSTRAINT user_security_key_credential_id_key UNIQUE (credential_id);


--
-- Name: user_security_keys user_security_keys_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_security_keys
    ADD CONSTRAINT user_security_keys_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: oauth2_auth_requests_client_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_auth_requests_client_id_idx ON auth.oauth2_auth_requests USING btree (client_id);


--
-- Name: oauth2_auth_requests_expires_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_auth_requests_expires_at_idx ON auth.oauth2_auth_requests USING btree (expires_at);


--
-- Name: oauth2_authorization_codes_expires_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_authorization_codes_expires_at_idx ON auth.oauth2_authorization_codes USING btree (expires_at);


--
-- Name: oauth2_clients_created_by_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_clients_created_by_idx ON auth.oauth2_clients USING btree (created_by);


--
-- Name: oauth2_refresh_tokens_client_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_refresh_tokens_client_id_idx ON auth.oauth2_refresh_tokens USING btree (client_id);


--
-- Name: oauth2_refresh_tokens_expires_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_refresh_tokens_expires_at_idx ON auth.oauth2_refresh_tokens USING btree (expires_at);


--
-- Name: oauth2_refresh_tokens_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth2_refresh_tokens_user_id_idx ON auth.oauth2_refresh_tokens USING btree (user_id);


--
-- Name: refresh_tokens_refresh_token_hash_expires_at_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_refresh_token_hash_expires_at_user_id_idx ON auth.refresh_tokens USING btree (refresh_token_hash, expires_at, user_id);


--
-- Name: oauth2_clients set_auth_oauth2_clients_updated_at; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER set_auth_oauth2_clients_updated_at BEFORE UPDATE ON auth.oauth2_clients FOR EACH ROW EXECUTE FUNCTION auth.set_current_timestamp_updated_at();


--
-- Name: user_providers set_auth_user_providers_updated_at; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER set_auth_user_providers_updated_at BEFORE UPDATE ON auth.user_providers FOR EACH ROW EXECUTE FUNCTION auth.set_current_timestamp_updated_at();


--
-- Name: users set_auth_users_updated_at; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER set_auth_users_updated_at BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION auth.set_current_timestamp_updated_at();


--
-- Name: users fk_default_role; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT fk_default_role FOREIGN KEY (default_role) REFERENCES auth.roles(role) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: oauth2_auth_requests fk_oauth2_auth_requests_client; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_auth_requests
    ADD CONSTRAINT fk_oauth2_auth_requests_client FOREIGN KEY (client_id) REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: oauth2_auth_requests fk_oauth2_auth_requests_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_auth_requests
    ADD CONSTRAINT fk_oauth2_auth_requests_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: oauth2_authorization_codes fk_oauth2_authorization_codes_auth_request; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_authorization_codes
    ADD CONSTRAINT fk_oauth2_authorization_codes_auth_request FOREIGN KEY (auth_request_id) REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: oauth2_clients fk_oauth2_clients_created_by; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_clients
    ADD CONSTRAINT fk_oauth2_clients_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: oauth2_clients fk_oauth2_clients_type; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_clients
    ADD CONSTRAINT fk_oauth2_clients_type FOREIGN KEY (type) REFERENCES auth.oauth2_client_types(value) ON DELETE RESTRICT;


--
-- Name: oauth2_refresh_tokens fk_oauth2_refresh_tokens_auth_request; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_refresh_tokens
    ADD CONSTRAINT fk_oauth2_refresh_tokens_auth_request FOREIGN KEY (auth_request_id) REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: oauth2_refresh_tokens fk_oauth2_refresh_tokens_client; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_refresh_tokens
    ADD CONSTRAINT fk_oauth2_refresh_tokens_client FOREIGN KEY (client_id) REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: oauth2_refresh_tokens fk_oauth2_refresh_tokens_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth2_refresh_tokens
    ADD CONSTRAINT fk_oauth2_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_providers fk_provider; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_providers
    ADD CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES auth.providers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles fk_role; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT fk_role FOREIGN KEY (role) REFERENCES auth.roles(role) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens fk_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_providers fk_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_providers
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles fk_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_security_keys fk_user; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.user_security_keys
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_types_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_types_fkey FOREIGN KEY (type) REFERENCES auth.refresh_token_types(value) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: nhost_admin
--

GRANT ALL ON SCHEMA auth TO nhost_auth_admin;
GRANT USAGE ON SCHEMA auth TO nhost_hasura;


--
-- Name: TABLE oauth2_clients; Type: ACL; Schema: auth; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.oauth2_clients TO nhost_auth_admin;
GRANT SELECT,DELETE ON TABLE auth.oauth2_clients TO nhost_hasura;


--
-- Name: FUNCTION create_oauth2_client(hasura_session json, client_name text, redirect_uris text[], client_secret text, client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.create_oauth2_client(hasura_session json, client_name text, redirect_uris text[], client_secret text, client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb) TO nhost_hasura;


--
-- Name: FUNCTION modify_oauth2_client(p_client_id text, client_name text, client_secret text, redirect_uris text[], client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.modify_oauth2_client(p_client_id text, client_name text, client_secret text, redirect_uris text[], client_uri text, logo_uri text, grant_types text[], response_types text[], scopes text[], token_endpoint_auth_method text, id_token_signed_response_alg text, access_token_lifetime integer, refresh_token_lifetime integer, type text, metadata jsonb) TO nhost_hasura;


--
-- Name: TABLE oauth2_auth_requests; Type: ACL; Schema: auth; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.oauth2_auth_requests TO nhost_auth_admin;
GRANT SELECT ON TABLE auth.oauth2_auth_requests TO nhost_hasura;


--
-- Name: TABLE oauth2_authorization_codes; Type: ACL; Schema: auth; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.oauth2_authorization_codes TO nhost_auth_admin;
GRANT SELECT ON TABLE auth.oauth2_authorization_codes TO nhost_hasura;


--
-- Name: TABLE oauth2_client_types; Type: ACL; Schema: auth; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.oauth2_client_types TO nhost_auth_admin;
GRANT SELECT ON TABLE auth.oauth2_client_types TO nhost_hasura;


--
-- Name: TABLE oauth2_refresh_tokens; Type: ACL; Schema: auth; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.oauth2_refresh_tokens TO nhost_auth_admin;
GRANT SELECT ON TABLE auth.oauth2_refresh_tokens TO nhost_hasura;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: nhost_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE nhost_auth_admin IN SCHEMA auth GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO nhost_hasura;


--
-- PostgreSQL database dump complete
--


