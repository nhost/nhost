/* eslint-disable no-console */
import { TEST_PROJECT_ADMIN_SECRET, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { test as setup } from '@playwright/test';

setup('refresh metadata', async () => {
  try {
    const response = await fetch(
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
                reload_remote_schemas: ['graphite'],
                reload_sources: false,
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
    const body = await response.json();

    if (!response.ok) {
      const message = `[${body.code}]:${body.error}`;
      throw new Error(message);
    } else {
      const isConsistent = body[0].is_consistent;
      if (isConsistent) {
        console.log('Metadata is consistent.');
      } else {
        console.log('Metadata is not consistent.');
        console.log(body[0].inconsistent_objects);
      }
    }
  } catch (error) {
    // Log safe error information
    console.error(
      'Failed to refresh metadata:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    throw new Error('Failed to refresh metadata');
  }
});
