-- Hasura's UPDATE event trigger lists columns explicitly (including provider and
-- dimensions) and is not dropped by DDL outside run_sql. Drop it so updates keep
-- working until the older image re-creates the trigger on startup.
DROP TRIGGER IF EXISTS "notify_hasura_ai_auto_embeddings_conf_events_UPDATE"
  ON ai.auto_embeddings_configuration;

ALTER TABLE ai.auto_embeddings_configuration
  DROP CONSTRAINT auto_embeddings_provider_length,
  DROP CONSTRAINT auto_embeddings_dimensions_range,
  DROP COLUMN provider,
  DROP COLUMN dimensions,
  DROP COLUMN last_error;
