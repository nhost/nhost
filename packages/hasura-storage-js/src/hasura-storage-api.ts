import fetch from 'cross-fetch'

import {
  ApiDeleteParams,
  ApiDeleteResponse,
  ApiGetPresignedUrlParams,
  ApiGetPresignedUrlResponse,
  ApiUploadParams,
  StorageUploadResponse
} from './utils/types'
import { fetchUpload } from './utils/upload'

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

  async upload(params: ApiUploadParams): Promise<StorageUploadResponse> {
    const { formData } = params

    return fetchUpload(this.url, formData, {
      accessToken: this.accessToken,
      adminSecret: this.adminSecret,
      bucketId: params.bucketId,
      fileId: params.id,
      name: params.name
    })
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
