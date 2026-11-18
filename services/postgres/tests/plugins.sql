CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS address_standardizer;
CREATE EXTENSION IF NOT EXISTS address_standardizer_data_us;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
-- TIGER's installer changes the session search path. Keep later extensions
-- in their normal schema (pg_search expects vector in public).
RESET search_path;
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

-- Preserve paths for the core PostGIS extensions and the standalone
-- distributions split out in 3.7, including every shipped 3.6 source.
DO $$
DECLARE
    extension_name text;
    previous_version text;
BEGIN
    FOREACH extension_name IN ARRAY ARRAY[
        'postgis', 'postgis_raster', 'postgis_topology',
        'address_standardizer', 'address_standardizer_data_us', 'postgis_tiger_geocoder'
    ] LOOP
        FOREACH previous_version IN ARRAY ARRAY['3.6.1', '3.6.2', '3.6.4'] LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_extension_update_paths(extension_name) AS update_path
                JOIN pg_available_extensions AS available ON available.name = extension_name
                WHERE update_path.source = previous_version
                  AND update_path.target = available.default_version
                  AND update_path.path IS NOT NULL
            ) THEN
                RAISE EXCEPTION '% has no update path from %', extension_name, previous_version;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_extension_update_paths('pg_jsonschema') AS update_path
        WHERE
            update_path.source = '0.3.3'
            AND update_path.target = (
                SELECT
                    default_version
                FROM
                    pg_available_extensions
                WHERE
                    name = 'pg_jsonschema'
            )
            AND update_path.path IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'pg_jsonschema has no update path from 0.3.3 to its default version';
    END IF;
END;
$$;

-- A PL/pgSQL variable is stable to the planner but its schema can change
-- between calls sharing a compiled-schema validator cache.
DO $$
DECLARE
    schema_text text;
    schema_value jsonschema;
    results boolean[] := '{}';
BEGIN
    FOREACH schema_text IN ARRAY ARRAY['{"type":"string"}', '{"type":"integer"}'] LOOP
        schema_value := schema_text::jsonschema;
        results := results || jsonb_matches_compiled_schema(schema_value, '42'::jsonb);
    END LOOP;

    IF results IS DISTINCT FROM ARRAY[false, true] THEN
        RAISE EXCEPTION 'pg_jsonschema reused a stale compiled-schema validator: %', results;
    END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS hypopg;
CREATE EXTENSION IF NOT EXISTS ip4r;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_squeeze;
CREATE EXTENSION IF NOT EXISTS pg_hashids;
CREATE EXTENSION IF NOT EXISTS pg_ivm;
CREATE EXTENSION IF NOT EXISTS pg_repack;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS pg_search;
CREATE EXTENSION IF NOT EXISTS pg_durable;

DO $$
BEGIN
    IF current_setting('pg_durable.database') IS DISTINCT FROM current_database()::TEXT THEN
        RAISE EXCEPTION 'pg_durable.database expected %, got %',
            current_database(), current_setting('pg_durable.database');
    END IF;

    IF current_setting('pg_durable.worker_role') IS DISTINCT FROM current_user::TEXT THEN
        RAISE EXCEPTION 'pg_durable.worker_role expected %, got %',
            current_user, current_setting('pg_durable.worker_role');
    END IF;
END
$$;

SELECT
    extname AS extension_name,
    extversion AS version
FROM
    pg_extension;

DO $$
BEGIN
    IF EXISTS (
        SELECT
            1
        FROM
            pg_available_extensions
        WHERE
            installed_version IS NOT NULL
            AND installed_version <> default_version
    ) THEN
        RAISE EXCEPTION 'one or more extensions were not updated to their packaged default version';
    END IF;
END;
$$;
