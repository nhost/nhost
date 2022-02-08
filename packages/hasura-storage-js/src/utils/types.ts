export interface StorageUploadParams {
  file: File
  id?: string
  name?: string
  bucketId?: string
}

export type StorageUploadResponse =
  | { fileMetadata: FileResponse; error: null }
  | { fileMetadata: null; error: Error }

export interface StorageGetUrlParams {
  fileId: string
}

export interface StorageGetPresignedUrlParams {
  fileId: string
}

export type StorageGetPresignedUrlResponse =
  | { presignedUrl: { url: string; expiration: number }; error: null }
  | { presignedUrl: null; error: Error }

export interface StorageDeleteParams {
  fileId: string
}

export interface StorageDeleteResponse {
  error: Error | null
}

interface FileResponse {
  id: string
  name: string
  size: number
  mimeType: string
  etag: string
  createdAt: string
  bucketId: string
}

export interface ApiUploadParams {
  file: FormData
  id?: string
  name?: string
  bucketId?: string
}

export type ApiUploadResponse =
  | { fileMetadata: FileResponse; error: null }
  | { fileMetadata: null; error: Error }

export interface ApiGetPresignedUrlParams {
  fileId: string
}

export type ApiGetPresignedUrlResponse =
  | { presignedUrl: { url: string; expiration: number }; error: null }
  | { presignedUrl: null; error: Error }

export interface ApiDeleteParams {
  fileId: string
}

export interface ApiDeleteResponse {
  error: Error | null
}

export interface UploadHeaders {
  'x-nhost-bucket-id'?: string
  'x-nhost-file-id'?: string
  'x-nhost-file-name'?: string
}
