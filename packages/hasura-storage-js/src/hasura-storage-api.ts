/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios, { AxiosInstance } from 'axios'
import { toIso88591 } from './utils'

import {
  ApiDeleteParams,
  ApiDeleteResponse,
  ApiGetPresignedUrlParams,
  ApiGetPresignedUrlResponse,
  ApiUploadParams,
  ApiUploadResponse,
  UploadHeaders
} from './utils'

/**
 * @internal
 * This is an internal class.
 */
export class HasuraStorageApi {
  private url: string
  private httpClient: AxiosInstance
  private accessToken?: string
  private adminSecret?: string

  constructor({ url }: { url: string }) {
    this.url = url

    this.httpClient = axios.create({
      baseURL: this.url
    })
  }

  async upload(params: ApiUploadParams): Promise<ApiUploadResponse> {
    const { formData } = params

    try {
      const res = await this.httpClient.post('/files', formData, {
        headers: {
          ...this.generateUploadHeaders(params),
          ...this.generateAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      })

      return { fileMetadata: res.data, error: null }
    } catch (error) {
      return { fileMetadata: null, error: error as Error }
    }
  }

  async getPresignedUrl(params: ApiGetPresignedUrlParams): Promise<ApiGetPresignedUrlResponse> {
    try {
      const { fileId } = params
      const url = `/files/${fileId}/presignedurl`
      // TODO not implemented yet in hasura-storage
      // const { fileId, ...imageTransformationParams } = params
      // const url = appendImageTransformationParameters(
      //   `/files/${fileId}/presignedurl`,
      //   imageTransformationParams
      // )
      const res = await this.httpClient.get(url, {
        headers: {
          ...this.generateAuthHeaders()
        }
      })
      return { presignedUrl: res.data, error: null }
    } catch (error) {
      return { presignedUrl: null, error: error as Error }
    }
  }

  async delete(params: ApiDeleteParams): Promise<ApiDeleteResponse> {
    try {
      const { fileId } = params
      await this.httpClient.delete(`/files/${fileId}`, {
        headers: {
          ...this.generateAuthHeaders()
        }
      })
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
      uploadheaders['x-nhost-file-name'] = toIso88591(name)
    }

    return uploadheaders
  }

  private generateAuthHeaders():
    | { Authorization: string }
    | { 'x-hasura-admin-secret': string }
    | null {
    if (!this.adminSecret && !this.accessToken) {
      return null
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
