import { HasuraStorageClient } from '../../src'

const STORAGE_BACKEND_URL = 'https://local.storage.local.nhost.run/v1'

const storage = new HasuraStorageClient({
  url: STORAGE_BACKEND_URL
})

export { storage }
