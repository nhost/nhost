ALTER TABLE graphite.agent_messages
  ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY;

DROP INDEX IF EXISTS graphite.idx_agent_messages_session_created;
CREATE INDEX idx_agent_messages_session_created
  ON graphite.agent_messages(session_id, created_at, seq);
