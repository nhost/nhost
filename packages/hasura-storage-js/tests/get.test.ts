import fs from 'fs'
import { describe, expect, it } from 'vitest'
import fetch from 'cross-fetch'

import { storage } from './helpers'
import FormData from 'form-data'

describe('test get file', () => {
  it('should be able to get uploaded file', async () => {
    const { fileMetadata, error } = await storage.upload({
      file: fs.createReadStream('./tests/assets/sample.pdf')
    })
    expect(error).toBeNull()

    const url = storage.getPublicUrl({
      fileId: fileMetadata?.id as string
    })

    expect(url).toBeTruthy()

    const { status } = await fetch(url)

    expect(status).toBe(200)
  })

  it('should fail to get file id that does not exist', async () => {
    const RANDOM_UUID = 'a9766c77-3ed0-4087-90dd-925420dfaf81'

    const url = storage.getPublicUrl({
      fileId: RANDOM_UUID
    })

    expect(url).toBeTruthy()

    const { status } = await fetch(url)

    expect(status).toBe(404)
  })
})
