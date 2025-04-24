import { TEST_PROJECT_ADMIN_SECRET, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { test as setup } from '@playwright/test';

setup('refresh metadata', async () => {
  try {
    await fetch(
      `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/v1/metadata`,
      {
        method: 'POST',
        headers: {
          'x-hasura-admin-secret': TEST_PROJECT_ADMIN_SECRET,
        },
        body: JSON.stringify({
          args: [
            {
              type: 'reload_metadata',
              args: {
                reload_remote_schemas: [],
                reload_sources: [],
              },
            },
            {
              args: {},
              type: 'get_inconsistent_metadata',
            },
          ],
          source: 'default',
          type: 'bulk',
        }),
      },
    );
  } catch (error) {
    // Log safe error information
    console.error(
      'Failed to refresh metadata',
      error instanceof Error ? error.message : 'Unknown error',
    );
    throw new Error('Failed to refresh metadata');
  }
});
