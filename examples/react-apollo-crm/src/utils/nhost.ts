import { NhostClient } from '@nhost/react'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337'
})

export { nhost }
