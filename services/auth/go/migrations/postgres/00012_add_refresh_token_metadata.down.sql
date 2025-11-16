BEGIN;
ALTER TABLE auth.refresh_tokens
DROP COLUMN IF EXISTS metadata;
COMMIT;