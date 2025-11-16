ALTER TABLE ONLY auth.user_providers
    DROP CONSTRAINT IF EXISTS user_providers_user_id_provider_id_key;
