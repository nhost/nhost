require('tsconfig-paths/register');
import { Client } from 'pg';

import { applyMigrations } from '@/migrations';
import { applyMetadata } from '@/metadata';
import { ENV } from '../src/utils/env';

export default async (): Promise<void> => {
  await applyMigrations();

  const client = new Client({
    connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
  });
  try {
    await client.connect();
    // await client.query(`ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "name" text NULL;
    // INSERT INTO auth.roles (role) VALUES ('editor'), ('super-admin') ON CONFLICT DO NOTHING;;`)
    await client.query(
      `INSERT INTO auth.roles (role) VALUES ('editor'), ('super-admin') ON CONFLICT DO NOTHING;;`
    );
  } finally {
    await client.end();
  }
  await applyMetadata();
};
