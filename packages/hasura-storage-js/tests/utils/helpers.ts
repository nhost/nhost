import { HasuraStorageClient } from '../../src'

const STORAGE_BACKEND_URL = 'https://local.storage.nhost.run/v1'

const storage = new HasuraStorageClient({
  url: STORAGE_BACKEND_URL
})

export { storage }
