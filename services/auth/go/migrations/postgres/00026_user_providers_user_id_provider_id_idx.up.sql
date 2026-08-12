-- Serves the per-request lookups keyed on the user (GetUserProviderIDsByUserID,
-- GetProviderSession). Migration 00017 dropped UNIQUE (user_id, provider_id)
-- deliberately, so a user may hold several identities per provider — this is
-- a non-unique index, not a reinstated constraint.
--
-- CONCURRENTLY and IF NOT EXISTS for the same reasons as 00025; the same
-- recovery applies with this index's name.
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_providers_user_id_provider_id_idx
    ON auth.user_providers (user_id, provider_id);
