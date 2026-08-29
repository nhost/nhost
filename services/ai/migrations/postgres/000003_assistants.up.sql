CREATE TABLE graphite.assistants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assistant_id text UNIQUE,
  user_id UUID,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TRIGGER set_graphite_assistants_updated_at
BEFORE UPDATE ON graphite.assistants
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_assistants_updated_at ON graphite.assistants
IS 'trigger to set value of column updated_at to current timestamp on row update';

CREATE TABLE graphite.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  session_id text UNIQUE,
  assistant_id text,
  user_id UUID,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (assistant_id) REFERENCES graphite.assistants(assistant_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TRIGGER set_graphite_sessions_updated_at
BEFORE UPDATE ON graphite.sessions
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_sessions_updated_at ON graphite.sessions
IS 'trigger to set value of column updated_at to current timestamp on row update';
