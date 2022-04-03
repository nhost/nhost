import { migrate } from '@djgrant/postgres-migrations';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { ENV } from './utils/env';
import { logger } from './logger';

export async function applyMigrations(): Promise<void> {
  logger.info('Applying migrations');

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
    const userFieldsMigration = path.join(
      process.cwd(),
      'migrations',
      '00002_custom-user-fields.sql'
    );
    if (error.message.includes('00002_custom-user-fields.sql')) {
      logger.info(
        'Correcting legacy 00002 migration name introduced in v0.2.1'
      );
      await fs.stat(userFieldsMigration);
      await fs.rename(
        userFieldsMigration,
        userFieldsMigration.replace(
          '00002_custom-user-fields',
          '00002_custom_user_fields'
        )
      );
      await migrate({ client }, './migrations', {
        migrationTableName: 'auth.migrations',
      });
    } else {
      throw Error(error);
    }
  } finally {
    await client.end();
  }
  // logger.info('Finished applying migrations');
}
