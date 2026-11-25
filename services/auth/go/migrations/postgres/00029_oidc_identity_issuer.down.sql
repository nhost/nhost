ALTER TABLE auth.user_providers DROP COLUMN issuer;

ALTER TABLE auth.providers DROP CONSTRAINT providers_id_oidc_issuer_key;
