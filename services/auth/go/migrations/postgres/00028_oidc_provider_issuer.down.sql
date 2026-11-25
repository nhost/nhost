-- Keep provider rows and identities. Custom subjects include the issuer in
-- their stored keys, so removing the registration column cannot reinterpret them.
DROP INDEX auth.user_providers_oidc_user_id_idx;
ALTER TABLE auth.providers DROP CONSTRAINT providers_oidc_issuer_check, DROP COLUMN oidc_issuer;
