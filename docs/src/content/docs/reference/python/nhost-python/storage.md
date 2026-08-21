---
title: Storage
---

Generated Nhost Storage REST client and models.

## Functions

### `create_api_client`

```python
def create_api_client(base_url: 'str', chain_functions: 'list[ChainFunction] | None' = None, http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

Create a new API client.

## Classes

### `Client`

```python
class Client
```

Generated async API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `delete_broken_metadata`

```python
async def delete_broken_metadata(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[DeleteBrokenMetadataResponse200]'
```

##### `delete_file`

```python
async def delete_file(self, id: 'str', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[None]'
```

##### `delete_orphaned_files`

```python
async def delete_orphaned_files(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[DeleteOrphanedFilesResponse200]'
```

##### `get_file`

```python
async def get_file(self, id: 'str', params: 'GetFileParams | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[bytes]'
```

##### `get_file_metadata_headers`

```python
async def get_file_metadata_headers(self, id: 'str', params: 'GetFileMetadataHeadersParams | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[None]'
```

##### `get_file_presigned_url`

```python
async def get_file_presigned_url(self, id: 'str', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[PresignedURLResponse]'
```

##### `get_version`

```python
async def get_version(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[VersionInformation]'
```

##### `list_broken_metadata`

```python
async def list_broken_metadata(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[ListBrokenMetadataResponse200]'
```

##### `list_files_not_uploaded`

```python
async def list_files_not_uploaded(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[ListFilesNotUploadedResponse200]'
```

##### `list_orphaned_files`

```python
async def list_orphaned_files(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[ListOrphanedFilesResponse200]'
```

##### `push_chain_function`

```python
def push_chain_function(self, chain_function: 'ChainFunction') -> 'None'
```

Append a middleware chain function and rebuild the fetch pipeline.

##### `replace_file`

```python
async def replace_file(self, id: 'str', body: 'ReplaceFileBody', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[FileMetadata]'
```

##### `upload_files`

```python
async def upload_files(self, body: 'UploadFilesBody', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[UploadFilesResponse201]'
```

### `DeleteBrokenMetadataResponse200`

```python
class DeleteBrokenMetadataResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] | None` |

### `DeleteOrphanedFilesResponse200`

```python
class DeleteOrphanedFilesResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `files` | `list[str] | None` |

### `ErrorResponse`

```python
class ErrorResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `error` | `ErrorResponseError | None` |

### `ErrorResponseError`

```python
class ErrorResponseError
```

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `data` | `dict[str, Any] | None` |

### `ErrorResponseWithProcessedFiles`

```python
class ErrorResponseWithProcessedFiles
```

#### Fields

| Field | Type |
| --- | --- |
| `processed_files` | `list[FileMetadata] | None` |
| `error` | `ErrorResponseWithProcessedFilesError | None` |

### `ErrorResponseWithProcessedFilesError`

```python
class ErrorResponseWithProcessedFilesError
```

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `data` | `dict[str, Any] | None` |

### `FileMetadata`

```python
class FileMetadata
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `name` | `str` |
| `size` | `int` |
| `bucket_id` | `str` |
| `etag` | `str` |
| `created_at` | `str` |
| `updated_at` | `str` |
| `is_uploaded` | `bool` |
| `mime_type` | `str` |
| `uploaded_by_user_id` | `str | None` |
| `metadata` | `dict[str, Any] | None` |

### `FileSummary`

```python
class FileSummary
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `name` | `str` |
| `bucket_id` | `str` |
| `is_uploaded` | `bool` |

### `GetFileMetadataHeadersParams`

```python
class GetFileMetadataHeadersParams
```

#### Fields

| Field | Type |
| --- | --- |
| `q` | `int | None` |
| `h` | `int | None` |
| `w` | `int | None` |
| `b` | `float | None` |
| `f` | `OutputImageFormat | None` |

### `GetFileParams`

```python
class GetFileParams
```

#### Fields

| Field | Type |
| --- | --- |
| `q` | `int | None` |
| `h` | `int | None` |
| `w` | `int | None` |
| `b` | `float | None` |
| `f` | `OutputImageFormat | None` |

### `ListBrokenMetadataResponse200`

```python
class ListBrokenMetadataResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] | None` |

### `ListFilesNotUploadedResponse200`

```python
class ListFilesNotUploadedResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] | None` |

### `ListOrphanedFilesResponse200`

```python
class ListOrphanedFilesResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `files` | `list[str] | None` |

### `PresignedURLResponse`

```python
class PresignedURLResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `url` | `str` |
| `expiration` | `int` |

### `ReplaceFileBody`

```python
class ReplaceFileBody
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `UpdateFileMetadata | None` |
| `file` | `bytes | UploadFile | None` |

### `UpdateFileMetadata`

```python
class UpdateFileMetadata
```

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str | None` |
| `metadata` | `dict[str, Any] | None` |

### `UploadFileMetadata`

```python
class UploadFileMetadata
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str | None` |
| `name` | `str | None` |
| `metadata` | `dict[str, Any] | None` |

### `UploadFilesBody`

```python
class UploadFilesBody
```

#### Fields

| Field | Type |
| --- | --- |
| `bucket_id` | `str | None` |
| `metadata` | `list[UploadFileMetadata] | None` |
| `file` | `list[bytes | UploadFile]` |

### `UploadFilesResponse201`

```python
class UploadFilesResponse201
```

#### Fields

| Field | Type |
| --- | --- |
| `processed_files` | `list[FileMetadata]` |

### `VersionInformation`

```python
class VersionInformation
```

#### Fields

| Field | Type |
| --- | --- |
| `build_version` | `str` |
