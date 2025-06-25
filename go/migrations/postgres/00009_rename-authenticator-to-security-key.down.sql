-- start a transaction
BEGIN;
COMMENT ON TABLE auth.user_security_keys IS 'User webauthn authenticators. Don''t modify its structure as Hasura Auth relies on it to function properly.';
ALTER TABLE auth.user_security_keys RENAME CONSTRAINT user_security_keys_pkey TO user_authenticators_pkey;
ALTER TABLE auth.user_security_keys RENAME CONSTRAINT user_security_key_credential_id_key TO user_authenticators_credential_id_key;
ALTER TABLE auth.user_security_keys RENAME TO user_authenticators;
COMMIT;