GRANT postgres TO nhost_hasura;

-- this is needed in case of events
-- reference: https://hasura.io/docs/latest/deployment/postgres-requirements/
GRANT USAGE ON SCHEMA hdb_catalog TO nhost_auth_admin;
GRANT CREATE ON SCHEMA hdb_catalog TO nhost_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA hdb_catalog TO nhost_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hdb_catalog TO nhost_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA hdb_catalog TO nhost_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON TABLES TO nhost_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON SEQUENCES TO nhost_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON FUNCTIONS TO nhost_auth_admin;

GRANT USAGE ON SCHEMA hdb_catalog TO nhost_storage_admin;
GRANT CREATE ON SCHEMA hdb_catalog TO nhost_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA hdb_catalog TO nhost_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hdb_catalog TO nhost_storage_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA hdb_catalog TO nhost_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON TABLES TO nhost_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON SEQUENCES TO nhost_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdb_catalog GRANT ALL ON FUNCTIONS TO nhost_storage_admin;

-- restore search_path so citext and other extensions are available
ALTER ROLE nhost_auth_admin SET search_path TO public;
ALTER ROLE nhost_storage_admin SET search_path TO public;
