import {
  StorageDeleteParams,
  StorageDeleteResponse,
  StorageGetPresignedUrlParams,
  StorageGetPresignedUrlResponse,
  StorageGetUrlParams,
  StorageUploadParams,
  StorageUploadResponse
} from './utils/types'
import { HasuraStorageApi } from './hasura-storage-api'

export class HasuraStorageClient {
  private url: string
  private api: HasuraStorageApi

  constructor({ url }: { url: string }) {
    this.url = url
    this.api = new HasuraStorageApi({ url })
  }

  /**
   *
   * Use `.upload` to upload a file.
   *
   * @example
   *
   * storage.upload({ file })
   *
   */
  async upload(params: StorageUploadParams): Promise<StorageUploadResponse> {
    const file = new FormData()
    file.append('file', params.file)

    const { fileMetadata, error } = await this.api.upload({
      ...params,
      file
    })
    if (error) {
      return { fileMetadata: null, error }
    }

    if (!fileMetadata) {
      return { fileMetadata: null, error: new Error('Invalid file returned') }
    }

    return { fileMetadata, error: null }
  }

  /**
   *
   * @deprecated use `.getPublicUrl` instead
   *
   */
  getUrl(params: StorageGetUrlParams): string {
    return this.getPublicUrl(params)
  }

  /**
   *
   * Use `.getPublicUrl` to direct file URL to a file.
   *
   * @example
   *
   * storage.getPublicUrl({ fileId: 'uuid' })
   *
   */
  getPublicUrl(params: StorageGetUrlParams): string {
    const { fileId } = params
    return `${this.url}/files/${fileId}`
  }

  /**
   *
   * Use `.getPresignedUrl` to get a presigned URL to a file.
   *
   * @example
   *
   * storage.getPresignedUrl({ fileId: 'uuid' })
   *
   *
   */
  async getPresignedUrl(
    params: StorageGetPresignedUrlParams
  ): Promise<StorageGetPresignedUrlResponse> {
    const { presignedUrl, error } = await this.api.getPresignedUrl(params)
    if (error) {
      return { presignedUrl: null, error }
    }

    if (!presignedUrl) {
      return { presignedUrl: null, error: new Error('Invalid file id') }
    }

    return { presignedUrl, error: null }
  }

  /**
   *
   * Use `.delete` to delete a file.
   *
   * @example
   *
   * storage.delete({ fileId: 'uuid' })
   *
   *
   */
  async delete(params: StorageDeleteParams): Promise<StorageDeleteResponse> {
    const { error } = await this.api.delete(params)
    if (error) {
      return { error }
    }

    return { error: null }
  }

  /**
   * Set the access token to use for authentication.
   *
   * @param accessToken Access token
   * @returns Hasura Storage Client instance
   */
  setAccessToken(accessToken?: string): HasuraStorageClient {
    this.api.setAccessToken(accessToken)

    return this
  }

  /**
   * Set the admin secret to use for authentication.
   *
   * @param adminSecret Hasura admin secret
   * @returns Hasura Storage Client instance
   */
  setAdminSecret(adminSecret?: string): HasuraStorageClient {
    this.api.setAdminSecret(adminSecret)

    return this
  }
}
