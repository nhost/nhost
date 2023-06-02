import FormData from 'form-data'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { storage } from './utils/helpers'

describe('test get presigned url of file', () => {
  it('should be able to get presigned url of file', async () => {
    const formData = new FormData()
    formData.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata } = await storage.upload({ formData })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const fileId =
      'processedFiles' in fileMetadata
        ? fileMetadata.processedFiles[0]?.id
        : (fileMetadata.id as string)

    const { presignedUrl, error } = await storage.getPresignedUrl({
      fileId
    })

    expect(presignedUrl).not.toBeNull()
    expect(error).toBeNull()

    const imageResponse = await fetch(presignedUrl!.url)

    expect(imageResponse.ok).toBeTruthy()
  })

  it('should fail to get presigned url of file that does not exist', async () => {
    const { error } = await storage.getPresignedUrl({
      fileId: uuidv4()
    })

    expect(error).toBeTruthy()
  })
})
