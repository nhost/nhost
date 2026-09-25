CREATE EXTENSION postgis;
CREATE EXTENSION hypopg;
CREATE EXTENSION pg_ivm;
CREATE EXTENSION pg_jsonschema;
CREATE EXTENSION pgmq;
CREATE EXTENSION pgrouting;
CREATE EXTENSION pg_search;
CREATE EXTENSION timescaledb;
CREATE EXTENSION vector;

DO $$
DECLARE
    unexpected_versions text;
BEGIN
    SELECT
        string_agg(
            format(
                '%I is %s (expected %s)',
                expected.name,
                COALESCE(installed.extversion, 'not installed'),
                expected.version
            ),
            ', '
            ORDER BY expected.name
        )
    INTO unexpected_versions
    FROM (
        VALUES
            ('hypopg', '1.4.2'),
            ('pg_ivm', '1.14'),
            ('pg_jsonschema', '0.3.3'),
            ('pg_search', '0.24.0'),
            ('pgmq', '1.11.1'),
            ('pgrouting', '4.0.1'),
            ('timescaledb', '2.27.2'),
            ('vector', '0.8.2')
    ) AS expected(name, version)
    LEFT JOIN pg_extension AS installed ON installed.extname = expected.name
    WHERE installed.extversion IS DISTINCT FROM expected.version;

    IF unexpected_versions IS NOT NULL THEN
        RAISE EXCEPTION 'upgrade source image has unexpected extension versions: %', unexpected_versions;
    END IF;
END;
$$;

-- Cover the catalog-connection database as well as the application database.
\connect postgres
CREATE EXTENSION timescaledb;
\connect local

-- pg_search 0.24 can be installed without vector, but 0.25 requires it.
-- Exercise that existing-volume upgrade independently from the database
-- where vector was already installed.
CREATE DATABASE pg_search_without_vector;
\connect pg_search_without_vector
CREATE EXTENSION pg_search;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pg_search upgrade source unexpectedly has vector installed';
    END IF;
END;
$$;
\connect local

-- Keep one deliberately un-upgradeable extension outside the database checked
-- by plugins.sql so the entrypoint's observable, non-fatal failure policy is
-- exercised without weakening the real-upgrade assertions.
CREATE DATABASE extension_update_failure;
\connect extension_update_failure
CREATE EXTENSION ip4r;
UPDATE pg_extension SET extversion = '0' WHERE extname = 'ip4r';
\connect local

-- An interrupted DROP DATABASE leaves datallowconn true but cannot be opened.
-- It sorts ahead of local, so discovery must skip it without blocking upgrades.
CREATE DATABASE aaa_invalid;
UPDATE pg_database SET datconnlimit = -2 WHERE datname = 'aaa_invalid';

-- A connectable database can still fail discovery. Keep later databases moving.
CREATE DATABASE aaa_inspect_failure;
\connect aaa_inspect_failure
CREATE VIEW public.pg_extension AS SELECT 1 AS extname;
ALTER DATABASE aaa_inspect_failure SET search_path = public, pg_catalog;
\connect local

-- A literal database name with '=' must not be parsed as libpq connection info.
CREATE DATABASE "app=old";
\connect dbname=app=old
-- Install the real old version: rewriting extversion after a default install
-- leaves 1.8 objects behind, which makes the 1.7-to-1.8 update fail.
CREATE EXTENSION hstore VERSION '1.7';
\connect local

-- Simulate a collation library upgrade while TimescaleDB still references the
-- old library. The new image must repair local before upgrading extensions.
UPDATE pg_database SET datcollversion = '0' WHERE datname = 'local';

-- The Nhost SQL must run even when an earlier database cannot be inspected.
ALTER ROLE nhost_auth_admin RESET search_path;
