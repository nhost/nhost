BEGIN;
ALTER TABLE auth.refresh_tokens ADD COLUMN refresh_token_hash_old VARCHAR(255);
UPDATE auth.refresh_tokens SET refresh_token_hash_old = refresh_token_hash;
ALTER TABLE auth.refresh_tokens DROP COLUMN IF EXISTS refresh_token_hash;
ALTER TABLE auth.refresh_tokens RENAME COLUMN refresh_token_hash_old TO refresh_token_hash;
ALTER TABLE auth.refresh_tokens ALTER COLUMN id DROP DEFAULT;
ALTER TABLE auth.refresh_tokens RENAME COLUMN id TO refresh_token;
COMMENT ON COLUMN auth.refresh_tokens.refresh_token IS 'DEPRECATED: auto-generated refresh token id. Will be replaced by a genereric id column that will be used as a primary key, not the refresh token itself. Use refresh_token_hash instead.';
ALTER TABLE auth.refresh_tokens 
    ADD COLUMN refresh_token_hash_generated VARCHAR(255) GENERATED ALWAYS AS (sha256 (refresh_token::text::bytea)) STORED;
UPDATE auth.refresh_tokens SET refresh_token_hash = refresh_token_hash_generated;
ALTER TABLE auth.refresh_tokens DROP COLUMN refresh_token_hash_generated;
COMMIT;