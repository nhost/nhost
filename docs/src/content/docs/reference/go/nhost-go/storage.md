---
title: Storage
---

## Types

### `Client`

```go
type Client struct {
	BaseURL    string
	httpClient *http.Client
}
```

Client is a generated API client backed by an *http.Client. Install request
middleware (session refresh, token attachment, ...) via the client's
Transport; see transport.NewHTTPClient.

#### `NewClient`

```go
func NewClient(baseURL string, httpClient *http.Client) *Client
```

NewClient creates a new API client. A nil httpClient uses a default
*http.Client; supply one whose Transport carries the desired middleware.

#### `DeleteBrokenMetadata`

```go
func (c *Client) DeleteBrokenMetadata(
	ctx context.Context,
	headers http.Header,
) (DeleteBrokenMetadataResponse200, *transport.Response, error)
```

DeleteBrokenMetadata performs POST /ops/delete-broken-metadata. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `DeleteFile`

```go
func (c *Client) DeleteFile(
	ctx context.Context,
	id string,
	headers http.Header,
) (json.RawMessage, *transport.Response, error)
```

DeleteFile performs DELETE /files/%s. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `DeleteOrphanedFiles`

```go
func (c *Client) DeleteOrphanedFiles(
	ctx context.Context,
	headers http.Header,
) (DeleteOrphanedFilesResponse200, *transport.Response, error)
```

DeleteOrphanedFiles performs POST /ops/delete-orphans. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `GetFile`

```go
func (c *Client) GetFile(
	ctx context.Context,
	id string,
	params *GetFileParams,
	headers http.Header,
) ([]byte, *transport.Response, error)
```

GetFile performs GET /files/%s. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `GetFileMetadataHeaders`

```go
func (c *Client) GetFileMetadataHeaders(
	ctx context.Context,
	id string,
	params *GetFileMetadataHeadersParams,
	headers http.Header,
) (json.RawMessage, *transport.Response, error)
```

GetFileMetadataHeaders performs HEAD /files/%s. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `GetFilePresignedURL`

```go
func (c *Client) GetFilePresignedURL(
	ctx context.Context,
	id string,
	headers http.Header,
) (PresignedURLResponse, *transport.Response, error)
```

GetFilePresignedURL performs GET /files/%s/presignedurl. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `GetVersion`

```go
func (c *Client) GetVersion(
	ctx context.Context,
	headers http.Header,
) (VersionInformation, *transport.Response, error)
```

GetVersion performs GET /version. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `ListBrokenMetadata`

```go
func (c *Client) ListBrokenMetadata(
	ctx context.Context,
	headers http.Header,
) (ListBrokenMetadataResponse200, *transport.Response, error)
```

ListBrokenMetadata performs POST /ops/list-broken-metadata. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `ListFilesNotUploaded`

```go
func (c *Client) ListFilesNotUploaded(
	ctx context.Context,
	headers http.Header,
) (ListFilesNotUploadedResponse200, *transport.Response, error)
```

ListFilesNotUploaded performs POST /ops/list-not-uploaded. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `ListOrphanedFiles`

```go
func (c *Client) ListOrphanedFiles(
	ctx context.Context,
	headers http.Header,
) (ListOrphanedFilesResponse200, *transport.Response, error)
```

ListOrphanedFiles performs POST /ops/list-orphans. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `ReplaceFile`

```go
func (c *Client) ReplaceFile(
	ctx context.Context,
	id string,
	body ReplaceFileBody,
	headers http.Header,
) (FileMetadata, *transport.Response, error)
```

ReplaceFile performs PUT /files/%s. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

#### `UploadFiles`

```go
func (c *Client) UploadFiles(
	ctx context.Context,
	body UploadFilesBody,
	headers http.Header,
) (UploadFilesResponse201, *transport.Response, error)
```

UploadFiles performs POST /files. It returns the decoded body,
the HTTP response metadata, and a *transport.APIError for non-2xx/3xx
responses.

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

