-- start a transaction
BEGIN;

ALTER TABLE
  auth.provider_requests
DROP COLUMN IF EXISTS options;

ALTER TABLE
  auth.provider_requests
ADD
  COLUMN redirect_url text NOT NULL DEFAULT '';

-- Remove the default after adding the column
ALTER TABLE
  auth.provider_requests
ALTER COLUMN redirect_url DROP DEFAULT;

COMMIT;