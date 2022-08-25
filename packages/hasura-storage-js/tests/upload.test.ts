import fs from 'fs'
import { describe, expect, it } from 'vitest'
import fetch from 'cross-fetch'
import { v4 as uuidv4 } from 'uuid'
import FormData from 'form-data'

import { storage } from './utils/helpers'

describe('test upload', () => {
  it('should upload a file from the file system', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { error } = await storage.upload({
      formData: fd
    })

    expect(error).toBeNull()
  })

  it('should upload a file using blob from fetch', async () => {
    const logo = await fetch('http://nodejs.org/images/logo.png')

    let blob = await logo.blob()

    // create form data
    const fd = new FormData()
    fd.append('file', blob.stream(), 'logo.png')

    const { error } = await storage.upload({
      formData: fd
    })

    expect(error).toBeNull()
  })

  it('should upload a file with specific id', async () => {
    const RANDOM_UUID = uuidv4()

    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      id: RANDOM_UUID
    })

    expect(error).toBeNull()
    expect(fileMetadata?.id).toBe(RANDOM_UUID)
  })

  it('should upload a file with specific name', async () => {
    const FILE_NAME = 'special-name.pdf'

    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      name: FILE_NAME
    })

    expect(error).toBeNull()
    expect(fileMetadata?.name).toBe(FILE_NAME)
  })

  it('should upload a file with specific id and name', async () => {
    const RANDOM_UUID = uuidv4()
    const FILE_NAME = 'special-name.pdf'

    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      id: RANDOM_UUID,
      name: FILE_NAME
    })

    expect(error).toBeNull()
    expect(fileMetadata?.id).toBe(RANDOM_UUID)
    expect(fileMetadata?.name).toBe(FILE_NAME)
  })

  it('should upload a file with specific bucket id', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      bucketId: 'default'
    })

    expect(error).toBeNull()
    expect(fileMetadata?.bucketId).toBe('default')
  })

  it('should upload a file with specific bucket id (test-bucket)', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      bucketId: 'test-bucket'
    })

    expect(error).toBeNull()
    expect(fileMetadata?.bucketId).toBe('test-bucket')
  })
})
