-- Drop tracked functions
DROP FUNCTION IF EXISTS auth.modify_oauth2_client;
DROP FUNCTION IF EXISTS auth.create_oauth2_client;

-- Remove the DEFAULT on client_id and drop the generation function
ALTER TABLE auth.oauth2_clients ALTER COLUMN client_id DROP DEFAULT;
DROP FUNCTION IF EXISTS auth.generate_oauth2_client_id();

-- Revoke grants added in the up migration (SELECT was granted in 00020, keep it)
REVOKE DELETE ON auth.oauth2_clients FROM nhost_hasura;
