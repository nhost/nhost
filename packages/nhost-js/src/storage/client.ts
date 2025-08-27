/**
 * This file is auto-generated. Do not edit manually.
 */

import { FetchError, createEnhancedFetch } from '../fetch'
import type { ChainFunction, FetchResponse } from '../fetch'

/**
 * Date in RFC 2822 format
 */
export type RFC2822Date = string

/**
 * Error details.
 @property message (`string`) - Human-readable error message.
    *    Example - `"File not found"`
 @property data? (`Record<string, unknown>`) - Additional data related to the error, if any.*/
export interface ErrorResponseError {
  /**
   * Human-readable error message.
   *    Example - `"File not found"`
   */
  message: string
  /**
   * Additional data related to the error, if any.
   */
  data?: Record<string, unknown>
}

/**
 * Error information returned by the API.
 @property error? (`ErrorResponseError`) - Error details.*/
export interface ErrorResponse {
  /**
   * Error details.
   */
  error?: ErrorResponseError
}

/**
 * Error details.
 @property message (`string`) - Human-readable error message.
    *    Example - `"File not found"`
 @property data? (`Record<string, unknown>`) - Additional data related to the error, if any.*/
export interface ErrorResponseWithProcessedFilesError {
  /**
   * Human-readable error message.
   *    Example - `"File not found"`
   */
  message: string
  /**
   * Additional data related to the error, if any.
   */
  data?: Record<string, unknown>
}

/**
 * Error information returned by the API.
 @property processedFiles? (`FileMetadata[]`) - List of files that were successfully processed before the error occurred.
 @property error? (`ErrorResponseWithProcessedFilesError`) - Error details.*/
export interface ErrorResponseWithProcessedFiles {
  /**
   * List of files that were successfully processed before the error occurred.
   */
  processedFiles?: FileMetadata[]
  /**
   * Error details.
   */
  error?: ErrorResponseWithProcessedFilesError
}

/**
 * Comprehensive metadata information about a file in storage.
 @property id (`string`) - Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
 @property name (`string`) - Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
 @property size (`number`) - Size of the file in bytes.
    *    Example - `245678`
    *    Format - int64
 @property bucketId (`string`) - ID of the bucket containing the file.
    *    Example - `"users-bucket"`
 @property etag (`string`) - Entity tag for cache validation.
    *    Example - `"\"a1b2c3d4e5f6\""`
 @property createdAt (`string`) - Timestamp when the file was created.
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
 @property updatedAt (`string`) - Timestamp when the file was last updated.
    *    Example - `"2023-01-16T09:45:32Z"`
    *    Format - date-time
 @property isUploaded (`boolean`) - Whether the file has been successfully uploaded.
    *    Example - `true`
 @property mimeType (`string`) - MIME type of the file.
    *    Example - `"image/jpeg"`
 @property uploadedByUserId? (`string`) - ID of the user who uploaded the file.
    *    Example - `"abc123def456"`
 @property metadata? (`Record<string, unknown>`) - Custom metadata associated with the file.
    *    Example - `{"alt":"Profile picture","category":"avatar"}`*/
export interface FileMetadata {
  /**
   * Unique identifier for the file.
   *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
   */
  id: string
  /**
   * Name of the file including extension.
   *    Example - `"profile-picture.jpg"`
   */
  name: string
  /**
   * Size of the file in bytes.
   *    Example - `245678`
   *    Format - int64
   */
  size: number
  /**
   * ID of the bucket containing the file.
   *    Example - `"users-bucket"`
   */
  bucketId: string
  /**
   * Entity tag for cache validation.
   *    Example - `"\"a1b2c3d4e5f6\""`
   */
  etag: string
  /**
   * Timestamp when the file was created.
   *    Example - `"2023-01-15T12:34:56Z"`
   *    Format - date-time
   */
  createdAt: string
  /**
   * Timestamp when the file was last updated.
   *    Example - `"2023-01-16T09:45:32Z"`
   *    Format - date-time
   */
  updatedAt: string
  /**
   * Whether the file has been successfully uploaded.
   *    Example - `true`
   */
  isUploaded: boolean
  /**
   * MIME type of the file.
   *    Example - `"image/jpeg"`
   */
  mimeType: string
  /**
   * ID of the user who uploaded the file.
   *    Example - `"abc123def456"`
   */
  uploadedByUserId?: string
  /**
   * Custom metadata associated with the file.
   *    Example - `{"alt":"Profile picture","category":"avatar"}`
   */
  metadata?: Record<string, unknown>
}

/**
 * Basic information about a file in storage.
 @property id (`string`) - Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
 @property name (`string`) - Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
 @property bucketId (`string`) - ID of the bucket containing the file.
    *    Example - `"users-bucket"`
 @property isUploaded (`boolean`) - Whether the file has been successfully uploaded.
    *    Example - `true`*/
export interface FileSummary {
  /**
   * Unique identifier for the file.
   *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
   */
  id: string
  /**
   * Name of the file including extension.
   *    Example - `"profile-picture.jpg"`
   */
  name: string
  /**
   * ID of the bucket containing the file.
   *    Example - `"users-bucket"`
   */
  bucketId: string
  /**
   * Whether the file has been successfully uploaded.
   *    Example - `true`
   */
  isUploaded: boolean
}

/**
 * Contains a presigned URL for direct file operations.
 @property url (`string`) - The presigned URL for file operations.
    *    Example - `"https://storage.example.com/files/abc123?signature=xyz"`
 @property expiration (`number`) - The time in seconds until the URL expires.
    *    Example - `3600`*/
export interface PresignedURLResponse {
  /**
   * The presigned URL for file operations.
   *    Example - `"https://storage.example.com/files/abc123?signature=xyz"`
   */
  url: string
  /**
   * The time in seconds until the URL expires.
   *    Example - `3600`
   */
  expiration: number
}

/**
 * Metadata that can be updated for an existing file.
 @property name? (`string`) - New name to assign to the file.
    *    Example - `"renamed-file.jpg"`
 @property metadata? (`Record<string, unknown>`) - Updated custom metadata to associate with the file.
    *    Example - `{"alt":"Updated image description","category":"profile"}`*/
export interface UpdateFileMetadata {
  /**
   * New name to assign to the file.
   *    Example - `"renamed-file.jpg"`
   */
  name?: string
  /**
   * Updated custom metadata to associate with the file.
   *    Example - `{"alt":"Updated image description","category":"profile"}`
   */
  metadata?: Record<string, unknown>
}

/**
 * Metadata provided when uploading a new file.
 @property id? (`string`) - Optional custom ID for the file. If not provided, a UUID will be generated.
    *    Example - `"custom-id-123"`
 @property name? (`string`) - Name to assign to the file. If not provided, the original filename will be used.
    *    Example - `"custom-filename.png"`
 @property metadata? (`Record<string, unknown>`) - Custom metadata to associate with the file.
    *    Example - `{"alt":"Custom image","category":"document"}`*/
export interface UploadFileMetadata {
  /**
   * Optional custom ID for the file. If not provided, a UUID will be generated.
   *    Example - `"custom-id-123"`
   */
  id?: string
  /**
   * Name to assign to the file. If not provided, the original filename will be used.
   *    Example - `"custom-filename.png"`
   */
  name?: string
  /**
   * Custom metadata to associate with the file.
   *    Example - `{"alt":"Custom image","category":"document"}`
   */
  metadata?: Record<string, unknown>
}

/**
 * Contains version information about the storage service.
 @property buildVersion (`string`) - The version number of the storage service build.
    *    Example - `"1.2.3"`*/
export interface VersionInformation {
  /**
   * The version number of the storage service build.
   *    Example - `"1.2.3"`
   */
  buildVersion: string
}

/**
 * Output format for image files. Use 'auto' for content negotiation based on Accept header
 */
export type OutputImageFormat = 'auto' | 'same' | 'jpeg' | 'webp' | 'png' | 'avif'

/**
 * 
 @property bucket-id? (`string`) - Target bucket identifier where files will be stored.
    *    Example - `"user-uploads"`
 @property metadata[]? (`UploadFileMetadata[]`) - Optional custom metadata for each uploaded file. Must match the order of the file[] array.
 @property file[] (`Blob[]`) - Array of files to upload.*/
export interface UploadFilesBody {
  /**
   * Target bucket identifier where files will be stored.
   *    Example - `"user-uploads"`
   */
  'bucket-id'?: string
  /**
   * Optional custom metadata for each uploaded file. Must match the order of the file[] array.
   */
  'metadata[]'?: UploadFileMetadata[]
  /**
   * Array of files to upload.
   */
  'file[]': Blob[]
}

/**
 * 
 @property processedFiles (`FileMetadata[]`) - List of successfully processed files with their metadata.*/
export interface UploadFilesResponse201 {
  /**
   * List of successfully processed files with their metadata.
   */
  processedFiles: FileMetadata[]
}

/**
 * 
 @property metadata? (`UpdateFileMetadata`) - Metadata that can be updated for an existing file.
 @property file? (`Blob`) - New file content to replace the existing file
    *    Format - binary*/
export interface ReplaceFileBody {
  /**
   * Metadata that can be updated for an existing file.
   */
  metadata?: UpdateFileMetadata
  /**
   * New file content to replace the existing file
   *    Format - binary
   */
  file?: Blob
}

/**
 * 
 @property metadata? (`FileSummary[]`) - */
export interface DeleteBrokenMetadataResponse200 {
  /**
   *
   */
  metadata?: FileSummary[]
}

/**
 * 
 @property files? (`string[]`) - */
export interface DeleteOrphanedFilesResponse200 {
  /**
   *
   */
  files?: string[]
}

/**
 * 
 @property metadata? (`FileSummary[]`) - */
export interface ListBrokenMetadataResponse200 {
  /**
   *
   */
  metadata?: FileSummary[]
}

/**
 * 
 @property metadata? (`FileSummary[]`) - */
export interface ListFilesNotUploadedResponse200 {
  /**
   *
   */
  metadata?: FileSummary[]
}

/**
 * 
 @property files? (`string[]`) - */
export interface ListOrphanedFilesResponse200 {
  /**
   *
   */
  files?: string[]
}

/**
 * Parameters for the getFile method.
    @property q? (number) - Image quality (1-100). Only applies to JPEG, WebP and PNG files
  
    @property h? (number) - Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
  
    @property w? (number) - Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
  
    @property b? (number) - Blur the image using this sigma value. Only applies to image files
  
    @property f? (OutputImageFormat) - Output format for image files. Use 'auto' for content negotiation based on Accept header
  
    *    Output format for image files. Use 'auto' for content negotiation based on Accept header*/
export interface GetFileParams {
  /**
   * Image quality (1-100). Only applies to JPEG, WebP and PNG files
  
   */
  q?: number
  /**
   * Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
  
   */
  h?: number
  /**
   * Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
  
   */
  w?: number
  /**
   * Blur the image using this sigma value. Only applies to image files
  
   */
  b?: number
  /**
   * Output format for image files. Use 'auto' for content negotiation based on Accept header
  
    *    Output format for image files. Use 'auto' for content negotiation based on Accept header
   */
  f?: OutputImageFormat
}
/**
 * Parameters for the getFileMetadataHeaders method.
    @property q? (number) - Image quality (1-100). Only applies to JPEG, WebP and PNG files
  
    @property h? (number) - Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
  
    @property w? (number) - Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
  
    @property b? (number) - Blur the image using this sigma value. Only applies to image files
  
    @property f? (OutputImageFormat) - Output format for image files. Use 'auto' for content negotiation based on Accept header
  
    *    Output format for image files. Use 'auto' for content negotiation based on Accept header*/
export interface GetFileMetadataHeadersParams {
  /**
   * Image quality (1-100). Only applies to JPEG, WebP and PNG files
  
   */
  q?: number
  /**
   * Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
  
   */
  h?: number
  /**
   * Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
  
   */
  w?: number
  /**
   * Blur the image using this sigma value. Only applies to image files
  
   */
  b?: number
  /**
   * Output format for image files. Use 'auto' for content negotiation based on Accept header
  
    *    Output format for image files. Use 'auto' for content negotiation based on Accept header
   */
  f?: OutputImageFormat
}

export interface Client {
  baseURL: string
  pushChainFunction(chainFunction: ChainFunction): void
  /**
     Summary: Upload files
     Upload one or more files to a specified bucket. Supports batch uploading with optional custom metadata for each file. If uploading multiple files, either provide metadata for all files or none.

     This method may return different T based on the response code:
     - 201: UploadFilesResponse201
     */
  uploadFiles(
    body: UploadFilesBody,
    options?: RequestInit
  ): Promise<FetchResponse<UploadFilesResponse201>>

  /**
     Summary: Delete file
     Permanently delete a file from storage. This removes both the file content and its associated metadata.

     This method may return different T based on the response code:
     - 204: void
     */
  deleteFile(id: string, options?: RequestInit): Promise<FetchResponse<void>>

  /**
     Summary: Download file
     Retrieve and download the complete file content. Supports conditional requests, image transformations, and range requests for partial downloads.

     This method may return different T based on the response code:
     - 200: void
     - 206: void
     - 304: void
     - 412: void
     */
  getFile(id: string, params?: GetFileParams, options?: RequestInit): Promise<FetchResponse<Blob>>

  /**
     Summary: Check file information
     Retrieve file metadata headers without downloading the file content. Supports conditional requests and provides caching information.

     This method may return different T based on the response code:
     - 200: void
     - 304: void
     - 412: void
     */
  getFileMetadataHeaders(
    id: string,
    params?: GetFileMetadataHeadersParams,
    options?: RequestInit
  ): Promise<FetchResponse<void>>

  /**
     Summary: Replace file
     Replace an existing file with new content while preserving the file ID. The operation follows these steps:
1. The isUploaded flag is set to false to mark the file as being updated
2. The file content is replaced in the storage backend
3. File metadata is updated (size, mime-type, isUploaded, etc.)

Each step is atomic, but if a step fails, previous steps will not be automatically rolled back.


     This method may return different T based on the response code:
     - 200: FileMetadata
     */
  replaceFile(
    id: string,
    body: ReplaceFileBody,
    options?: RequestInit
  ): Promise<FetchResponse<FileMetadata>>

  /**
     Summary: Retrieve presigned URL to retrieve the file
     Retrieve presigned URL to retrieve the file. Expiration of the URL is
determined by bucket configuration


     This method may return different T based on the response code:
     - 200: PresignedURLResponse
     */
  getFilePresignedURL(
    id: string,
    options?: RequestInit
  ): Promise<FetchResponse<PresignedURLResponse>>

  /**
     Summary: Delete broken metadata
     Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

     This method may return different T based on the response code:
     - 200: DeleteBrokenMetadataResponse200
     */
  deleteBrokenMetadata(
    options?: RequestInit
  ): Promise<FetchResponse<DeleteBrokenMetadataResponse200>>

  /**
     Summary: Deletes orphaned files
     Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

     This method may return different T based on the response code:
     - 200: DeleteOrphanedFilesResponse200
     */
  deleteOrphanedFiles(options?: RequestInit): Promise<FetchResponse<DeleteOrphanedFilesResponse200>>

  /**
     Summary: Lists broken metadata
     Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

     This method may return different T based on the response code:
     - 200: ListBrokenMetadataResponse200
     */
  listBrokenMetadata(options?: RequestInit): Promise<FetchResponse<ListBrokenMetadataResponse200>>

  /**
     Summary: Lists files that haven't been uploaded
     That is, metadata that has isUploaded = false. This is an admin operation that requires the Hasura admin secret.

     This method may return different T based on the response code:
     - 200: ListFilesNotUploadedResponse200
     */
  listFilesNotUploaded(
    options?: RequestInit
  ): Promise<FetchResponse<ListFilesNotUploadedResponse200>>

  /**
     Summary: Lists orphaned files
     Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

     This method may return different T based on the response code:
     - 200: ListOrphanedFilesResponse200
     */
  listOrphanedFiles(options?: RequestInit): Promise<FetchResponse<ListOrphanedFilesResponse200>>

  /**
     Summary: Get service version information
     Retrieves build and version information about the storage service. Useful for monitoring and debugging.

     This method may return different T based on the response code:
     - 200: VersionInformation
     */
  getVersion(options?: RequestInit): Promise<FetchResponse<VersionInformation>>
}

export const createAPIClient = (baseURL: string, chainFunctions: ChainFunction[] = []): Client => {
  let fetch = createEnhancedFetch(chainFunctions)

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction)
    fetch = createEnhancedFetch(chainFunctions)
  }
  const uploadFiles = async (
    body: UploadFilesBody,
    options?: RequestInit
  ): Promise<FetchResponse<UploadFilesResponse201>> => {
    const url = baseURL + `/files`
    const formData = new FormData()
    if (body['bucket-id'] !== undefined) {
      formData.append('bucket-id', body['bucket-id'])
    }
    if (body['metadata[]'] !== undefined) {
      body['metadata[]'].forEach((value) =>
        formData.append(
          'metadata[]',
          new Blob([JSON.stringify(value)], { type: 'application/json' }),
          ''
        )
      )
    }
    if (body['file[]'] !== undefined) {
      body['file[]'].forEach((value) => formData.append('file[]', value))
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      body: formData
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: UploadFilesResponse201 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<UploadFilesResponse201>
  }

  const deleteFile = async (id: string, options?: RequestInit): Promise<FetchResponse<void>> => {
    const url = baseURL + `/files/${id}`
    const res = await fetch(url, {
      ...options,
      method: 'DELETE',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const payload: void = undefined

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<void>
  }

  const getFile = async (
    id: string,
    params?: GetFileParams,
    options?: RequestInit
  ): Promise<FetchResponse<Blob>> => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .map(([key, value]) => {
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object'
              ? JSON.stringify(value)
              : (value as string)
          return `${key}=${encodeURIComponent(stringValue)}`
        })
        .join('&')

    const url = encodedParameters
      ? baseURL + `/files/${id}?${encodedParameters}`
      : baseURL + `/files/${id}`
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const payload: Blob = await res.blob()

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<Blob>
  }

  const getFileMetadataHeaders = async (
    id: string,
    params?: GetFileMetadataHeadersParams,
    options?: RequestInit
  ): Promise<FetchResponse<void>> => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .map(([key, value]) => {
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object'
              ? JSON.stringify(value)
              : (value as string)
          return `${key}=${encodeURIComponent(stringValue)}`
        })
        .join('&')

    const url = encodedParameters
      ? baseURL + `/files/${id}?${encodedParameters}`
      : baseURL + `/files/${id}`
    const res = await fetch(url, {
      ...options,
      method: 'HEAD',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const payload: void = undefined

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<void>
  }

  const replaceFile = async (
    id: string,
    body: ReplaceFileBody,
    options?: RequestInit
  ): Promise<FetchResponse<FileMetadata>> => {
    const url = baseURL + `/files/${id}`
    const formData = new FormData()
    if (body['metadata'] !== undefined) {
      formData.append(
        'metadata',
        new Blob([JSON.stringify(body['metadata'])], {
          type: 'application/json'
        }),
        ''
      )
    }
    if (body['file'] !== undefined) {
      formData.append('file', body['file'])
    }

    const res = await fetch(url, {
      ...options,
      method: 'PUT',
      body: formData
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: FileMetadata = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<FileMetadata>
  }

  const getFilePresignedURL = async (
    id: string,
    options?: RequestInit
  ): Promise<FetchResponse<PresignedURLResponse>> => {
    const url = baseURL + `/files/${id}/presignedurl`
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: PresignedURLResponse = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<PresignedURLResponse>
  }

  const deleteBrokenMetadata = async (
    options?: RequestInit
  ): Promise<FetchResponse<DeleteBrokenMetadataResponse200>> => {
    const url = baseURL + `/ops/delete-broken-metadata`
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: DeleteBrokenMetadataResponse200 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<DeleteBrokenMetadataResponse200>
  }

  const deleteOrphanedFiles = async (
    options?: RequestInit
  ): Promise<FetchResponse<DeleteOrphanedFilesResponse200>> => {
    const url = baseURL + `/ops/delete-orphans`
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: DeleteOrphanedFilesResponse200 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<DeleteOrphanedFilesResponse200>
  }

  const listBrokenMetadata = async (
    options?: RequestInit
  ): Promise<FetchResponse<ListBrokenMetadataResponse200>> => {
    const url = baseURL + `/ops/list-broken-metadata`
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: ListBrokenMetadataResponse200 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<ListBrokenMetadataResponse200>
  }

  const listFilesNotUploaded = async (
    options?: RequestInit
  ): Promise<FetchResponse<ListFilesNotUploadedResponse200>> => {
    const url = baseURL + `/ops/list-not-uploaded`
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: ListFilesNotUploadedResponse200 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<ListFilesNotUploadedResponse200>
  }

  const listOrphanedFiles = async (
    options?: RequestInit
  ): Promise<FetchResponse<ListOrphanedFilesResponse200>> => {
    const url = baseURL + `/ops/list-orphans`
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: ListOrphanedFilesResponse200 = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<ListOrphanedFilesResponse200>
  }

  const getVersion = async (options?: RequestInit): Promise<FetchResponse<VersionInformation>> => {
    const url = baseURL + `/version`
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers
      }
    })

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text()
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {}
      throw new FetchError(payload, res.status, res.headers)
    }

    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text()
    const payload: VersionInformation = responseBody ? JSON.parse(responseBody) : {}

    return {
      body: payload,
      status: res.status,
      headers: res.headers
    } as FetchResponse<VersionInformation>
  }

  return {
    baseURL,
    pushChainFunction,
    uploadFiles,
    deleteFile,
    getFile,
    getFileMetadataHeaders,
    replaceFile,
    getFilePresignedURL,
    deleteBrokenMetadata,
    deleteOrphanedFiles,
    listBrokenMetadata,
    listFilesNotUploaded,
    listOrphanedFiles,
    getVersion
  }
}
