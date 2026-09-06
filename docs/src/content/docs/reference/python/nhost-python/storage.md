---
title: Storage
---

Nhost Storage generated API and hand-written conveniences.

## Functions

### `create_api_client`

```python
def create_api_client(base_url: 'str', *, chain_functions: 'Sequence[ChainFunction]' = (), http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

Create a generated API client.

## Classes

### `Client`

```python
class Client
```

Generated async API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `aclose`

```python
async def aclose(self) -> 'None'
```

Close the internally owned HTTP client, if any.

##### `delete_broken_metadata`

```python
async def delete_broken_metadata(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[DeleteBrokenMetadataResponse200]'
```

Delete broken metadata

Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[DeleteBrokenMetadataResponse200]: The HTTP response.

##### `delete_file`

```python
async def delete_file(self, id: 'str', *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[None]'
```

Delete file

Permanently delete a file from storage. This removes both the file content and its associated metadata.

Args:
    id (str): Unique identifier of the file to delete
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `delete_orphaned_files`

```python
async def delete_orphaned_files(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[DeleteOrphanedFilesResponse200]'
```

Deletes orphaned files

Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[DeleteOrphanedFilesResponse200]: The HTTP response.

##### `get_file`

```python
async def get_file(self, id: 'str', *, params: 'GetFileParams | None' = None, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[bytes]'
```

Download file

Retrieve and download the complete file content. Supports conditional requests, image transformations, and range requests for partial downloads.

Args:
    id (str): Unique identifier of the file to download
    params (GetFileParams): Query and header parameters.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[bytes]: The HTTP response.

##### `get_file_metadata_headers`

```python
async def get_file_metadata_headers(self, id: 'str', *, params: 'GetFileMetadataHeadersParams | None' = None, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[None]'
```

Check file information

Retrieve file metadata headers without downloading the file content. Supports conditional requests and provides caching information.

Args:
    id (str): Unique identifier of the file to check
    params (GetFileMetadataHeadersParams): Query and header parameters.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `get_file_presigned_url`

```python
async def get_file_presigned_url(self, id: 'str', *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[PresignedURLResponse]'
```

Retrieve presigned URL to retrieve the file

Retrieve presigned URL to retrieve the file. Expiration of the URL is
determined by bucket configuration


Args:
    id (str): Unique identifier of the file
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PresignedURLResponse]: The HTTP response.

##### `get_version`

```python
async def get_version(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[VersionInformation]'
```

Get service version information

Retrieves build and version information about the storage service. Useful for monitoring and debugging.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[VersionInformation]: The HTTP response.

##### `list_broken_metadata`

```python
async def list_broken_metadata(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[ListBrokenMetadataResponse200]'
```

Lists broken metadata

Broken metadata is defined as metadata that has isUploaded = true but there is no file in the storage matching it. This is an admin operation that requires the Hasura admin secret.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ListBrokenMetadataResponse200]: The HTTP response.

##### `list_files_not_uploaded`

```python
async def list_files_not_uploaded(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[ListFilesNotUploadedResponse200]'
```

Lists files that haven't been uploaded

That is, metadata that has isUploaded = false. This is an admin operation that requires the Hasura admin secret.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ListFilesNotUploadedResponse200]: The HTTP response.

##### `list_orphaned_files`

```python
async def list_orphaned_files(self, *, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[ListOrphanedFilesResponse200]'
```

Lists orphaned files

Orphaned files are files that are present in the storage but have no associated metadata. This is an admin operation that requires the Hasura admin secret.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ListOrphanedFilesResponse200]: The HTTP response.

##### `push_chain_function`

```python
def push_chain_function(self, chain_function: 'ChainFunction') -> 'None'
```

Append a middleware chain function and rebuild the fetch pipeline.

##### `replace_file`

```python
async def replace_file(self, id: 'str', *, body: 'ReplaceFileBody', headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[FileMetadata]'
```

Replace file

Replace an existing file with new content while preserving the file ID. The operation follows these steps:
1. The isUploaded flag is set to false to mark the file as being updated
2. The file content is replaced in the storage backend
3. File metadata is updated (size, mime-type, isUploaded, etc.)

Each step is atomic, but if a step fails, previous steps will not be automatically rolled back.


Args:
    id (str): Unique identifier of the file to replace
    body (ReplaceFileBody): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[FileMetadata]: The HTTP response.

##### `upload_files`

```python
async def upload_files(self, *, body: 'UploadFilesBody', headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[UploadFilesResponse201]'
```

Upload files

Upload one or more files to a specified bucket. Supports batch uploading with optional custom metadata for each file. If uploading multiple files, either provide metadata for all files or none.

Args:
    body (UploadFilesBody): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[UploadFilesResponse201]: The HTTP response.

### `DeleteBrokenMetadataResponse200`

```python
class DeleteBrokenMetadataResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] \| None` |

### `DeleteOrphanedFilesResponse200`

```python
class DeleteOrphanedFilesResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `files` | `list[str] \| None` |

### `ErrorResponse`

```python
class ErrorResponse
```

Error information returned by the API.

#### Fields

| Field | Type |
| --- | --- |
| `error` | `ErrorResponseError \| None` |

### `ErrorResponseError`

```python
class ErrorResponseError
```

Error details.

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `data` | `dict[str, Any] \| None` |

### `ErrorResponseWithProcessedFiles`

```python
class ErrorResponseWithProcessedFiles
```

Error information returned by the API.

#### Fields

| Field | Type |
| --- | --- |
| `processed_files` | `list[FileMetadata] \| None` |
| `error` | `ErrorResponseWithProcessedFilesError \| None` |

### `ErrorResponseWithProcessedFilesError`

```python
class ErrorResponseWithProcessedFilesError
```

Error details.

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `data` | `dict[str, Any] \| None` |

### `FileMetadata`

```python
class FileMetadata
```

Comprehensive metadata information about a file in storage.

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `name` | `str` |
| `size` | `int` |
| `bucket_id` | `str` |
| `etag` | `str` |
| `created_at` | `datetime` |
| `updated_at` | `datetime` |
| `is_uploaded` | `bool` |
| `mime_type` | `str` |
| `uploaded_by_user_id` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |

### `FileSummary`

```python
class FileSummary
```

Basic information about a file in storage.

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
| `q` | `int \| None` |
| `h` | `int \| None` |
| `w` | `int \| None` |
| `b` | `float \| None` |
| `f` | `OutputImageFormat \| None` |
| `if_match` | `str \| None` |
| `if_none_match` | `str \| None` |
| `if_modified_since` | `str \| None` |
| `if_unmodified_since` | `str \| None` |

### `GetFileParams`

```python
class GetFileParams
```

#### Fields

| Field | Type |
| --- | --- |
| `q` | `int \| None` |
| `h` | `int \| None` |
| `w` | `int \| None` |
| `b` | `float \| None` |
| `f` | `OutputImageFormat \| None` |
| `if_match` | `str \| None` |
| `if_none_match` | `str \| None` |
| `if_modified_since` | `str \| None` |
| `if_unmodified_since` | `str \| None` |
| `range` | `str \| None` |

### `ListBrokenMetadataResponse200`

```python
class ListBrokenMetadataResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] \| None` |

### `ListFilesNotUploadedResponse200`

```python
class ListFilesNotUploadedResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `metadata` | `list[FileSummary] \| None` |

### `ListOrphanedFilesResponse200`

```python
class ListOrphanedFilesResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `files` | `list[str] \| None` |

### `PresignedURLResponse`

```python
class PresignedURLResponse
```

Contains a presigned URL for direct file operations.

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
| `metadata` | `UpdateFileMetadata \| None` |
| `file` | `bytes \| UploadFile \| None` |

### `StorageClient`

```python
class StorageClient
```

Generated Storage API plus stable, idiomatic convenience operations.

#### Methods

##### `add_middleware`

```python
def add_middleware(self, middleware: 'ChainFunction') -> 'None'
```

Append HTTP middleware to the Storage request pipeline.

##### `replace_file_content`

```python
async def replace_file_content(self, file_id: 'str', *, file: 'bytes | UploadFile', metadata: 'dict[str, object] | None' = None, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[FileMetadata]'
```

Replace a file while preserving its identifier.

##### `upload`

```python
async def upload(self, files: 'Sequence[bytes | UploadFile]', *, bucket_id: 'str | None' = None, metadata: 'Sequence[UploadFileMetadata] | None' = None, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[UploadFilesResponse201]'
```

Upload one or more files without constructing a wire-shaped body.

### `UpdateFileMetadata`

```python
class UpdateFileMetadata
```

Metadata that can be updated for an existing file.

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |

### `UploadFileMetadata`

```python
class UploadFileMetadata
```

Metadata provided when uploading a new file.

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str \| None` |
| `name` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |

### `UploadFilesBody`

```python
class UploadFilesBody
```

#### Fields

| Field | Type |
| --- | --- |
| `bucket_id` | `str \| None` |
| `metadata` | `list[UploadFileMetadata] \| None` |
| `file` | `list[bytes \| UploadFile]` |

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

Contains version information about the storage service.

#### Fields

| Field | Type |
| --- | --- |
| `build_version` | `str` |
