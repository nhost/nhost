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

-- Keep one deliberately un-upgradeable extension outside the database checked
-- by plugins.sql so the entrypoint's observable, non-fatal failure policy is
-- exercised without weakening the real-upgrade assertions.
CREATE DATABASE extension_update_failure;
\connect extension_update_failure
CREATE EXTENSION ip4r;
UPDATE pg_extension SET extversion = '0' WHERE extname = 'ip4r';
