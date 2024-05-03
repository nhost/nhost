BEGIN;
ALTER TABLE auth.refresh_tokens ALTER COLUMN type TYPE text;
ALTER TABLE auth.refresh_tokens ALTER COLUMN type DROP DEFAULT;
DROP TYPE IF EXISTS refresh_token_type;
DROP TYPE IF EXISTS auth.refresh_token_type;

CREATE TABLE auth.refresh_token_types (
  value text PRIMARY KEY,
  comment text
);

INSERT INTO auth.refresh_token_types (value, comment) VALUES
  ('regular', 'Regular refresh token'),
  ('pat', 'Personal access token');
ALTER TABLE auth.refresh_tokens ADD CONSTRAINT refresh_tokens_types_fkey FOREIGN KEY (type) REFERENCES auth.refresh_token_types (value) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE auth.refresh_tokens ALTER COLUMN type SET DEFAULT 'regular';
COMMIT;
