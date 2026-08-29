DROP INDEX IF EXISTS graphite.idx_agent_messages_session_created;

CREATE INDEX idx_agent_messages_session_created
ON graphite.agent_messages (session_id, created_at);

ALTER TABLE graphite.agent_messages
DROP COLUMN IF EXISTS seq;
