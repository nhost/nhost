-- OAuth2/OIDC Identity Provider tables

-- Generate a unique client_id with 'nhoa_' prefix
CREATE OR REPLACE FUNCTION auth.generate_oauth2_client_id()
RETURNS text
LANGUAGE sql
AS $$
    SELECT 'nhoa_' || substring(encode(sha256(gen_random_uuid()::text::bytea), 'hex') from 1 for 16);
$$;

-- Registered OAuth2 client applications
CREATE TABLE auth.oauth2_clients (
    client_id text NOT NULL DEFAULT auth.generate_oauth2_client_id(),
    client_secret_hash text,
    redirect_uris text[] NOT NULL DEFAULT '{}',
    scopes text[] NOT NULL DEFAULT '{openid,profile,email,phone,offline_access,graphql}',
    type text NOT NULL DEFAULT 'registered',
    metadata JSONB,
    metadata_document_fetched_at timestamptz,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (client_id),
    CONSTRAINT fk_oauth2_clients_created_by FOREIGN KEY (created_by)
        REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT oauth2_clients_type_check
        CHECK (type IN ('registered', 'client_id_metadata_document')),
    CONSTRAINT oauth2_clients_scopes_check
        CHECK (scopes <@ ARRAY['openid','profile','email','phone','offline_access','graphql']::text[])
);

COMMENT ON TABLE auth.oauth2_clients IS 'Registered OAuth2 client applications for the identity provider.';

CREATE TRIGGER set_auth_oauth2_clients_updated_at
    BEFORE UPDATE ON auth.oauth2_clients
    FOR EACH ROW EXECUTE FUNCTION auth.set_current_timestamp_updated_at();

-- Reject plaintext or non-bcrypt values in client_secret_hash
CREATE OR REPLACE FUNCTION auth.check_oauth2_client_secret_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.client_secret_hash IS NOT NULL
       AND NEW.client_secret_hash !~ '^\$2[aby]?\$' THEN
        RAISE EXCEPTION 'client_secret_hash must be a bcrypt hash'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_oauth2_client_secret_hash
    BEFORE INSERT OR UPDATE ON auth.oauth2_clients
    FOR EACH ROW EXECUTE FUNCTION auth.check_oauth2_client_secret_hash();

-- In-flight authorization requests
CREATE TABLE auth.oauth2_auth_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{}',
    redirect_uri text NOT NULL,
    state text,
    nonce text,
    response_type text NOT NULL,
    code_challenge text,
    code_challenge_method text,
    resource text,
    user_id uuid,
    done boolean NOT NULL DEFAULT false,
    auth_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_oauth2_auth_requests_client FOREIGN KEY (client_id)
        REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oauth2_auth_requests_user FOREIGN KEY (user_id)
        REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT oauth2_auth_requests_scopes_check
        CHECK (scopes <@ ARRAY['openid','profile','email','phone','offline_access','graphql']::text[])
);

COMMENT ON TABLE auth.oauth2_auth_requests IS 'In-flight OAuth2 authorization requests.';

-- Authorization codes (pending exchange)
CREATE TABLE auth.oauth2_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_hash text NOT NULL,
    auth_request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (code_hash),
    CONSTRAINT fk_oauth2_authorization_codes_auth_request FOREIGN KEY (auth_request_id)
        REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE auth.oauth2_authorization_codes IS 'OAuth2 authorization codes pending exchange for tokens.';

-- OAuth2 refresh tokens (separate from session refresh tokens)
CREATE TABLE auth.oauth2_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    auth_request_id uuid,
    client_id text NOT NULL,
    user_id uuid NOT NULL,
    scopes text[] NOT NULL DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (token_hash),
    CONSTRAINT fk_oauth2_refresh_tokens_auth_request FOREIGN KEY (auth_request_id)
        REFERENCES auth.oauth2_auth_requests(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_oauth2_refresh_tokens_client FOREIGN KEY (client_id)
        REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oauth2_refresh_tokens_user FOREIGN KEY (user_id)
        REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT oauth2_refresh_tokens_scopes_check
        CHECK (scopes <@ ARRAY['openid','profile','email','phone','offline_access','graphql']::text[])
);

COMMENT ON TABLE auth.oauth2_refresh_tokens IS 'OAuth2 refresh tokens with client and scope binding.';

-- Indexes
CREATE INDEX IF NOT EXISTS oauth2_auth_requests_client_id_idx ON auth.oauth2_auth_requests (client_id);
CREATE INDEX IF NOT EXISTS oauth2_auth_requests_expires_at_idx ON auth.oauth2_auth_requests (expires_at);
CREATE INDEX IF NOT EXISTS oauth2_auth_requests_user_id_idx ON auth.oauth2_auth_requests (user_id);
CREATE INDEX IF NOT EXISTS oauth2_authorization_codes_expires_at_idx ON auth.oauth2_authorization_codes (expires_at);
CREATE INDEX IF NOT EXISTS oauth2_refresh_tokens_user_id_idx ON auth.oauth2_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth2_refresh_tokens_client_id_idx ON auth.oauth2_refresh_tokens (client_id);
CREATE INDEX IF NOT EXISTS oauth2_refresh_tokens_expires_at_idx ON auth.oauth2_refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS oauth2_clients_created_by_idx ON auth.oauth2_clients (created_by);
