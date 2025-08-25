import { NhostClient } from '@nhost/react'

const nhost = new NhostClient({
  subdomain: 'localhost:1337'
})

export { nhost }
