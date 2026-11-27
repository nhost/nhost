ALTER TABLE ai.auto_embeddings_configuration
  ADD COLUMN provider text,
  ADD COLUMN dimensions integer,
  ADD COLUMN last_error text;

UPDATE ai.auto_embeddings_configuration AS configuration
SET provider = 'openai',
    dimensions = COALESCE(
      (SELECT attribute.atttypmod
       FROM pg_attribute AS attribute
       JOIN pg_type AS type ON type.oid = attribute.atttypid
       WHERE attribute.attrelid = to_regclass(format('%I.%I', configuration.schema_name, configuration.table_name))
         AND attribute.attname = configuration.column_name
         AND attribute.attnum > 0 AND NOT attribute.attisdropped
         AND type.typname = 'vector' AND attribute.atttypmod > 0),
      CASE WHEN configuration.model = 'text-embedding-3-large' THEN 3072 ELSE 1536 END
    );

ALTER TABLE ai.auto_embeddings_configuration
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN dimensions SET NOT NULL,
  ADD CONSTRAINT auto_embeddings_provider_length CHECK (octet_length(provider) BETWEEN 1 AND 63),
  ADD CONSTRAINT auto_embeddings_dimensions_range CHECK (dimensions BETWEEN 1 AND 16000);
