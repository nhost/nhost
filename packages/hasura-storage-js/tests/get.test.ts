import fs from 'fs'
import { describe, expect, it } from 'vitest'
import fetch from 'cross-fetch'
import { v4 as uuidv4 } from 'uuid'

import { storage } from './utils/helpers'
import FormData from 'form-data'

describe('test get file', () => {
  it('should be able to get uploaded file', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd
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
    const RANDOM_UUID = uuidv4()

    const url = storage.getPublicUrl({
      fileId: RANDOM_UUID
    })

    expect(url).toBeTruthy()

    const { status } = await fetch(url)

    expect(status).toBe(404)
  })
})
