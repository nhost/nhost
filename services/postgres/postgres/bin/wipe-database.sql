-- Robust database wipe script for restore operations.
--
-- Addresses "cache lookup failed for function" errors (a known PostgreSQL bug)
-- that occur when DROP EXTENSION ... CASCADE tries to drop many dependent objects
-- (e.g., GIN/GiST indexes using pg_trgm operator classes).
--
-- The fix: drop extension-dependent objects explicitly before dropping extensions,
-- so CASCADE has nothing left to process and the catalog cache stays consistent.

-- Step 1: Drop indexes that depend on extension-provided operator classes/functions.
-- These are the primary cause of cascade-induced cache invalidation failures.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT
            n.nspname AS schema_name,
            c.relname AS index_name
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND EXISTS (
            -- Index depends on an object that is a member of an extension
            SELECT 1
            FROM pg_catalog.pg_depend d
            JOIN pg_catalog.pg_depend ed
                ON ed.objid = d.refobjid
                AND ed.deptype = 'e'
            WHERE d.objid = c.oid
            AND d.deptype IN ('n', 'a')
        )
    LOOP
        BEGIN
            RAISE NOTICE 'Dropping extension-dependent index: %.%', r.schema_name, r.index_name;
            EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to drop index %.%: %', r.schema_name, r.index_name, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Step 2: Drop all non-essential extensions with individual error handling.
DO $$
DECLARE
    ext RECORD;
BEGIN
    FOR ext IN
        SELECT extname
        FROM pg_catalog.pg_extension
        WHERE extname NOT IN ('plpgsql')
        ORDER BY extname
    LOOP
        BEGIN
            RAISE NOTICE 'Dropping extension: %', ext.extname;
            EXECUTE format('DROP EXTENSION IF EXISTS %I CASCADE', ext.extname);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to drop extension %: %', ext.extname, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Step 3: Verify no non-essential extensions remain.
DO $$
DECLARE
    remaining TEXT;
BEGIN
    SELECT string_agg(extname, ', ')
    INTO remaining
    FROM pg_catalog.pg_extension
    WHERE extname NOT IN ('plpgsql');

    IF remaining IS NOT NULL THEN
        RAISE WARNING 'Extensions still installed after wipe: %', remaining;
    ELSE
        RAISE NOTICE 'All non-essential extensions successfully removed';
    END IF;
END;
$$;

-- Step 4: Drop all user-created schemas.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT nspname
        FROM pg_catalog.pg_namespace
        WHERE nspname NOT IN (
            'pg_catalog', 'information_schema', 'public',
            'pg_toast', 'pg_temp_1', 'pg_toast_temp_1'
        )
        AND nspname NOT LIKE 'pg_%'
    LOOP
        BEGIN
            RAISE NOTICE 'Dropping schema: %', r.nspname;
            EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.nspname);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to drop schema %: %', r.nspname, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Step 5: Reset the public schema.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;
