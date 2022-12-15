BEGIN;
ALTER TABLE "auth"."refresh_tokens"
    ADD COLUMN "hashed_refresh_token" VARCHAR(255) GENERATED ALWAYS AS (sha256 (refresh_token::text::bytea)) STORED;
COMMIT;

