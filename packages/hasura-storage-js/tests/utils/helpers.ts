import { HasuraStorageClient } from '../../src'

const STORAGE_BACKEND_URL = 'http://localhost:1337/v1/storage'

const storage = new HasuraStorageClient({
  url: STORAGE_BACKEND_URL
})

export { storage }
