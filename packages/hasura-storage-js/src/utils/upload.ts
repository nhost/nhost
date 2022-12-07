import fetch from 'cross-fetch'
import FormData from 'form-data'
import { ErrorPayload, StorageUploadResponse } from './types'

export const fetchUpload = async (
  backendUrl: string,
  data: FormData,
  {
    accessToken,
    name,
    fileId,
    bucketId,
    adminSecret
  }: {
    accessToken?: string
    name?: string
    fileId?: string
    bucketId?: string
    adminSecret?: string
  } = {}
): Promise<StorageUploadResponse> => {
  const headers: HeadersInit = {}
  if (fileId) {
    headers['x-nhost-file-id'] = fileId
  }
  if (bucketId) {
    headers['x-nhost-bucket-id'] = bucketId
  }
  if (name) {
    headers['x-nhost-file-name'] = name
  }
  if (adminSecret) {
    headers['x-hasura-admin-secret'] = adminSecret
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  try {
    const response = await fetch(`${backendUrl}/files`, {
      method: 'POST',
      headers,
      // @ts-ignore https://github.com/form-data/form-data/issues/513
      body: data
    })

    if (!response.ok) {
      const error: ErrorPayload = {
        status: response.status,
        message: await response.text(),
        // TODO errors from hasura-storage are not codified
        error: response.statusText
      }
      return { error, fileMetadata: null }
    }
    const fileMetadata: {
      bucketId: string
      createdAt: string
      etag: string
      id: string
      isUploaded: true
      mimeType: string
      name: string
      size: number
      updatedAt: string
      uploadedByUserId: string
    } = await response.json()
    return { fileMetadata, error: null }
  } catch (e) {
    const error: ErrorPayload = {
      status: 0,
      message: (e as Error).message,
      error: (e as Error).message
    }
    return { error, fileMetadata: null }
  }
}
