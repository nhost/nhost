BEGIN;
ALTER TABLE "auth"."refresh_tokens"
    ADD COLUMN "refresh_token_hash" VARCHAR(255) GENERATED ALWAYS AS (sha256 (refresh_token::text::bytea)) STORED;
COMMENT ON COLUMN "auth"."refresh_tokens"."refresh_token" IS 'DEPRECATED: auto-generated refresh token id. Will be replaced by a genereric id column that will be used as a primary key, not the refresh token itself. Use refresh_token_hash instead.';
COMMIT;

