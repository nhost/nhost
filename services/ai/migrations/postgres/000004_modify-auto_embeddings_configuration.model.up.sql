ALTER TABLE ai.auto_embeddings_configuration
ALTER COLUMN model DROP DEFAULT,
ALTER COLUMN model SET DATA TYPE TEXT USING model::TEXT,
ALTER COLUMN model SET DEFAULT 'text-embedding-ada-002',
ALTER COLUMN model SET NOT NULL;

DROP TYPE ai.embedding_model_enum;
