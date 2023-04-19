BEGIN;
ALTER TABLE auth.refresh_tokens
ADD COLUMN metadata JSONB;
COMMIT;

