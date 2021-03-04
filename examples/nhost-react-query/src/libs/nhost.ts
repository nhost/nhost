import { createClient } from 'nhost-js-sdk'

const config = {
  baseURL: process.env.NEXT_PUBLIC_BACKEND_ENDPOINT,
}

const nhostClient = createClient(config)

const auth = nhostClient.auth
const storage = nhostClient.storage

export { auth, storage }
