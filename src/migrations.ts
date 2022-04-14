import { migrate } from '@djgrant/postgres-migrations';
import { Client } from 'pg';
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
  } finally {
    await client.end();
  }
  logger.info('Migrations applied');
}
