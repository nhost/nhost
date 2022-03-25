import { NhostClient } from '@nhost/react'

const nhost = new NhostClient({
  backendUrl: process.env.REACT_APP_BACKEND_URL!
})

export { nhost }
