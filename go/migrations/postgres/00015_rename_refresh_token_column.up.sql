BEGIN;
ALTER TABLE auth.refresh_tokens
RENAME COLUMN refresh_token TO id;
COMMENT ON COLUMN auth.refresh_tokens.id IS NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth.refresh_tokens RENAME COLUMN refresh_token_hash TO refresh_token_hash_old;
ALTER TABLE auth.refresh_tokens ADD COLUMN refresh_token_hash VARCHAR(255);
UPDATE auth.refresh_tokens SET refresh_token_hash = refresh_token_hash_old;
ALTER TABLE auth.refresh_tokens DROP COLUMN refresh_token_hash_old;
COMMIT;