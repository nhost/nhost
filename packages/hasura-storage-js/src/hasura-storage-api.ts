import fetch from 'cross-fetch'
import {
  ApiDeleteParams,
  ApiDeleteResponse,
  ApiGetPresignedUrlParams,
  ApiGetPresignedUrlResponse,
  ApiUploadParams,
  ApiUploadResponse,
  UploadHeaders
} from './utils/types'

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

  async upload(params: ApiUploadParams): Promise<ApiUploadResponse> {
    const { formData } = params

    try {
      const response = await fetch(`${this.url}/files`, {
        method: 'POST',
        headers: {
          ...this.generateUploadHeaders(params),
          ...(this.generateAuthHeaders() as any)
        },
        // @ts-ignore https://github.com/form-data/form-data/issues/513
        body: formData
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const fileMetadata = await response.json()
      return { fileMetadata, error: null }
    } catch (error) {
      return { fileMetadata: null, error: error as Error }
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

  private generateUploadHeaders(params: ApiUploadParams): UploadHeaders {
    const { bucketId, name, id } = params
    const uploadheaders: UploadHeaders = {}

    if (bucketId) {
      uploadheaders['x-nhost-bucket-id'] = bucketId
    }
    if (id) {
      uploadheaders['x-nhost-file-id'] = id
    }
    if (name) {
      uploadheaders['x-nhost-file-name'] = name
    }

    return uploadheaders
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
