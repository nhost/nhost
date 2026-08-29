CREATE TYPE graphite.embedding_model_enum AS ENUM (
    'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large');

ALTER TABLE graphite.auto_embeddings_configuration
ADD COLUMN model graphite.embedding_model_enum NOT NULL DEFAULT 'text-embedding-ada-002';
