-- is_valid_oauth2_scope validates a single scope string. It accepts the
-- standard fixed scopes as well as parameterised "graphql:role:<name>" scopes.
CREATE OR REPLACE FUNCTION auth.is_valid_oauth2_scope(scope text)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
AS $$
    SELECT scope IN ('openid', 'profile', 'email', 'phone', 'offline_access', 'graphql')
        OR scope ~ '^graphql:role:[a-zA-Z0-9_:.-]+$'
$$;

-- validate_oauth2_scopes is a trigger function that checks every element of
-- NEW.scopes against is_valid_oauth2_scope. This replaces the old <@ CHECK
-- constraints which could not handle the dynamic graphql:role:xxxx pattern.
CREATE OR REPLACE FUNCTION auth.validate_oauth2_scopes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    s text;
BEGIN
    FOREACH s IN ARRAY NEW.scopes LOOP
        IF NOT auth.is_valid_oauth2_scope(s) THEN
            RAISE EXCEPTION 'invalid oauth2 scope: %', s
                USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

-- Replace CHECK constraints with trigger-based validation.

ALTER TABLE auth.oauth2_clients
    DROP CONSTRAINT IF EXISTS oauth2_clients_scopes_check;

ALTER TABLE auth.oauth2_auth_requests
    DROP CONSTRAINT IF EXISTS oauth2_auth_requests_scopes_check;

ALTER TABLE auth.oauth2_refresh_tokens
    DROP CONSTRAINT IF EXISTS oauth2_refresh_tokens_scopes_check;

CREATE TRIGGER validate_oauth2_clients_scopes
    BEFORE INSERT OR UPDATE ON auth.oauth2_clients
    FOR EACH ROW EXECUTE FUNCTION auth.validate_oauth2_scopes();

CREATE TRIGGER validate_oauth2_auth_requests_scopes
    BEFORE INSERT OR UPDATE ON auth.oauth2_auth_requests
    FOR EACH ROW EXECUTE FUNCTION auth.validate_oauth2_scopes();

CREATE TRIGGER validate_oauth2_refresh_tokens_scopes
    BEFORE INSERT OR UPDATE ON auth.oauth2_refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION auth.validate_oauth2_scopes();
