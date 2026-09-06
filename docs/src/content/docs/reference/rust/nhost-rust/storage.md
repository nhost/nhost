---
title: Storage
---

Nhost Storage: generated REST client and models.

## Structs

### `Client`

```rust
struct Client
```

Generated API client, backed by a reqwest-middleware chain.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` |  |

#### Methods

##### `new`

```rust
fn new(base_url: impl Into<String>, reqwest: reqwest::Client, middleware: Vec<Arc<dyn reqwest_middleware::Middleware>>) -> Self
```

Creates a new API client for `base_url` from a base client and an
ordered middleware stack (the first entry runs first on the way out).

Most applications get their clients from `Nhost::builder` instead; use
this together with `Nhost::from_clients` to assemble the pipeline
yourself.

##### `with_session_capture`

```rust
fn with_session_capture(self, sessions: SessionStorage) -> Self
```

Captures a session from every successful response that carries one into
`sessions`. This replaces the JS SDK's response-sniffing middleware,
which cannot work on wasm; only the auth service returns sessions.

##### `with_role`

```rust
fn with_role(&self, role: impl Into<String>) -> Self
```

Returns a copy of this client that sends `x-hasura-role: <role>` on every
request.

##### `with_headers`

```rust
fn with_headers(&self, headers: HashMap<String, String>) -> Self
```

Returns a copy of this client that sends extra headers on every request.

##### `upload_files`

```rust
async fn upload_files(&self, body: UploadFilesBody) -> Result<Response<UploadFilesResponse201>, Error>
```

Upload files

Upload one or more files to a specified bucket. Supports batch uploading with optional custom metadata for each file. If uploading multiple files, either provide metadata for all files or none.

Performs POST /files.

##### `delete_file`

```rust
async fn delete_file(&self, id: &str) -> Result<Response<()>, Error>
```

Delete file

Permanently delete a file from storage. This removes both the file content and its associated metadata.

Performs DELETE /files/{id}.

##### `get_file`

```rust
async fn get_file(&self, id: &str, params: Option<GetFileParams>) -> Result<Response<bytes::Bytes>, Error>
```

Download file

Retrieve and download the complete file content. Supports conditional requests, image transformations, and range requests for partial downloads.

Performs GET /files/{id}.

##### `get_file_metadata_headers`

```rust
async fn get_file_metadata_headers(&self, id: &str, params: Option<GetFileMetadataHeadersParams>) -> Result<Response<()>, Error>
```

Check file information

Retrieve file metadata headers without downloading the file content. Supports conditional requests and provides caching information.

Performs HEAD /files/{id}.

##### `replace_file`

```rust
async fn replace_file(&self, id: &str, body: ReplaceFileBody) -> Result<Response<FileMetadata>, Error>
```

Replace file

Replace an existing file with new content while preserving the file ID. The operation follows these steps:
1\. The isUploaded flag is set to false to mark the file as being updated
2\. The file content is replaced in the storage backend
3\. File metadata is updated (size, mime\-type, isUploaded, etc.)

Each step is atomic, but if a step fails, previous steps will not be automatically rolled back.

Performs PUT /files/{id}.

##### `get_file_presigned_url`

```rust
async fn get_file_presigned_url(&self, id: &str) -> Result<Response<PresignedUrlResponse>, Error>
```

Retrieve presigned URL to retrieve the file

Retrieve presigned URL to retrieve the file. Expiration of the URL is
determined by bucket configuration

Performs GET /files/{id}/presignedurl.

##### `delete_broken_metadata`

```rust
async fn delete_broken_metadata(&self) -> Result<Response<DeleteBrokenMetadataResponse200>, Error>
```

Delete broken metadata

Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

Performs POST /ops/delete-broken-metadata.

##### `delete_orphaned_files`

```rust
async fn delete_orphaned_files(&self) -> Result<Response<DeleteOrphanedFilesResponse200>, Error>
```

Deletes orphaned files

Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

Performs POST /ops/delete-orphans.

##### `list_broken_metadata`

```rust
async fn list_broken_metadata(&self) -> Result<Response<ListBrokenMetadataResponse200>, Error>
```

Lists broken metadata

Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

Performs POST /ops/list-broken-metadata.

##### `list_files_not_uploaded`

```rust
async fn list_files_not_uploaded(&self) -> Result<Response<ListFilesNotUploadedResponse200>, Error>
```

Lists files that haven't been uploaded

That is, metadata that has isUploaded = false. This is an admin operation that requires the Hasura admin secret.

Performs POST /ops/list-not-uploaded.

##### `list_orphaned_files`

```rust
async fn list_orphaned_files(&self) -> Result<Response<ListOrphanedFilesResponse200>, Error>
```

Lists orphaned files

Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

Performs POST /ops/list-orphans.

##### `get_version`

```rust
async fn get_version(&self) -> Result<Response<VersionInformation>, Error>
```

Get service version information

Retrieves build and version information about the storage service. Useful for monitoring and debugging.

Performs GET /version.

### `DeleteBrokenMetadataResponse200`

```rust
struct DeleteBrokenMetadataResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

### `DeleteOrphanedFilesResponse200`

```rust
struct DeleteOrphanedFilesResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `files` | `Option<Vec<String>>` |  |

### `ErrorResponse`

```rust
struct ErrorResponse
```

Error information returned by the API.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `error` | `Option<storage::ErrorResponseError>` | Error details. |

### `ErrorResponseError`

```rust
struct ErrorResponseError
```

Error details.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | Human\-readable error message. |
| `data` | `Option<serde_json::Value>` | Additional data related to the error, if any. |

### `ErrorResponseWithProcessedFiles`

```rust
struct ErrorResponseWithProcessedFiles
```

Error information returned by the API.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Option<Vec<FileMetadata>>` | List of files that were successfully processed before the error occurred. |
| `error` | `Option<ErrorResponseWithProcessedFilesError>` | Error details. |

### `ErrorResponseWithProcessedFilesError`

```rust
struct ErrorResponseWithProcessedFilesError
```

Error details.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | Human\-readable error message. |
| `data` | `Option<serde_json::Value>` | Additional data related to the error, if any. |

### `FileMetadata`

```rust
struct FileMetadata
```

Comprehensive metadata information about a file in storage.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Unique identifier for the file. |
| `name` | `String` | Name of the file including extension. |
| `size` | `i64` | Size of the file in bytes. |
| `bucket_id` | `String` | ID of the bucket containing the file. |
| `etag` | `String` | Entity tag for cache validation. |
| `created_at` | `String` | Timestamp when the file was created. |
| `updated_at` | `String` | Timestamp when the file was last updated. |
| `is_uploaded` | `bool` | Whether the file has been successfully uploaded. |
| `mime_type` | `String` | MIME type of the file. |
| `uploaded_by_user_id` | `Option<String>` | ID of the user who uploaded the file. |
| `metadata` | `Option<serde_json::Value>` | Custom metadata associated with the file. |

### `FilePart`

```rust
struct FilePart
```

A file sent as one part of a multipart request.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `file_name` | `String` | The filename reported to the server in `Content-Disposition`. |
| `content` | `Vec<u8>` | The complete file contents. |
| `content_type` | `Option<String>` | An optional MIME type for this part. |

### `FileSummary`

```rust
struct FileSummary
```

Basic information about a file in storage.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Unique identifier for the file. |
| `name` | `String` | Name of the file including extension. |
| `bucket_id` | `String` | ID of the bucket containing the file. |
| `is_uploaded` | `bool` | Whether the file has been successfully uploaded. |

### `GetFileMetadataHeadersParams`

```rust
struct GetFileMetadataHeadersParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` | Image quality (1\-100). Only applies to JPEG, WebP, AVIF and HEIC files |
| `h` | `Option<i64>` | Maximum height, in pixels, to resize image to while maintaining aspect ratio. Only applies to image files. Values above the server\-configured maximum (default 8000) are rejected with a 400 error. |
| `w` | `Option<i64>` | Maximum width, in pixels, to resize image to while maintaining aspect ratio. Only applies to image files. Values above the server\-configured maximum (default 8000) are rejected with a 400 error. |
| `b` | `Option<f64>` | Blur the image using this sigma value. Only applies to image files. Values above the server\-configured maximum (default 250) are rejected with a 400 error. |
| `f` | `Option<OutputImageFormat>` | Output format for image files. Use 'auto' for content negotiation based on Accept header Output format for image files. Use 'auto' for content negotiation based on Accept header |
| `if_match` | `Option<String>` | Only return the file if the current ETag matches one of the values provided |
| `if_none_match` | `Option<String>` | Only return the file if the current ETag does not match any of the values provided |
| `if_modified_since` | `Option<Rfc2822Date>` | Only return the file if it has been modified after the given date Date in RFC 2822 format |
| `if_unmodified_since` | `Option<Rfc2822Date>` | Only return the file if it has not been modified after the given date Date in RFC 2822 format |

#### Trait implementations

- `Default`

### `GetFileParams`

```rust
struct GetFileParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` | Image quality (1\-100). Only applies to JPEG, WebP, AVIF and HEIC files |
| `h` | `Option<i64>` | Maximum height, in pixels, to resize image to while maintaining aspect ratio. Only applies to image files. Values above the server\-configured maximum (default 8000) are rejected with a 400 error. |
| `w` | `Option<i64>` | Maximum width, in pixels, to resize image to while maintaining aspect ratio. Only applies to image files. Values above the server\-configured maximum (default 8000) are rejected with a 400 error. |
| `b` | `Option<f64>` | Blur the image using this sigma value. Only applies to image files. Values above the server\-configured maximum (default 250) are rejected with a 400 error. |
| `f` | `Option<OutputImageFormat>` | Output format for image files. Use 'auto' for content negotiation based on Accept header Output format for image files. Use 'auto' for content negotiation based on Accept header |
| `if_match` | `Option<String>` | Only return the file if the current ETag matches one of the values provided |
| `if_none_match` | `Option<String>` | Only return the file if the current ETag does not match any of the values provided |
| `if_modified_since` | `Option<Rfc2822Date>` | Only return the file if it has been modified after the given date Date in RFC 2822 format |
| `if_unmodified_since` | `Option<Rfc2822Date>` | Only return the file if it has not been modified after the given date Date in RFC 2822 format |
| `range` | `Option<String>` | Range of bytes to retrieve from the file. Format: bytes=start\-end |

#### Trait implementations

- `Default`

### `ListBrokenMetadataResponse200`

```rust
struct ListBrokenMetadataResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

### `ListFilesNotUploadedResponse200`

```rust
struct ListFilesNotUploadedResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

### `ListOrphanedFilesResponse200`

```rust
struct ListOrphanedFilesResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `files` | `Option<Vec<String>>` |  |

### `PresignedUrlResponse`

```rust
struct PresignedUrlResponse
```

Contains a presigned URL for direct file operations.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `url` | `String` | The presigned URL for file operations. |
| `expiration` | `i64` | The time in seconds until the URL expires. |

### `ReplaceFileBody`

```rust
struct ReplaceFileBody
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<UpdateFileMetadata>` | Metadata that can be updated for an existing file. |
| `file` | `Option<FilePart>` | New file content to replace the existing file |

### `UpdateFileMetadata`

```rust
struct UpdateFileMetadata
```

Metadata that can be updated for an existing file.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `Option<String>` | New name to assign to the file. |
| `metadata` | `Option<serde_json::Value>` | Updated custom metadata to associate with the file. |

### `UploadFileMetadata`

```rust
struct UploadFileMetadata
```

Metadata provided when uploading a new file.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `Option<String>` | Optional custom ID for the file. If not provided, a UUID will be generated. |
| `name` | `Option<String>` | Name to assign to the file. If not provided, the original filename will be used. |
| `metadata` | `Option<serde_json::Value>` | Custom metadata to associate with the file. |

### `UploadFilesBody`

```rust
struct UploadFilesBody
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `bucket_id` | `Option<String>` | Target bucket identifier where files will be stored. |
| `metadata` | `Option<Vec<UploadFileMetadata>>` | Optional custom metadata for each uploaded file. Must match the order of the file\[\] array. |
| `file` | `Vec<FilePart>` | Array of files to upload. |

### `UploadFilesResponse201`

```rust
struct UploadFilesResponse201
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Vec<FileMetadata>` | List of successfully processed files with their metadata. |

### `VersionInformation`

```rust
struct VersionInformation
```

Contains version information about the storage service.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `build_version` | `String` | The version number of the storage service build. |

## Type Aliases

### `OutputImageFormat`

```rust
type OutputImageFormat = String
```

Output format for image files. Use 'auto' for content negotiation based on Accept header

One of: "auto", "same", "jpeg", "webp", "png", "avif", "heic".

### `Rfc2822Date`

```rust
type Rfc2822Date = String
```

Date in RFC 2822 format
