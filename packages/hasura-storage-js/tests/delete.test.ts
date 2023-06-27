import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

import { storage } from './utils/helpers'

describe('test delete file', () => {
  it('should be able to get delete file', async () => {
    const file = fs.createReadStream('./tests/assets/sample.pdf')

    const { fileMetadata } = await storage.upload({
      file: file as unknown as File
    })

    const { error } = await storage.delete({
      fileId: fileMetadata?.id as string
    })

    expect(error).toBeNull()
  })

  it('should fail to delete a file does not exist', async () => {
    const RANDOM_UUID = uuidv4()

    const { error } = await storage.delete({
      fileId: RANDOM_UUID
    })

    expect(error).toBeTruthy()
  })
})
