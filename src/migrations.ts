import { migrate } from '@djgrant/postgres-migrations';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';
import { ENV } from './utils/env';

export async function applyMigrations(): Promise<void> {
  logger.info('Applying migrations...');

  const dbConfig = {
    connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
  };

  const client = new Client(dbConfig);
  try {
    await client.connect();
    await migrate({ client }, './migrations', {
      migrationTableName: 'auth.migrations',
    });
  } catch (error: any) {
    /**
     * The following code is a workaround for the bug we introduced in v0.2.1
     * We modified the migration file name from `00002_custom_user_fields.sql` to `00002_custom-user-fields.sql`
     * `@jgrant/postgres-migrations` checks hashes from file name.
     * As a result, it makes the migration fail when upgrading from previous versions v0.2.0 and lower to later versions
     * See [this issue](https://github.com/nhost/hasura-auth/issues/129) and the related [pull request](https://github.com/nhost/hasura-auth/pull/134)
     */
    const correctName = path.join(
      process.cwd(),
      'migrations',
      '00002_custom-user-fields.sql'
    );
    if (error.message.includes('00002_custom-user-fields.sql')) {
      logger.info(
        'Correcting legacy 00002 migration name introduced in v0.2.1'
      );
      const legacyName = correctName.replace(
        '00002_custom-user-fields',
        '00002_custom_user_fields'
      );
      /**
       * Rename `00002_custom-user-fields.sql` to `00002_custom_user_fields.sql`
       * so the hashes present in the `auth.migrations` table matches with the migration files
       */
      await fs.rename(correctName, legacyName);
      try {
        // Retry running migrations with the corrected file name
        await migrate({ client }, './migrations', {
          migrationTableName: 'auth.migrations',
        });
      } catch (secondAttemptError: any) {
        throw new Error(secondAttemptError.message);
      } finally {
        /**
         * Revert the migration file name to its original value
         * As the './migrations' directory might be bound to a local directory with a Docker volume,
         * we change the file back to its original name to avoid confusion on the user standpoint
         * (it happens when using the Nhost CLI or a custom docker-compose config)
         * */
        await fs.rename(legacyName, correctName);
      }
    } else {
      throw new Error(error.message);
    }
  } finally {
    await client.end();
  }
  logger.info('Migrations applied');
}
