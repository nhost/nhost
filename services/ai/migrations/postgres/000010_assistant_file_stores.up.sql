CREATE TABLE graphite.assistant_file_stores (
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assistant_id text,
  file_store_id UUID,
  PRIMARY KEY (assistant_id, file_store_id),
  FOREIGN KEY (assistant_id) REFERENCES graphite.assistants(assistant_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (file_store_id) REFERENCES graphite.file_stores(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TRIGGER set_graphite_assistant_file_stores_updated_at
BEFORE UPDATE ON graphite.assistant_file_stores
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_assistant_file_stores_updated_at ON graphite.assistant_file_stores
IS 'trigger to set value of column updated_at to current timestamp on row update';
