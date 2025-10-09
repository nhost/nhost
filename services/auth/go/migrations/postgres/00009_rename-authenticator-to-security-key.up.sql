-- start a transaction
BEGIN;
ALTER TABLE auth.user_authenticators RENAME TO user_security_keys;
ALTER TABLE auth.user_security_keys RENAME CONSTRAINT user_authenticators_credential_id_key TO user_security_key_credential_id_key;
ALTER TABLE auth.user_security_keys RENAME CONSTRAINT user_authenticators_pkey TO user_security_keys_pkey;
COMMENT ON TABLE auth.user_security_keys IS 'User webauthn security keys. Don''t modify its structure as Hasura Auth relies on it to function properly.';
COMMIT;

