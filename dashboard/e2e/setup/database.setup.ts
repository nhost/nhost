import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { test as setup } from '@/e2e/fixtures/auth-hook';
import { runSQLInEditor } from '@/e2e/utils';

setup.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

setup('clean up database objects', async ({ authenticatedNhostPage: page }) => {
  await runSQLInEditor(
    page,
    `
      DO $$ DECLARE
        objname text;
        func_rec record;
      BEGIN
        FOR func_rec IN
          SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.prokind = 'f'
            AND p.proname LIKE 'e2e_%'
        LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(func_rec.proname) || '(' || func_rec.args || ') CASCADE';
        END LOOP;

        FOR objname IN
          SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'
        LOOP
          EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.' || quote_ident(objname) || ' CASCADE';
        END LOOP;

        FOR objname IN
          SELECT table_name FROM information_schema.views
          WHERE table_schema = 'public'
        LOOP
          EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(objname) || ' CASCADE';
        END LOOP;

        FOR objname IN
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(objname) || ' CASCADE';
        END LOOP;
      END $$;
    `,
  );
});
