-- Keep the issuer alongside provider rows and identities: migration 29 needs it
-- to restore identity issuer bindings after a rollback below version 28.
DROP INDEX auth.user_providers_oidc_user_id_idx;
ALTER TABLE auth.providers DROP CONSTRAINT providers_oidc_issuer_check;
