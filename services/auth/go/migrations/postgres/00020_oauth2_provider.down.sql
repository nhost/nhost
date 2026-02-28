DROP TABLE IF EXISTS auth.oauth2_refresh_tokens;
DROP TABLE IF EXISTS auth.oauth2_authorization_codes;
DROP TABLE IF EXISTS auth.oauth2_auth_requests;
DROP TABLE IF EXISTS auth.oauth2_clients;

DROP FUNCTION IF EXISTS auth.generate_oauth2_client_id() CASCADE;
DROP FUNCTION IF EXISTS auth.check_oauth2_client_secret_hash() CASCADE;
