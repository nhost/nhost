CREATE TABLE ai.agent_providers (
  value text PRIMARY KEY,
  comment text
);

INSERT INTO ai.agent_providers (value, comment) VALUES
  ('anthropic', 'Anthropic Claude models'),
  ('openai', 'OpenAI models'),
  ('google', 'Google Gemini models');

CREATE TABLE ai.agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id UUID,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  provider text NOT NULL,
  model text NOT NULL,
  tools_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_matches_schema('{
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "web_search": {
          "type": "object",
          "required": ["provider"],
          "additionalProperties": false,
          "properties": {
            "provider": { "type": "string" },
            "require_approval": { "type": "boolean" }
          }
        },
        "web_fetch": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "require_approval": { "type": "boolean" }
          }
        },
        "graphql": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "require_approval_queries": { "type": "boolean" },
            "require_approval_mutations": { "type": "boolean" }
          }
        },
        "mcp_servers": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["url"],
            "additionalProperties": false,
            "properties": {
              "url": { "type": "string" },
              "headers": {
                "type": "object",
                "additionalProperties": { "type": "string" }
              },
              "require_approval": { "type": "boolean" },
              "tool_overrides": {
                "type": "object",
                "additionalProperties": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "require_approval": { "type": "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    }'::json, tools_config)
  ),
  PRIMARY KEY (id),
  -- Agents are reusable resources; on user deletion they persist with NULL user_id.
  -- Sessions, in contrast, are per-user and cascade-deleted (see agent_sessions).
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (provider) REFERENCES ai.agent_providers(value) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_agents_user_id ON ai.agents(user_id);

CREATE TRIGGER set_ai_agents_updated_at
BEFORE UPDATE ON ai.agents
FOR EACH ROW
EXECUTE PROCEDURE ai.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_ai_agents_updated_at ON ai.agents
IS 'trigger to set value of column updated_at to current timestamp on row update';

CREATE TABLE ai.agent_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  agent_id uuid NOT NULL,
  user_id UUID,
  PRIMARY KEY (id),
  FOREIGN KEY (agent_id) REFERENCES ai.agents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_agent_sessions_agent_id ON ai.agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_user_id ON ai.agent_sessions(user_id);

CREATE TRIGGER set_ai_agent_sessions_updated_at
BEFORE UPDATE ON ai.agent_sessions
FOR EACH ROW
EXECUTE PROCEDURE ai.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_ai_agent_sessions_updated_at ON ai.agent_sessions
IS 'trigger to set value of column updated_at to current timestamp on row update';

CREATE TABLE ai.agent_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  PRIMARY KEY (id),
  FOREIGN KEY (session_id) REFERENCES ai.agent_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_agent_messages_session_created ON ai.agent_messages(session_id, created_at);
