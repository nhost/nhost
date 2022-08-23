import fs from 'fs'
import { describe, expect, it } from 'vitest'
import { v4 as uuidv4 } from 'uuid'

import { storage } from './utils/helpers'
import FormData from 'form-data'

describe('test get presigned url of file', () => {
  it('should be able to get presigned url of file', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata } = await storage.upload({
      formData: fd
    })

    const { error } = await storage.getPresignedUrl({
      fileId: fileMetadata?.id as string
    })

    expect(error).toBeNull()
  })

  it('should fail to get presigned url of file that does not exist', async () => {
    const { error } = await storage.getPresignedUrl({
      fileId: uuidv4()
    })

    expect(error).toBeTruthy()
  })
})
