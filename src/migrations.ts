import { migrate } from 'postgres-migrations'
import { Client } from 'pg'

export async function applyMigrations(): Promise<void> {
  console.log('Applying migrations')

  const dbConfig = {
    connectionString: process.env.DATABASE_URL
  }

  const client = new Client(dbConfig)
  try {
    await client.connect()
    await migrate({ client }, './db/migrations')
  } finally {
    await client.end()
  }
  console.log('Finished applying migrations')
}
