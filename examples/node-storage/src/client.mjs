import { NhostClient } from '@nhost/nhost-js'

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
