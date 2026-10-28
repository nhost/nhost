-- This extension is database-global and is intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extension pg_jsonschema during AI schema downgrade';
END
$$;
