import { NhostClient } from '@nhost/react'

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || 'localhost',
  region: import.meta.env.VITE_NHOST_REGION
})

export { nhost }
