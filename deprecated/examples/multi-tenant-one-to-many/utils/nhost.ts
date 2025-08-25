import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  subdomain: 'local'
})

export { nhost }
