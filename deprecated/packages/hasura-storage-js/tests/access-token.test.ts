import { describe, it } from 'vitest'

import { storage } from './utils/helpers'

describe('test access token', () => {
  it('should be able to set access token', async () => {
    const ACCESS_TOKEN = 'my-access-token'
    storage.setAccessToken(ACCESS_TOKEN)
  })

  it('should be able to set admin secret', async () => {
    const ADMIN_SECRET = 'my-admin-secret'
    storage.setAccessToken(ADMIN_SECRET)
  })
})
