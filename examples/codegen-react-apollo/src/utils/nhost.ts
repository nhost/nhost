import { NhostClient } from '@nhost/react'

const nhost = new NhostClient({
  backendUrl: 'http://localhost:3000'
})

export { nhost }
