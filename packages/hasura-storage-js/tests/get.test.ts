import FormData from 'form-data'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { storage } from './utils/helpers'

describe('test get file', () => {
  it('should be able to get uploaded file', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd
    })
    expect(error).toBeNull()

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const fileId =
      'processedFiles' in fileMetadata
        ? fileMetadata.processedFiles[0]?.id
        : (fileMetadata.id as string)

    const url = storage.getPublicUrl({
      fileId
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
