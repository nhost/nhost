---
title: Storage
---

Nhost Storage: generated REST client and models.

# Structs

## `Client`

```rust
struct Client
```

Generated API client, backed by a reqwest-middleware chain.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` |  |

### Methods

#### `with_role`

```rust
fn with_role<impl Into<String>: Into<String>>(&self, role: impl Into<String>) -> Self
```

Returns a copy of this client that sends `x-hasura-role: <role>` on every
request.

#### `with_headers`

```rust
fn with_headers(&self, headers: HashMap<String, String>) -> Self
```

Returns a copy of this client that sends extra headers on every request.

#### `upload_files`

```rust
async fn upload_files(&self, body: UploadFilesBody) -> Result<UploadFilesResponse201, Error>
```

Performs POST /files.

#### `delete_file`

```rust
async fn delete_file(&self, id: &str) -> Result<(), Error>
```

Performs DELETE /files/{id}.

#### `get_file`

```rust
async fn get_file(&self, id: &str, params: Option<GetFileParams>) -> Result<Vec<u8>, Error>
```

Performs GET /files/{id}.

#### `get_file_metadata_headers`

```rust
async fn get_file_metadata_headers(&self, id: &str, params: Option<GetFileMetadataHeadersParams>) -> Result<(), Error>
```

Performs HEAD /files/{id}.

#### `replace_file`

```rust
async fn replace_file(&self, id: &str, body: ReplaceFileBody) -> Result<FileMetadata, Error>
```

Performs PUT /files/{id}.

#### `get_file_presigned_url`

```rust
async fn get_file_presigned_url(&self, id: &str) -> Result<PresignedUrlResponse, Error>
```

Performs GET /files/{id}/presignedurl.

#### `delete_broken_metadata`

```rust
async fn delete_broken_metadata(&self) -> Result<DeleteBrokenMetadataResponse200, Error>
```

Performs POST /ops/delete-broken-metadata.

#### `delete_orphaned_files`

```rust
async fn delete_orphaned_files(&self) -> Result<DeleteOrphanedFilesResponse200, Error>
```

Performs POST /ops/delete-orphans.

#### `list_broken_metadata`

```rust
async fn list_broken_metadata(&self) -> Result<ListBrokenMetadataResponse200, Error>
```

Performs POST /ops/list-broken-metadata.

#### `list_files_not_uploaded`

```rust
async fn list_files_not_uploaded(&self) -> Result<ListFilesNotUploadedResponse200, Error>
```

Performs POST /ops/list-not-uploaded.

#### `list_orphaned_files`

```rust
async fn list_orphaned_files(&self) -> Result<ListOrphanedFilesResponse200, Error>
```

Performs POST /ops/list-orphans.

#### `get_version`

```rust
async fn get_version(&self) -> Result<VersionInformation, Error>
```

Performs GET /version.

## `DeleteBrokenMetadataResponse200`

```rust
struct DeleteBrokenMetadataResponse200
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

## `DeleteOrphanedFilesResponse200`

```rust
struct DeleteOrphanedFilesResponse200
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `files` | `Option<Vec<String>>` |  |

## `ErrorResponse`

```rust
struct ErrorResponse
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `error` | `Option<ErrorResponseError>` |  |

## `ErrorResponseError`

```rust
struct ErrorResponseError
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `data` | `Option<Value>` |  |

## `ErrorResponseWithProcessedFiles`

```rust
struct ErrorResponseWithProcessedFiles
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Option<Vec<FileMetadata>>` |  |
| `error` | `Option<ErrorResponseWithProcessedFilesError>` |  |

## `ErrorResponseWithProcessedFilesError`

```rust
struct ErrorResponseWithProcessedFilesError
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `data` | `Option<Value>` |  |

## `FileMetadata`

```rust
struct FileMetadata
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `name` | `String` |  |
| `size` | `i64` |  |
| `bucket_id` | `String` |  |
| `etag` | `String` |  |
| `created_at` | `String` |  |
| `updated_at` | `String` |  |
| `is_uploaded` | `bool` |  |
| `mime_type` | `String` |  |
| `uploaded_by_user_id` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |

## `FileSummary`

```rust
struct FileSummary
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `name` | `String` |  |
| `bucket_id` | `String` |  |
| `is_uploaded` | `bool` |  |

## `GetFileMetadataHeadersParams`

```rust
struct GetFileMetadataHeadersParams
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` |  |
| `h` | `Option<i64>` |  |
| `w` | `Option<i64>` |  |
| `b` | `Option<f64>` |  |
| `f` | `Option<OutputImageFormat>` |  |

### Trait implementations

- `Default`

## `GetFileParams`

```rust
struct GetFileParams
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` |  |
| `h` | `Option<i64>` |  |
| `w` | `Option<i64>` |  |
| `b` | `Option<f64>` |  |
| `f` | `Option<OutputImageFormat>` |  |

### Trait implementations

- `Default`

## `ListBrokenMetadataResponse200`

```rust
struct ListBrokenMetadataResponse200
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

## `ListFilesNotUploadedResponse200`

```rust
struct ListFilesNotUploadedResponse200
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<Vec<FileSummary>>` |  |

## `ListOrphanedFilesResponse200`

```rust
struct ListOrphanedFilesResponse200
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `files` | `Option<Vec<String>>` |  |

## `PresignedUrlResponse`

```rust
struct PresignedUrlResponse
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `url` | `String` |  |
| `expiration` | `i64` |  |

## `ReplaceFileBody`

```rust
struct ReplaceFileBody
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<UpdateFileMetadata>` |  |
| `file` | `Option<Vec<u8>>` |  |

## `UpdateFileMetadata`

```rust
struct UpdateFileMetadata
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |

## `UploadFileMetadata`

```rust
struct UploadFileMetadata
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `Option<String>` |  |
| `name` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |

## `UploadFilesBody`

```rust
struct UploadFilesBody
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `bucket_id` | `Option<String>` |  |
| `metadata` | `Option<Vec<UploadFileMetadata>>` |  |
| `file` | `Vec<Vec<u8>>` |  |

## `UploadFilesResponse201`

```rust
struct UploadFilesResponse201
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Vec<FileMetadata>` |  |

## `VersionInformation`

```rust
struct VersionInformation
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `build_version` | `String` |  |

# Type Aliases

## `OutputImageFormat`

```rust
type OutputImageFormat = String
```

One of: "auto", "same", "jpeg", "webp", "png", "avif", "heic".

## `Rfc2822Date`

```rust
type Rfc2822Date = String
```
