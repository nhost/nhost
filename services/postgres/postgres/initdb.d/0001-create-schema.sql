-- nhost admin role
-- equivalent to the postgres role
CREATE USER nhost_admin;
ALTER USER nhost_admin WITH superuser createdb createrole replication bypassrls;

-- nhost hasura
CREATE USER nhost_hasura;
GRANT postgres TO nhost_hasura;

GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO nhost_hasura;

CREATE SCHEMA IF NOT EXISTS hdb_catalog;
ALTER SCHEMA hdb_catalog OWNER TO nhost_hasura;
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO nhost_hasura;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO nhost_hasura;
GRANT USAGE ON SCHEMA public TO nhost_hasura;
GRANT ALL ON ALL TABLES IN SCHEMA public TO nhost_hasura;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO nhost_hasura;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO nhost_hasura;

-- auth schema
CREATE USER nhost_auth_admin LOGIN NOINHERIT CREATEROLE NOREPLICATION;
ALTER ROLE nhost_auth_admin SET search_path TO auth;

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION nhost_admin;
GRANT ALL PRIVILEGES ON SCHEMA auth TO nhost_auth_admin;

-- storage schema
CREATE USER nhost_storage_admin LOGIN NOINHERIT CREATEROLE NOREPLICATION;
ALTER ROLE nhost_storage_admin SET search_path TO storage;

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION nhost_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO nhost_storage_admin;

-- necessary for nhost_hasura to access and track objects created by nhost_auth_admin and nhost_storage_admin in the future
ALTER DEFAULT PRIVILEGES FOR USER nhost_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO nhost_hasura;
ALTER DEFAULT PRIVILEGES FOR USER nhost_storage_admin IN SCHEMA storage GRANT ALL ON TABLES TO nhost_hasura;
GRANT USAGE ON SCHEMA auth TO nhost_hasura;
GRANT USAGE ON SCHEMA storage TO nhost_hasura;

-- public
-- pgcrypt & citext is required to be installed in the
-- `public` schema because of Hasura
-- https://github.com/hasura/graphql-engine/issues/3657

-- CREATE SCHEMA IF NOT EXISTS extensions;
-- GRANT usage ON SCHEMA extensions TO nhost_auth_admin, nhost_storage_admin;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext; --WITH SCHEMA extensions;

-- pgbouncer
CREATE USER pgbouncer;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM pgbouncer;

CREATE SCHEMA pgbouncer AUTHORIZATION nhost_admin;

CREATE OR REPLACE FUNCTION pgbouncer.user_lookup(in i_username text, out uname text, out phash text)
RETURNS record AS $$$$
BEGIN
    SELECT usename, passwd FROM pg_catalog.pg_shadow
    WHERE usename = i_username INTO uname, phash;
    RETURN;
END;
$$$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION pgbouncer.user_lookup(text) FROM public;
GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer;
GRANT EXECUTE ON FUNCTION pgbouncer.user_lookup(text) TO pgbouncer;
