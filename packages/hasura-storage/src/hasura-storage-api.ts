/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios, { AxiosInstance } from 'axios'
import {
  ApiDeleteParams,
  ApiDeleteResponse,
  ApiGetPresignedUrlParams,
  ApiGetPresignedUrlResponse,
  ApiUploadParams,
  ApiUploadResponse,
  UploadHeaders
} from './utils/types'

export class HasuraStorageApi {
  private url: string
  private httpClient: AxiosInstance
  private accessToken: string | undefined

  constructor({ url }: { url: string }) {
    this.url = url

    this.httpClient = axios.create({
      baseURL: this.url,
      timeout: 10_000
    })
  }

  async upload(params: ApiUploadParams): Promise<ApiUploadResponse> {
    try {
      const res = await this.httpClient.post('/files', params.file, {
        headers: {
          ...this.generateUploadHeaders(params),
          ...this.generateAuthHeaders()
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
      const res = await this.httpClient.get(`/files/${fileId}/presignedurl`, {
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

  setAccessToken(accessToken: string | undefined) {
    this.accessToken = accessToken
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

  private generateAuthHeaders() {
    if (!this.accessToken) {
      return null
    }

    return {
      Authorization: `Bearer ${this.accessToken}`
    }
  }
}
