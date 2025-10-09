BEGIN;
ALTER TABLE auth.refresh_tokens
DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS auth.refresh_token_type;
COMMIT;