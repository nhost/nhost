ALTER TABLE graphite.auto_embeddings_configuration
ALTER COLUMN model SET DATA TYPE TEXT,
ALTER COLUMN model SET DEFAULT 'text-embedding-ada-002',
ALTER COLUMN model SET NOT NULL;

DROP TYPE IF EXISTS embedding_model_enum;
DROP TYPE IF EXISTS graphite.embedding_model_enum;
