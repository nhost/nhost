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

/**
 * @alias Storage
 */
export class HasuraStorageClient {
  private url: string
  private api: HasuraStorageApi

  constructor({ url }: { url: string }) {
    this.url = url
    this.api = new HasuraStorageApi({ url })
  }

  /**
   * Use `nhost.storage.upload` to upload a file. The `file` must be of type `File` (https://developer.mozilla.org/en-US/docs/Web/API/File).
   * 
   * If no `bucket` is specified the `default` bucket will be used.
   *
   * @example
   * ```ts
   * await nhost.storage.upload({ file })
   * ```
   * 
    @example
   * ```ts
   * await nhost.storage.upload({ file, bucketId: '<Bucket-ID>' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/upload
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
   * @deprecated Use `nhost.storage.getPublicUrl()` instead.
   */
  getUrl(params: StorageGetUrlParams): string {
    return this.getPublicUrl(params)
  }

  /**
   * Use `nhost.storage.getPublicUrl` to get the public URL of a file. The public URL can be used for un-authenticated users to access files. To access public files the `public` role must have permissions to select the file in the `storage.files` table.
   *
   * @example
   * ```ts
   * const publicUrl = nhost.storage.getPublicUrl({ fileId: '<File-ID>' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/get-public-url
   */
  getPublicUrl(params: StorageGetUrlParams): string {
    const { fileId } = params
    return `${this.url}/files/${fileId}`
  }

  /**
   * Use `nhost.storage.getPresignedUrl` to get a presigned URL of a file. To get a presigned URL the user must have permission to select the file in the `storage.files` table.
   *
   * @example
   * ```ts
   * const { presignedUrl, error} = await nhost.storage.getPresignedUrl({ fileId: '<File-ID>' })
   *
   * if (error) {
   *   throw error;
   * }
   *
   * console.log('url: ', presignedUrl.url)
   * console.log('expiration: ', presignedUrl.expiration)
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/get-presigned-url
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
   * Use `nhost.storage.delete` to delete a file. To delete a file the user must have permissions to delete the file in the `storage.files` table. Deleting the file using `nhost.storage.delete()` will delete both the file and its metadata.
   *
   * @example
   * ```ts
   * const { error } = await nhost.storage.delete({ fileId: 'uuid' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/delete
   */
  async delete(params: StorageDeleteParams): Promise<StorageDeleteResponse> {
    const { error } = await this.api.delete(params)
    if (error) {
      return { error }
    }

    return { error: null }
  }

  /**
   * Use `nhost.storage.setAccessToken` to a set an access token to be used in subsequent storage requests. Note that if you're signin in users with `nhost.auth.signIn()` the access token will be set automatically.
   *
   * @example
   * ```ts
   * nhost.storage.setAccessToken('some-access-token')
   * ```
   *
   * @param accessToken Access token
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/set-access-token
   */
  setAccessToken(accessToken?: string): HasuraStorageClient {
    this.api.setAccessToken(accessToken)

    return this
  }

  /**
   * Use `nhost.storage.adminSecret` to set the admin secret to be used for subsequent storage requests. This is useful if you want to run storage in "admin mode".
   *
   * @example
   * ```ts
   * nhost.storage.setAdminSecret('some-admin-secret')
   * ```
   *
   * @param adminSecret Hasura admin secret
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/set-admin-secret
   */
  setAdminSecret(adminSecret?: string): HasuraStorageClient {
    this.api.setAdminSecret(adminSecret)

    return this
  }
}
