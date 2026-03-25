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
      BEGIN
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
