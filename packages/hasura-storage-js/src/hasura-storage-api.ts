import fetchPonyfill from 'fetch-ponyfill'

import LegacyFormData from 'form-data'
import {
  ApiDeleteParams,
  ApiDeleteResponse,
  ApiGetPresignedUrlParams,
  ApiGetPresignedUrlResponse,
  StorageDownloadFileParams,
  StorageDownloadFileResponse,
  StorageUploadFileParams,
  StorageUploadFileResponse,
  StorageUploadFormDataParams,
  StorageUploadFormDataResponse
} from './utils/types'
import { fetchUpload } from './utils/upload'
import { appendImageTransformationParameters } from './utils'

let fetch: any

if (typeof fetch === 'undefined') {
  fetch = fetchPonyfill().fetch
}

/**
 * @internal
 * This is an internal class.
 */
export class HasuraStorageApi {
  private url: string
  private accessToken?: string
  private adminSecret?: string

  constructor({ url }: { url: string }) {
    this.url = url
  }

  async uploadFormData({
    formData,
    headers,
    bucketId
  }: StorageUploadFormDataParams): Promise<StorageUploadFormDataResponse> {
    const { error, fileMetadata } = await fetchUpload(this.url, formData, {
      accessToken: this.accessToken,
      adminSecret: this.adminSecret,
      bucketId,
      headers
    })

    if (error) {
      return { fileMetadata: null, error }
    }

    if (fileMetadata && !('processedFiles' in fileMetadata)) {
      return {
        fileMetadata: {
          processedFiles: [fileMetadata]
        },
        error: null
      }
    }

    return { fileMetadata, error: null }
  }

  async uploadFile({
    file,
    bucketId,
    id,
    name
  }: StorageUploadFileParams): Promise<StorageUploadFileResponse> {
    const formData = typeof window === 'undefined' ? new LegacyFormData() : new FormData()

    formData.append('file[]', file)
    formData.append('metadata[]', JSON.stringify({ id, name }))

    const { error, fileMetadata } = await fetchUpload(this.url, formData, {
      accessToken: this.accessToken,
      adminSecret: this.adminSecret,
      bucketId,
      fileId: id,
      name
    })

    if (error) {
      return { fileMetadata: null, error }
    }

    if (fileMetadata && 'processedFiles' in fileMetadata) {
      return {
        fileMetadata: fileMetadata.processedFiles[0],
        error: null
      }
    }

    return { fileMetadata, error: null }
  }

  async downloadFile(params: StorageDownloadFileParams): Promise<StorageDownloadFileResponse> {
    try {
      const { fileId, headers: customHeaders = {}, ...imageTransformationParams } = params

      const urlWithParams = appendImageTransformationParameters(
        `${this.url}/files/${fileId}`,
        imageTransformationParams
      )

      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {...this.generateAuthHeaders(), ...customHeaders} 
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const file = await response.blob()

      return { file, error: null }
    } catch (error) {
      return { file: null, error: error as Error }
    }
  }

  async getPresignedUrl(params: ApiGetPresignedUrlParams): Promise<ApiGetPresignedUrlResponse> {
    try {
      const { fileId } = params
      
      const response = await fetch(`${this.url}/files/${fileId}/presignedurl`, {
        method: 'GET',
        headers: this.generateAuthHeaders()
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const presignedUrl = await response.json()
      return { presignedUrl, error: null }
    } catch (error) {
      return { presignedUrl: null, error: error as Error }
    }
  }

  async delete(params: ApiDeleteParams): Promise<ApiDeleteResponse> {
    try {
      const { fileId } = params
      const response = await fetch(`${this.url}/files/${fileId}`, {
        method: 'DELETE',
        headers: this.generateAuthHeaders()
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Set the access token to use for authentication.
   *
   * @param accessToken Access token
   * @returns Hasura Storage API instance
   */
  setAccessToken(accessToken?: string): HasuraStorageApi {
    this.accessToken = accessToken

    return this
  }

  /**
   * Set the admin secret to use for authentication.
   *
   * @param adminSecret Hasura admin secret
   * @returns Hasura Storage API instance
   */
  setAdminSecret(adminSecret?: string): HasuraStorageApi {
    this.adminSecret = adminSecret

    return this
  }

  private generateAuthHeaders(): HeadersInit | undefined {
    if (!this.adminSecret && !this.accessToken) {
      return undefined
    }

    if (this.adminSecret) {
      return {
        'x-hasura-admin-secret': this.adminSecret
      }
    }

    return {
      Authorization: `Bearer ${this.accessToken}`
    }
  }
}
