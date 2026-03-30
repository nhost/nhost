-- Restore the original CHECK constraints. This will fail if any rows contain
-- graphql:role:xxxx scopes that are not in the fixed set.

DROP TRIGGER IF EXISTS validate_oauth2_clients_scopes ON auth.oauth2_clients;
DROP TRIGGER IF EXISTS validate_oauth2_auth_requests_scopes ON auth.oauth2_auth_requests;
DROP TRIGGER IF EXISTS validate_oauth2_refresh_tokens_scopes ON auth.oauth2_refresh_tokens;

DROP FUNCTION IF EXISTS auth.validate_oauth2_scopes();
DROP FUNCTION IF EXISTS auth.is_valid_oauth2_scope(text);

ALTER TABLE auth.oauth2_clients
    ADD CONSTRAINT oauth2_clients_scopes_check
    CHECK ((scopes <@ ARRAY['openid'::text, 'profile'::text, 'email'::text, 'phone'::text, 'offline_access'::text, 'graphql'::text]));

ALTER TABLE auth.oauth2_auth_requests
    ADD CONSTRAINT oauth2_auth_requests_scopes_check
    CHECK ((scopes <@ ARRAY['openid'::text, 'profile'::text, 'email'::text, 'phone'::text, 'offline_access'::text, 'graphql'::text]));

ALTER TABLE auth.oauth2_refresh_tokens
    ADD CONSTRAINT oauth2_refresh_tokens_scopes_check
    CHECK ((scopes <@ ARRAY['openid'::text, 'profile'::text, 'email'::text, 'phone'::text, 'offline_access'::text, 'graphql'::text]));
