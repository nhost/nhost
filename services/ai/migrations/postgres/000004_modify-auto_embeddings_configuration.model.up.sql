ALTER TABLE graphite.auto_embeddings_configuration
ALTER COLUMN model DROP DEFAULT,
ALTER COLUMN model SET DATA TYPE TEXT USING model::TEXT,
ALTER COLUMN model SET DEFAULT 'text-embedding-ada-002',
ALTER COLUMN model SET NOT NULL;

DROP TYPE graphite.embedding_model_enum;
