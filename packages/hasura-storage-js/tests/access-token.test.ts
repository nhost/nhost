import { describe, expect, it } from 'vitest'
import { v4 as uuidv4 } from 'uuid'

import { storage } from './helpers'
import { AxiosError } from 'axios'

describe('test access token', () => {
  it('should be able to set access token', async () => {
    const ACCESS_TOKEN = 'my-access-token'
    storage.setAccessToken(ACCESS_TOKEN)

    const { presignedUrl, error } = await storage.getPresignedUrl({
      fileId: uuidv4()
    })
  })

  it('should be able to set admin secret', async () => {
    const ADMIN_SECRET = 'my-admin-secret'
    storage.setAccessToken(ADMIN_SECRET)
  })
})
