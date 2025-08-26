import { HasuraStorageApi } from './hasura-storage-api'
import {
  appendImageTransformationParameters,
  StorageDeleteParams,
  StorageDeleteResponse,
  StorageGetPresignedUrlParams,
  StorageGetPresignedUrlResponse,
  StorageGetUrlParams,
  StorageUploadFileParams,
  StorageUploadFileResponse,
  StorageUploadFormDataParams,
  StorageUploadFormDataResponse,
  StorageUploadParams,
  StorageUploadResponse,
  StorageDownloadFileParams,
  StorageDownloadFileResponse
} from './utils'

export interface NhostStorageConstructorParams {
  /**
   * Storage endpoint.
   */
  url: string
  /**
   * Admin secret. When set, it is sent as an `x-hasura-admin-secret` header for all requests.
   */
  adminSecret?: string
}
/**
 * @alias Storage
 */
export class HasuraStorageClient {
  readonly url: string
  private api: HasuraStorageApi

  constructor({ url, adminSecret }: NhostStorageConstructorParams) {
    this.url = url
    this.api = new HasuraStorageApi({ url })
    this.setAdminSecret(adminSecret)
  }

  /**
   * Use `nhost.storage.upload` to upload a file. 
   * 
   * It's possible to use [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) or [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) to upload a file. The `File` instance is only available in the browser while `FormData` with [`form-data`](https://www.npmjs.com/package/form-data) works both in the browser and in NodeJS (server).
   * 
   * If no `bucketId` is specified the bucket `default` is used.
   *
   * @example
   * 
   * Upload a file from a browser using `File`.
   * 
   * ```ts
   * await nhost.storage.upload({ file })
   * ```
   * 
   * Upload a file from a browser using `File` to a specific Bucket.
   * 
    @example
   * ```ts
   * await nhost.storage.upload({ file, bucketId: '<Bucket-ID>' })
   * ```
   * 
   * Upload a file from a server using `FormData` with [`form-data`](https://www.npmjs.com/package/form-data).
   *
   * @example
   * ```ts
   * const fd = new FormData() 
   * fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'))
   * 
   * await storage.upload({
   *   formData: fd
   * })
   * ```
   * 
   * @docs https://docs.nhost.io/reference/javascript/storage/upload
   */

  async upload(params: StorageUploadFileParams): Promise<StorageUploadFileResponse>
  async upload(params: StorageUploadFormDataParams): Promise<StorageUploadFormDataResponse>
  async upload(params: StorageUploadParams): Promise<StorageUploadResponse> {
    if ('file' in params) {
      return this.api.uploadFile(params)
    }

    return this.api.uploadFormData(params)
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
    const { fileId, ...imageTransformationParams } = params
    return appendImageTransformationParameters(
      `${this.url}/files/${fileId}`,
      imageTransformationParams
    )
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
    const { fileId, headers, ...imageTransformationParams } = params
    const { presignedUrl, error } = await this.api.getPresignedUrl(params)

    if (error) {
      return { presignedUrl: null, error }
    }

    if (!presignedUrl) {
      return { presignedUrl: null, error: new Error('Invalid file id') }
    }

    const urlWithTransformationParams = appendImageTransformationParameters(
      presignedUrl.url,
      imageTransformationParams
    )

    return {
      presignedUrl: {
        ...presignedUrl,
        url: urlWithTransformationParams
      },
      error: null
    }
  }

  /**
   * Use `nhost.storage.download` to download a file. To download a file the user must have permission to select the file in the `storage.files` table.
   *
   * @example
   * ```ts
   * const { file, error} = await nhost.storage.download({ fileId: '<File-ID>' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/download
   */
  async download(params: StorageDownloadFileParams): Promise<StorageDownloadFileResponse> {
    const { file, error } = await this.api.downloadFile(params)

    if (error) {
      return { file: null, error }
    }

    if (!file) {
      return { file: null, error: new Error('File does not exist') }
    }

    return {
      file,
      error: null
    }
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

  /**
   * Use `nhost.storage.getHeaders` to get global headers sent with all storage requests.
   *
   * @example
   * ```ts
   * nhost.storage.getHeaders()
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/get-headers
   */
  getHeaders(): Record<string, string> {
    return this.api.getHeaders()
  }

  /**
   * Use `nhost.storage.setHeaders` to set global headers to be sent for all subsequent storage requests.
   *
   * @example
   * ```ts
   * nhost.storage.setHeaders({
   *  'x-hasura-role': 'admin'
   * })
   * ```
   *
   * @param headers key value headers object
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/set-headers
   */
  setHeaders(headers?: Record<string, string>): HasuraStorageClient {
    this.api.setHeaders(headers)

    return this
  }

  /**
   * Use `nhost.storage.unsetHeaders` to remove the global headers sent for all subsequent storage requests.
   *
   * @example
   * ```ts
   * nhost.storage.unsetHeaders()
   * ```
   *
   * @param headers key value headers object
   *
   * @docs https://docs.nhost.io/reference/javascript/storage/unset-headers
   */
  unsetHeaders(): HasuraStorageClient {
    this.api.unsetHeaders()
    return this
  }
}
