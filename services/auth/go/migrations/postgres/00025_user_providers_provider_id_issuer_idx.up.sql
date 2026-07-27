-- Serves the startup issuer probes (GetUserProviderConflictingIssuer,
-- GetUserProviderRecordedIssuer). Their healthy case is also their worst
-- case: nothing matches, so without a covering index they visit every
-- identity row of the provider on every process start.
--
-- CONCURRENTLY, and alone in this file: a single-statement migration is not a
-- transaction block, which is what makes CONCURRENTLY legal here and keeps
-- provider sign-in traffic served while the index builds. IF NOT EXISTS so an
-- operator can pre-create the index ahead of the rollout without the
-- migration then failing with 42P07 and marking schema_migrations dirty.
--
-- Recovery if the build fails: it leaves an INVALID index that IF NOT EXISTS
-- will match rather than replace, so run
-- `DROP INDEX auth.user_providers_provider_id_issuer_idx;` before retrying.
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_providers_provider_id_issuer_idx
    ON auth.user_providers (provider_id, issuer);
