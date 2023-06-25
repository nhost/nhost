import fetchPonyfill from 'fetch-ponyfill'
import FormData from 'form-data'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { storage } from './utils/helpers'

const { fetch } = fetchPonyfill()

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

    const file = fs.createReadStream('./tests/assets/sample.pdf')

    const { fileMetadata, error } = await storage.upload({
      file: file as unknown as File,
      id: RANDOM_UUID
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { id: fileId } = fileMetadata

    expect(error).toBeNull()
    expect(fileId).toBe(RANDOM_UUID)
  })

  it('should upload a file with specific name', async () => {
    const FILE_NAME = 'special-name.pdf'

    const file = fs.createReadStream('./tests/assets/sample.pdf')

    const { fileMetadata, error } = await storage.upload({
      file: file as unknown as File,
      name: FILE_NAME
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { name: fileName } = fileMetadata

    expect(error).toBeNull()
    expect(fileName).toBe(FILE_NAME)
  })

  it('should upload a file with a non-ISO 8859-1 name', async () => {
    const file = fs.createReadStream('./tests/assets/sample.pdf')

    const { fileMetadata, error } = await storage.upload({
      file: file as unknown as File,
      name: '你 好'
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { name: fileName } = fileMetadata

    expect(error).toBeNull()
    expect(fileName).toMatchInlineSnapshot('"%E4%BD%A0%20%E5%A5%BD"')
  })

  it('should upload a file with specific id and name', async () => {
    const RANDOM_UUID = uuidv4()
    const FILE_NAME = 'special-name.pdf'

    const file = fs.createReadStream('./tests/assets/sample.pdf')

    const { fileMetadata, error } = await storage.upload({
      file: file as unknown as File,
      id: RANDOM_UUID,
      name: FILE_NAME
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { id: fileId, name: fileName } = fileMetadata

    expect(error).toBeNull()
    expect(fileId).toBe(RANDOM_UUID)
    expect(fileName).toBe(FILE_NAME)
  })

  it('should upload a file with specific bucket id', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      bucketId: 'default'
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { bucketId } =
      'processedFiles' in fileMetadata ? fileMetadata.processedFiles[0] : fileMetadata

    expect(error).toBeNull()
    expect(bucketId).toBe('default')
  })

  it('should upload a file with specific bucket id (test-bucket)', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))

    const { fileMetadata, error } = await storage.upload({
      formData: fd,
      bucketId: 'test-bucket'
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    const { bucketId } =
      'processedFiles' in fileMetadata ? fileMetadata.processedFiles[0] : fileMetadata

    expect(error).toBeNull()
    expect(bucketId).toBe('test-bucket')
  })
})
