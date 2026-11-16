-- These extensions are database-global and are intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extensions vector and http during AI schema downgrade';
END
$$;
