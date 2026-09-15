ALTER TABLE ai.agent_messages
  ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY;

DROP INDEX IF EXISTS ai.idx_agent_messages_session_created;
CREATE INDEX idx_agent_messages_session_created
  ON ai.agent_messages(session_id, created_at, seq);
