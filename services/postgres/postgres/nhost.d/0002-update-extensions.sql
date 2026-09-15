DO $$
DECLARE
    ext record;
BEGIN
    FOR ext IN
        SELECT e.extname
        FROM pg_extension e
        JOIN pg_available_extensions ae ON e.extname = ae.name
        WHERE e.extversion <> ae.default_version
    LOOP
        RAISE NOTICE 'Updating extension %', ext.extname;
        EXECUTE format('ALTER EXTENSION %I UPDATE', ext.extname);
    END LOOP;
END;
$$;
