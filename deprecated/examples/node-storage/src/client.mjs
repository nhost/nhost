import { NhostClient } from '@nhost/nhost-js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Create a new Nhost client.
 *
 * @returns {NhostClient} A new Nhost client.
 */
export function createClient() {
  return new NhostClient({
    subdomain: process.env.SUBDOMAIN,
    region: process.env.REGION,
    adminSecret: process.env.ADMIN_SECRET
  })
}
