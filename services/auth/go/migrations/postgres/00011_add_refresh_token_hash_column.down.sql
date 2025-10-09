BEGIN;
COMMENT ON COLUMN "auth"."refresh_tokens"."refresh_token" IS NULL;
ALTER TABLE "auth"."refresh_tokens"
    DROP COLUMN IF EXISTS "refresh_token_hash";
COMMIT;