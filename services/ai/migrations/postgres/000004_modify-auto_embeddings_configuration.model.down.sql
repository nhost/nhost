CREATE TYPE ai.embedding_model_enum AS ENUM (
    'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large');

UPDATE ai.auto_embeddings_configuration
SET model = 'text-embedding-ada-002'
WHERE model NOT IN (
    'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'
);

ALTER TABLE ai.auto_embeddings_configuration
ALTER COLUMN model DROP DEFAULT,
ALTER COLUMN model SET DATA TYPE ai.embedding_model_enum
    USING model::ai.embedding_model_enum,
ALTER COLUMN model SET DEFAULT 'text-embedding-ada-002'::ai.embedding_model_enum,
ALTER COLUMN model SET NOT NULL;
