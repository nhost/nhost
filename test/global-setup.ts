require('tsconfig-paths/register')
import { applyMigrations } from '@/migrations'
import { applyMetadata } from '@/metadata'
import { Client } from 'pg'

export default async (): Promise<void> => {
  await applyMigrations()

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  try {
    await client.connect()
    // await client.query(`ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "name" text NULL;
    // INSERT INTO auth.roles (role) VALUES ('editor'), ('super-admin') ON CONFLICT DO NOTHING;;`)
    await client.query(
      `INSERT INTO auth.roles (role) VALUES ('editor'), ('super-admin') ON CONFLICT DO NOTHING;;`
    )
  } finally {
    await client.end()
  }
  await applyMetadata()
}
