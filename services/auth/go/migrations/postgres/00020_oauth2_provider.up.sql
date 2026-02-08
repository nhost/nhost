-- OAuth2/OIDC Identity Provider tables

-- Signing keys for JWT tokens (RSA key pairs)
CREATE TABLE auth.oauth2_signing_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    private_key bytea NOT NULL,
    public_key bytea NOT NULL,
    algorithm text NOT NULL DEFAULT 'RS256',
    key_id text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    PRIMARY KEY (id),
    UNIQUE (key_id)
);

COMMENT ON TABLE auth.oauth2_signing_keys IS 'RSA key pairs for OAuth2/OIDC token signing. Private keys are stored encrypted.';

-- Registered OAuth2 client applications
CREATE TABLE auth.oauth2_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text NOT NULL,
    client_secret_hash text,
    client_name text NOT NULL,
    client_uri text,
    logo_uri text,
    redirect_uris text[] NOT NULL DEFAULT '{}',
    grant_types text[] NOT NULL DEFAULT '{authorization_code}',
    response_types text[] NOT NULL DEFAULT '{code}',
    scopes text[] NOT NULL DEFAULT '{openid}',
    is_public boolean NOT NULL DEFAULT false,
    token_endpoint_auth_method text NOT NULL DEFAULT 'client_secret_basic',
    id_token_signed_response_alg text NOT NULL DEFAULT 'RS256',
    access_token_lifetime integer NOT NULL DEFAULT 900,
    refresh_token_lifetime integer NOT NULL DEFAULT 2592000,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (client_id)
);

COMMENT ON TABLE auth.oauth2_clients IS 'Registered OAuth2 client applications for the identity provider.';

CREATE TRIGGER set_auth_oauth2_clients_updated_at
    BEFORE UPDATE ON auth.oauth2_clients
    FOR EACH ROW EXECUTE FUNCTION auth.set_current_timestamp_updated_at();

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
        REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
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
        REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE auth.oauth2_refresh_tokens IS 'OAuth2 refresh tokens with client and scope binding.';

-- Indexes
CREATE INDEX oauth2_auth_requests_client_id_idx ON auth.oauth2_auth_requests (client_id);
CREATE INDEX oauth2_auth_requests_expires_at_idx ON auth.oauth2_auth_requests (expires_at);
CREATE INDEX oauth2_authorization_codes_expires_at_idx ON auth.oauth2_authorization_codes (expires_at);
CREATE INDEX oauth2_refresh_tokens_user_id_idx ON auth.oauth2_refresh_tokens (user_id);
CREATE INDEX oauth2_refresh_tokens_client_id_idx ON auth.oauth2_refresh_tokens (client_id);
CREATE INDEX oauth2_refresh_tokens_expires_at_idx ON auth.oauth2_refresh_tokens (expires_at);

-- Grants
GRANT ALL ON auth.oauth2_signing_keys TO nhost_auth_admin;
GRANT ALL ON auth.oauth2_clients TO nhost_auth_admin;
GRANT ALL ON auth.oauth2_auth_requests TO nhost_auth_admin;
GRANT ALL ON auth.oauth2_authorization_codes TO nhost_auth_admin;
GRANT ALL ON auth.oauth2_refresh_tokens TO nhost_auth_admin;

GRANT SELECT ON auth.oauth2_signing_keys TO nhost_hasura;
GRANT SELECT ON auth.oauth2_clients TO nhost_hasura;
GRANT SELECT ON auth.oauth2_auth_requests TO nhost_hasura;
GRANT SELECT ON auth.oauth2_authorization_codes TO nhost_hasura;
GRANT SELECT ON auth.oauth2_refresh_tokens TO nhost_hasura;
