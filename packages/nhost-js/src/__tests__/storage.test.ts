import { describe, it, expect, beforeAll } from '@jest/globals'
import { createClient } from '@nhost/nhost-js'
import { type ErrorResponse } from '@nhost/nhost-js/storage'
import { type FetchError } from '@nhost/nhost-js/fetch'

describe('Test Storage API', () => {
  const nhost = createClient()

  beforeAll(async () => {
    const response = await nhost.auth.signUpEmailPassword({
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      options: {
        displayName: 'Test User',
        locale: 'en',
        defaultRole: 'user',
        allowedRoles: ['user'],
        metadata: {
          source: 'test'
        }
      }
    })
    expect(response.status).toBe(200)

    const body = response.body
    if (!body.session) {
      throw new Error('Session is undefined')
    }
  })

  const uuid1 = crypto.randomUUID()
  const uuid2 = crypto.randomUUID()

  it('should get version', async () => {
    const resp = await nhost.storage.getVersion()

    expect(resp.status).toBe(200)
    expect(resp.body).toBeDefined()
    expect(resp.body.buildVersion).toBe('0.8.0-beta3')
  })

  it('should upload a file', async () => {
    const resp = await nhost.storage.uploadFiles({
      'bucket-id': 'default',
      'metadata[]': [
        {
          id: uuid1,
          name: 'test1',
          metadata: { key1: 'value1' }
        },
        {
          id: uuid2,
          name: 'test2',
          metadata: { key2: 'value2' }
        }
      ],
      'file[]': [
        new Blob(['test1'], { type: 'text/plain' }),
        new Blob(['test2 is larger'], { type: 'text/plain' })
      ]
    })

    const body = resp.body
    expect(body.processedFiles).toBeDefined()
    expect(body.processedFiles?.[0]?.bucketId).toBe('default')
    expect(body.processedFiles?.[0]?.createdAt).toBeDefined()
    expect(body.processedFiles?.[0]?.etag).toBeDefined()
    expect(body.processedFiles?.[0]?.id).toBe(uuid1)
    expect(body.processedFiles?.[0]?.isUploaded).toBe(true)
    expect(body.processedFiles?.[0]?.metadata).toEqual({
      key1: 'value1'
    })
    expect(body.processedFiles?.[0]?.mimeType).toBe('text/plain')
    expect(body.processedFiles?.[0]?.name).toBe('test1')
    expect(body.processedFiles?.[0]?.size).toBe(5)
    expect(body.processedFiles?.[0]?.updatedAt).toBeDefined()
    expect(body.processedFiles?.[0]?.uploadedByUserId).toBeDefined()
    expect(body.processedFiles?.[1]?.bucketId).toBe('default')
    expect(body.processedFiles?.[1]?.createdAt).toBeDefined()
    expect(body.processedFiles?.[1]?.etag).toBeDefined()
    expect(body.processedFiles?.[1]?.id).toBe(uuid2)
    expect(body.processedFiles?.[1]?.isUploaded).toBe(true)
    expect(body.processedFiles?.[1]?.metadata).toEqual({
      key2: 'value2'
    })
    expect(body.processedFiles?.[1]?.mimeType).toBe('text/plain')
    expect(body.processedFiles?.[1]?.name).toBe('test2')
    expect(body.processedFiles?.[1]?.size).toBe(15)
    expect(body.processedFiles?.[1]?.updatedAt).toBeDefined()
    expect(body.processedFiles?.[1]?.uploadedByUserId).toBeDefined()
  })

  it('upload fails', async () => {
    try {
      // @ts-expect-error we want the error for testing purposes
      await nhost.storage.uploadFiles({
        'bucket-id': 'default',
        'metadata[]': [
          {
            id: uuid1,
            name: 'test1',
            metadata: { key1: 'value1' }
          },
          {
            id: uuid2,
            name: 'test2',
            metadata: { key2: 'value2' }
          }
        ]
      })
    } catch (error) {
      const err = error as FetchError<ErrorResponse>

      expect(err).toBeDefined()
      expect(err.status).toBe(400)
      expect(err.body).toBeDefined()
      expect(err.body.error).toBe(
        'error in openapi3filter.RequestError: request body has an error: doesn\'t match schema: Error at "/file[]": property "file[]" is missing'
      )
      expect(err.headers.get('content-type')).toBe('application/json; charset=utf-8')
      expect(err.headers.get('date')).toBeDefined()
    }
  })

  let etag: string

  it('should get file metadata headers', async () => {
    const resp = await nhost.storage.getFileMetadataHeaders(uuid1)

    expect(resp.status).toBe(200)
    expect(resp.headers.get('content-type')).toBe('text/plain')
    expect(resp.headers.get('etag')).toBeDefined()
    expect(resp.headers.get('last-modified')).toBeDefined()
    expect(resp.headers.get('surrogate-key')).toBeDefined()
    expect(resp.headers.get('cache-control')).toBe('max-age=3600')
    expect(resp.headers.get('surrogate-control')).toBe('max-age=3600')
    expect(resp.headers.get('content-length')).toBe('5')
    expect(resp.headers.get('date')).toBeDefined()

    etag = resp.headers.get('etag') || ''
  })

  it('should get file metadata headers with If-None-Match matches', async () => {
    try {
      await nhost.storage.getFileMetadataHeaders(
        uuid1,
        {},
        {
          headers: {
            'If-None-Match': etag
          }
        }
      )
      expect(true).toBe(false) // This line should not be reached
    } catch (error) {
      const err = error as FetchError<ErrorResponse>
      expect(err).toBeDefined()
      expect(err.status).toBe(304)
      expect(err.headers).toBeDefined()
      expect(err.headers.get('etag')).toBe(etag)
      expect(err.headers.get('cache-control')).toBe('max-age=3600')
      expect(err.headers.get('surrogate-control')).toBe('max-age=3600')
      expect(err.headers.get('date')).toBeDefined()
      return
    }
  })

  it('should get file metadata headers with If-None-Match does not match', async () => {
    const resp = await nhost.storage.getFileMetadataHeaders(
      uuid1,
      {},
      {
        headers: {
          'If-None-Match': 'wrong-etag'
        }
      }
    )
    expect(resp.status).toBe(200)
    expect(resp.headers).toBeDefined()
    expect(resp.headers.get('content-type')).toBe('text/plain')
    expect(resp.headers.get('etag')).toBeDefined()
    expect(resp.headers.get('last-modified')).toBeDefined()
    expect(resp.headers.get('surrogate-key')).toBeDefined()
    expect(resp.headers.get('cache-control')).toBe('max-age=3600')
    expect(resp.headers.get('surrogate-control')).toBe('max-age=3600')
    expect(resp.headers.get('content-length')).toBe('5')
    expect(resp.headers.get('date')).toBeDefined()
  })

  it('should get file', async () => {
    const resp = await nhost.storage.getFile(uuid1, {})
    expect(resp.status).toBe(200)
    expect(resp.body).toBeDefined()
    expect(resp.headers).toBeDefined()
    expect(resp.headers.get('content-type')).toBe('text/plain')
    expect(resp.headers.get('etag')).toBeDefined()
    expect(resp.headers.get('last-modified')).toBeDefined()
    expect(resp.headers.get('surrogate-key')).toBeDefined()
    expect(resp.headers.get('cache-control')).toBe('max-age=3600')
    expect(resp.headers.get('surrogate-control')).toBe('max-age=3600')
    expect(resp.headers.get('content-length')).toBe('5')
    expect(resp.headers.get('date')).toBeDefined()
    expect(await resp.body.text()).toBe('test1')
  })

  it('should not get file If-None-Match matches', async () => {
    try {
      await nhost.storage.getFile(
        uuid1,
        {},
        {
          headers: {
            'If-None-Match': etag
          }
        }
      )
    } catch (error) {
      const err = error as FetchError<ErrorResponse>

      expect(err.status).toBe(304)
      expect(err.body).toBeDefined()
      expect(err.headers).toBeDefined()
      expect(err.headers.get('etag')).toBe(etag)
      expect(err.headers.get('cache-control')).toBe('max-age=3600')
      expect(err.headers.get('surrogate-control')).toBe('max-age=3600')
      expect(err.headers.get('date')).toBeDefined()
    }
  })

  it('should replace file', async () => {
    const fileResponse = await nhost.storage.replaceFile(uuid1, {
      file: new Blob(['test1 new'], { type: 'text/plain' }),
      metadata: {
        name: 'test1 new',
        metadata: {
          key1: 'value1 new'
        }
      }
    })
    expect(fileResponse.status).toBe(200)
    expect(fileResponse.body.bucketId).toBe('default')
    expect(fileResponse.body.createdAt).toBeDefined()
    expect(fileResponse.body.etag).toBeDefined()
    expect(fileResponse.body.id).toBe(uuid1)
    expect(fileResponse.body.isUploaded).toBe(true)
    expect(fileResponse.body.metadata).toEqual({ key1: 'value1 new' })
    expect(fileResponse.body.mimeType).toBe('text/plain')
    expect(fileResponse.body.name).toBe('test1 new')
    expect(fileResponse.body.size).toBe(9)
    expect(fileResponse.body.updatedAt).toBeDefined()
    expect(fileResponse.body.uploadedByUserId).toBeDefined()
  })

  it('should delete file', async () => {
    const fileResponse = await nhost.storage.deleteFile(uuid1)
    expect(fileResponse.status).toBe(204)
  })
})
