ALTER TABLE auth.providers ADD COLUMN IF NOT EXISTS oidc_issuer text;

ALTER TABLE auth.providers
    ADD CONSTRAINT providers_oidc_issuer_check CHECK (
        oidc_issuer IS NULL OR (id LIKE 'oidc:%' AND oidc_issuer <> '')
    );

CREATE INDEX user_providers_oidc_user_id_idx ON auth.user_providers (user_id)
    WHERE provider_id LIKE 'oidc:%';
