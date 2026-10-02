CREATE TABLE ai.auto_embeddings_configuration (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL UNIQUE,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  last_run timestamptz,
  query text,
  mutation text,
  PRIMARY KEY (id),
  UNIQUE (schema_name, table_name, column_name)
);

CREATE OR REPLACE FUNCTION ai.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new.updated_at = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ai_auto_embeddings_configuration_updated_at
BEFORE UPDATE ON ai.auto_embeddings_configuration
FOR EACH ROW
EXECUTE PROCEDURE ai.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_ai_auto_embeddings_configuration_updated_at ON ai.auto_embeddings_configuration
IS 'trigger to set value of column updated_at to current timestamp on row update';
