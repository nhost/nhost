CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

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
CREATE EXTENSION IF NOT EXISTS pg_search;

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
