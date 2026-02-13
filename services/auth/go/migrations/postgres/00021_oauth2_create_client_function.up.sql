-- Generation function for client_id
CREATE OR REPLACE FUNCTION auth.generate_oauth2_client_id()
RETURNS text
LANGUAGE sql
AS $$
    SELECT 'nhoa_' || substring(encode(sha256(gen_random_uuid()::text::bytea), 'hex') from 1 for 16);
$$;

ALTER TABLE auth.oauth2_clients ALTER COLUMN client_id SET DEFAULT auth.generate_oauth2_client_id();

-- Create OAuth2 client: generates client_id, hashes secret, derives is_public
CREATE OR REPLACE FUNCTION auth.create_oauth2_client(
    hasura_session json,
    client_name text,
    redirect_uris text[] DEFAULT '{}'::text[],
    client_secret text DEFAULT NULL,
    client_uri text DEFAULT NULL,
    logo_uri text DEFAULT NULL,
    grant_types text[] DEFAULT '{authorization_code}'::text[],
    response_types text[] DEFAULT '{code}'::text[],
    scopes text[] DEFAULT '{openid,profile,email,phone,offline_access,graphql}'::text[],
    token_endpoint_auth_method text DEFAULT 'client_secret_basic',
    id_token_signed_response_alg text DEFAULT 'RS256',
    access_token_lifetime integer DEFAULT 900,
    refresh_token_lifetime integer DEFAULT 2592000,
    type text DEFAULT 'registered',
    metadata jsonb DEFAULT NULL
)
RETURNS auth.oauth2_clients
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
        secret_hash := crypt(client_secret, gen_salt('bf'));
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

-- Update OAuth2 client: hashes new secret on rotation, re-derives is_public.
-- NULL parameters mean "keep existing value". For client_secret specifically:
--   NULL  = don't change
--   ''    = remove secret (make public)
--   'xxx' = set new secret (will be hashed)
CREATE OR REPLACE FUNCTION auth.modify_oauth2_client(
    p_client_id text,
    client_name text DEFAULT NULL,
    client_secret text DEFAULT NULL,
    redirect_uris text[] DEFAULT NULL,
    client_uri text DEFAULT NULL,
    logo_uri text DEFAULT NULL,
    grant_types text[] DEFAULT NULL,
    response_types text[] DEFAULT NULL,
    scopes text[] DEFAULT NULL,
    token_endpoint_auth_method text DEFAULT NULL,
    id_token_signed_response_alg text DEFAULT NULL,
    access_token_lifetime integer DEFAULT NULL,
    refresh_token_lifetime integer DEFAULT NULL,
    type text DEFAULT NULL,
    metadata jsonb DEFAULT NULL
)
RETURNS auth.oauth2_clients
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
        new_secret_hash := crypt(client_secret, gen_salt('bf'));
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

-- Grant EXECUTE to nhost_hasura so Hasura can track the functions as mutations
GRANT EXECUTE ON FUNCTION auth.create_oauth2_client TO nhost_hasura;
GRANT EXECUTE ON FUNCTION auth.modify_oauth2_client TO nhost_hasura;

-- DELETE remains a direct table operation (no business logic needed)
GRANT DELETE ON auth.oauth2_clients TO nhost_hasura;
