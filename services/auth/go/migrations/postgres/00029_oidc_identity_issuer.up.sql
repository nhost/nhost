ALTER TABLE auth.providers
    ADD CONSTRAINT providers_id_oidc_issuer_key UNIQUE (id, oidc_issuer);

ALTER TABLE auth.user_providers ADD COLUMN issuer text;

UPDATE auth.user_providers AS identity
SET issuer = provider.oidc_issuer
FROM auth.providers AS provider
WHERE identity.provider_id = provider.id AND identity.provider_id LIKE 'oidc:%';

ALTER TABLE auth.user_providers
    ADD CONSTRAINT user_providers_oidc_issuer_check
        CHECK ((provider_id LIKE 'oidc:%') = (issuer IS NOT NULL)),
    ADD CONSTRAINT user_providers_oidc_issuer_fkey
        FOREIGN KEY (provider_id, issuer) REFERENCES auth.providers (id, oidc_issuer);
