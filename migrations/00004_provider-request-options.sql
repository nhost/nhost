-- start a transaction
BEGIN;

ALTER TABLE
  auth.provider_requests
DROP COLUMN redirect_url;

ALTER TABLE
  auth.provider_requests
ADD
  COLUMN options JSONB;

COMMIT;