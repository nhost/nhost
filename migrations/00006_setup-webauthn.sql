-- start a transaction
BEGIN;

ALTER TABLE auth.users
    ADD COLUMN webauthn_current_challenge text;

CREATE TABLE auth.user_authenticators(
    id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL,
    credential_id text UNIQUE NOT NULL,
    credential_public_key bytea,
    counter bigint DEFAULT 0 NOT NULL,
    transports varchar(255) DEFAULT '' NOT NULL
);

COMMENT ON TABLE auth.user_authenticators IS 'User webauthn authenticators. Don''t modify its structure as Hasura Auth relies on it to function properly.';


-- FKs
ALTER TABLE auth.user_authenticators
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;