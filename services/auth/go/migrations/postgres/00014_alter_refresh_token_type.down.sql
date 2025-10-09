BEGIN;
ALTER TABLE auth.refresh_tokens ALTER COLUMN type DROP DEFAULT;
ALTER TABLE auth.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_types_fkey;
DROP TABLE IF EXISTS auth.refresh_token_types;
CREATE TYPE auth.refresh_token_type AS ENUM ('regular', 'pat');
ALTER TABLE auth.refresh_tokens ALTER COLUMN type TYPE auth.refresh_token_type USING type::auth.refresh_token_type;
ALTER TABLE auth.refresh_tokens ALTER COLUMN type SET DEFAULT 'regular';
COMMIT;