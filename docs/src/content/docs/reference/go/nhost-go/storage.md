---
title: Storage
---

## Types

### `Client`

```go
type Client struct {
	BaseURL        string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}
```

Client is a generated API client backed by an *http.Client and a middleware chain.

#### `NewClient`

```go
func NewClient(
	baseURL string,
	chainFunctions []fetch.ChainFunction,
	httpClient *http.Client,
) *Client
```

NewClient creates a new API client.

#### `DeleteBrokenMetadata`

```go
func (c *Client) DeleteBrokenMetadata(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[DeleteBrokenMetadataResponse200], error)
```

DeleteBrokenMetadata performs POST /ops/delete-broken-metadata.

#### `DeleteFile`

```go
func (c *Client) DeleteFile(
	ctx context.Context,
	id string,
	headers http.Header,
) (*fetch.FetchResponse[json.RawMessage], error)
```

DeleteFile performs DELETE /files/%s.

#### `DeleteOrphanedFiles`

```go
func (c *Client) DeleteOrphanedFiles(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[DeleteOrphanedFilesResponse200], error)
```

DeleteOrphanedFiles performs POST /ops/delete-orphans.

#### `GetFile`

```go
func (c *Client) GetFile(
	ctx context.Context,
	id string,
	params *GetFileParams,
	headers http.Header,
) (*fetch.FetchResponse[[]byte], error)
```

GetFile performs GET /files/%s.

#### `GetFileMetadataHeaders`

```go
func (c *Client) GetFileMetadataHeaders(
	ctx context.Context,
	id string,
	params *GetFileMetadataHeadersParams,
	headers http.Header,
) (*fetch.FetchResponse[json.RawMessage], error)
```

GetFileMetadataHeaders performs HEAD /files/%s.

#### `GetFilePresignedURL`

```go
func (c *Client) GetFilePresignedURL(
	ctx context.Context,
	id string,
	headers http.Header,
) (*fetch.FetchResponse[PresignedURLResponse], error)
```

GetFilePresignedURL performs GET /files/%s/presignedurl.

#### `GetVersion`

```go
func (c *Client) GetVersion(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[VersionInformation], error)
```

GetVersion performs GET /version.

#### `ListBrokenMetadata`

```go
func (c *Client) ListBrokenMetadata(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[ListBrokenMetadataResponse200], error)
```

ListBrokenMetadata performs POST /ops/list-broken-metadata.

#### `ListFilesNotUploaded`

```go
func (c *Client) ListFilesNotUploaded(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[ListFilesNotUploadedResponse200], error)
```

ListFilesNotUploaded performs POST /ops/list-not-uploaded.

#### `ListOrphanedFiles`

```go
func (c *Client) ListOrphanedFiles(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[ListOrphanedFilesResponse200], error)
```

ListOrphanedFiles performs POST /ops/list-orphans.

#### `PushChainFunction`

```go
func (c *Client) PushChainFunction(cf fetch.ChainFunction)
```

PushChainFunction appends a middleware chain function and rebuilds the pipeline.

#### `ReplaceFile`

```go
func (c *Client) ReplaceFile(
	ctx context.Context,
	id string,
	body ReplaceFileBody,
	headers http.Header,
) (*fetch.FetchResponse[FileMetadata], error)
```

ReplaceFile performs PUT /files/%s.

#### `UploadFiles`

```go
func (c *Client) UploadFiles(
	ctx context.Context,
	body UploadFilesBody,
	headers http.Header,
) (*fetch.FetchResponse[UploadFilesResponse201], error)
```

UploadFiles performs POST /files.

### `DeleteBrokenMetadataResponse200`

```go
type DeleteBrokenMetadataResponse200 struct {
	Metadata *[]FileSummary `json:"metadata,omitempty"`
}
```

### `DeleteOrphanedFilesResponse200`

```go
type DeleteOrphanedFilesResponse200 struct {
	Files *[]string `json:"files,omitempty"`
}
```

### `ErrorResponse`

```go
type ErrorResponse struct {
	Error *ErrorResponseError `json:"error,omitempty"`
}
```

### `ErrorResponseError`

```go
type ErrorResponseError struct {
	Message string          `json:"message"`
	Data    *map[string]any `json:"data,omitempty"`
}
```

### `ErrorResponseWithProcessedFiles`

```go
type ErrorResponseWithProcessedFiles struct {
	ProcessedFiles *[]FileMetadata                       `json:"processedFiles,omitempty"`
	Error          *ErrorResponseWithProcessedFilesError `json:"error,omitempty"`
}
```

### `ErrorResponseWithProcessedFilesError`

```go
type ErrorResponseWithProcessedFilesError struct {
	Message string          `json:"message"`
	Data    *map[string]any `json:"data,omitempty"`
}
```

### `FileMetadata`

```go
type FileMetadata struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Size             int             `json:"size"`
	BucketID         string          `json:"bucketId"`
	Etag             string          `json:"etag"`
	CreatedAt        string          `json:"createdAt"`
	UpdatedAt        string          `json:"updatedAt"`
	IsUploaded       bool            `json:"isUploaded"`
	MimeType         string          `json:"mimeType"`
	UploadedByUserID *string         `json:"uploadedByUserId,omitempty"`
	Metadata         *map[string]any `json:"metadata,omitempty"`
}
```

### `FileSummary`

```go
type FileSummary struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	BucketID   string `json:"bucketId"`
	IsUploaded bool   `json:"isUploaded"`
}
```

### `GetFileMetadataHeadersParams`

```go
type GetFileMetadataHeadersParams struct {
	Q *int               `json:"q,omitempty"`
	H *int               `json:"h,omitempty"`
	W *int               `json:"w,omitempty"`
	B *float64           `json:"b,omitempty"`
	F *OutputImageFormat `json:"f,omitempty"`
}
```

#### `toQuery`

```go
func (p *GetFileMetadataHeadersParams) toQuery() url.Values
```

### `GetFileParams`

```go
type GetFileParams struct {
	Q *int               `json:"q,omitempty"`
	H *int               `json:"h,omitempty"`
	W *int               `json:"w,omitempty"`
	B *float64           `json:"b,omitempty"`
	F *OutputImageFormat `json:"f,omitempty"`
}
```

#### `toQuery`

```go
func (p *GetFileParams) toQuery() url.Values
```

### `ListBrokenMetadataResponse200`

```go
type ListBrokenMetadataResponse200 struct {
	Metadata *[]FileSummary `json:"metadata,omitempty"`
}
```

### `ListFilesNotUploadedResponse200`

```go
type ListFilesNotUploadedResponse200 struct {
	Metadata *[]FileSummary `json:"metadata,omitempty"`
}
```

### `ListOrphanedFilesResponse200`

```go
type ListOrphanedFilesResponse200 struct {
	Files *[]string `json:"files,omitempty"`
}
```

### `OutputImageFormat`

```go
type OutputImageFormat string
```

OutputImageFormat is one of: "auto", "same", "jpeg", "webp", "png", "avif", "heic".

### `PresignedURLResponse`

```go
type PresignedURLResponse struct {
	URL        string `json:"url"`
	Expiration int    `json:"expiration"`
}
```

### `ReplaceFileBody`

```go
type ReplaceFileBody struct {
	Metadata *UpdateFileMetadata `json:"metadata,omitempty"`
	File     *[]byte             `json:"file,omitempty"`
}
```

### `Rfc2822Date`

```go
type Rfc2822Date = string
```

### `UpdateFileMetadata`

```go
type UpdateFileMetadata struct {
	Name     *string         `json:"name,omitempty"`
	Metadata *map[string]any `json:"metadata,omitempty"`
}
```

### `UploadFileMetadata`

```go
type UploadFileMetadata struct {
	ID       *string         `json:"id,omitempty"`
	Name     *string         `json:"name,omitempty"`
	Metadata *map[string]any `json:"metadata,omitempty"`
}
```

### `UploadFilesBody`

```go
type UploadFilesBody struct {
	BucketID *string               `json:"bucket-id,omitempty"`
	Metadata *[]UploadFileMetadata `json:"metadata[],omitempty"`
	File     [][]byte              `json:"file[]"`
}
```

### `UploadFilesResponse201`

```go
type UploadFilesResponse201 struct {
	ProcessedFiles []FileMetadata `json:"processedFiles"`
}
```

### `VersionInformation`

```go
type VersionInformation struct {
	BuildVersion string `json:"buildVersion"`
}
```

