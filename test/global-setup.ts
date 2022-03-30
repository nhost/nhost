require('tsconfig-paths/register');
require('dotenv').config();
import { Client } from 'pg';

import { applyMetadata } from '@/metadata';
import { applyMigrations } from '@/migrations';
import { ENV } from '@/utils';

export default async (): Promise<void> => {
  await applyMigrations();
  await applyMetadata();
  const client = new Client({
    connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
  });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO auth.roles (role) VALUES ('editor'), ('super-admin') ON CONFLICT DO NOTHING;;`
    );
  } finally {
    await client.end();
  }
};
