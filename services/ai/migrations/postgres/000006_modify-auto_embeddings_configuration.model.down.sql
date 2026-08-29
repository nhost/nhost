CREATE TYPE graphite.embedding_model_enum AS ENUM (
    'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large');

ALTER TABLE graphite.auto_embeddings_configuration
ALTER COLUMN model SET DATA TYPE graphite.embedding_model_enum,
ALTER COLUMN model SET DEFAULT 'text-embedding-ada-002',
ALTER COLUMN model SET NOT NULL;
