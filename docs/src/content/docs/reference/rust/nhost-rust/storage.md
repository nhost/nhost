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

Performs POST /files.

##### `delete_file`

```rust
async fn delete_file(&self, id: &str) -> Result<Response<()>, Error>
```

Performs DELETE /files/{id}.

##### `get_file`

```rust
async fn get_file(&self, id: &str, params: Option<GetFileParams>) -> Result<Response<bytes::Bytes>, Error>
```

Performs GET /files/{id}.

##### `get_file_metadata_headers`

```rust
async fn get_file_metadata_headers(&self, id: &str, params: Option<GetFileMetadataHeadersParams>) -> Result<Response<()>, Error>
```

Performs HEAD /files/{id}.

##### `replace_file`

```rust
async fn replace_file(&self, id: &str, body: ReplaceFileBody) -> Result<Response<FileMetadata>, Error>
```

Performs PUT /files/{id}.

##### `get_file_presigned_url`

```rust
async fn get_file_presigned_url(&self, id: &str) -> Result<Response<PresignedUrlResponse>, Error>
```

Performs GET /files/{id}/presignedurl.

##### `delete_broken_metadata`

```rust
async fn delete_broken_metadata(&self) -> Result<Response<DeleteBrokenMetadataResponse200>, Error>
```

Performs POST /ops/delete-broken-metadata.

##### `delete_orphaned_files`

```rust
async fn delete_orphaned_files(&self) -> Result<Response<DeleteOrphanedFilesResponse200>, Error>
```

Performs POST /ops/delete-orphans.

##### `list_broken_metadata`

```rust
async fn list_broken_metadata(&self) -> Result<Response<ListBrokenMetadataResponse200>, Error>
```

Performs POST /ops/list-broken-metadata.

##### `list_files_not_uploaded`

```rust
async fn list_files_not_uploaded(&self) -> Result<Response<ListFilesNotUploadedResponse200>, Error>
```

Performs POST /ops/list-not-uploaded.

##### `list_orphaned_files`

```rust
async fn list_orphaned_files(&self) -> Result<Response<ListOrphanedFilesResponse200>, Error>
```

Performs POST /ops/list-orphans.

##### `get_version`

```rust
async fn get_version(&self) -> Result<Response<VersionInformation>, Error>
```

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

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `error` | `Option<storage::ErrorResponseError>` |  |

### `ErrorResponseError`

```rust
struct ErrorResponseError
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `data` | `Option<serde_json::Value>` |  |

### `ErrorResponseWithProcessedFiles`

```rust
struct ErrorResponseWithProcessedFiles
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Option<Vec<FileMetadata>>` |  |
| `error` | `Option<ErrorResponseWithProcessedFilesError>` |  |

### `ErrorResponseWithProcessedFilesError`

```rust
struct ErrorResponseWithProcessedFilesError
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `data` | `Option<serde_json::Value>` |  |

### `FileMetadata`

```rust
struct FileMetadata
```

#### Fields

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
| `metadata` | `Option<serde_json::Value>` |  |

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

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `name` | `String` |  |
| `bucket_id` | `String` |  |
| `is_uploaded` | `bool` |  |

### `GetFileMetadataHeadersParams`

```rust
struct GetFileMetadataHeadersParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` |  |
| `h` | `Option<i64>` |  |
| `w` | `Option<i64>` |  |
| `b` | `Option<f64>` |  |
| `f` | `Option<OutputImageFormat>` |  |
| `if_match` | `Option<String>` |  |
| `if_none_match` | `Option<String>` |  |
| `if_modified_since` | `Option<Rfc2822Date>` |  |
| `if_unmodified_since` | `Option<Rfc2822Date>` |  |

#### Trait implementations

- `Default`

### `GetFileParams`

```rust
struct GetFileParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `q` | `Option<i64>` |  |
| `h` | `Option<i64>` |  |
| `w` | `Option<i64>` |  |
| `b` | `Option<f64>` |  |
| `f` | `Option<OutputImageFormat>` |  |
| `if_match` | `Option<String>` |  |
| `if_none_match` | `Option<String>` |  |
| `if_modified_since` | `Option<Rfc2822Date>` |  |
| `if_unmodified_since` | `Option<Rfc2822Date>` |  |
| `range` | `Option<String>` |  |

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

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `url` | `String` |  |
| `expiration` | `i64` |  |

### `ReplaceFileBody`

```rust
struct ReplaceFileBody
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `metadata` | `Option<UpdateFileMetadata>` |  |
| `file` | `Option<FilePart>` |  |

### `UpdateFileMetadata`

```rust
struct UpdateFileMetadata
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `Option<String>` |  |
| `metadata` | `Option<serde_json::Value>` |  |

### `UploadFileMetadata`

```rust
struct UploadFileMetadata
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `Option<String>` |  |
| `name` | `Option<String>` |  |
| `metadata` | `Option<serde_json::Value>` |  |

### `UploadFilesBody`

```rust
struct UploadFilesBody
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `bucket_id` | `Option<String>` |  |
| `metadata` | `Option<Vec<UploadFileMetadata>>` |  |
| `file` | `Vec<FilePart>` |  |

### `UploadFilesResponse201`

```rust
struct UploadFilesResponse201
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `processed_files` | `Vec<FileMetadata>` |  |

### `VersionInformation`

```rust
struct VersionInformation
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `build_version` | `String` |  |

## Type Aliases

### `OutputImageFormat`

```rust
type OutputImageFormat = String
```

One of: "auto", "same", "jpeg", "webp", "png", "avif", "heic".

### `Rfc2822Date`

```rust
type Rfc2822Date = String
```
