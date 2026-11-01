package tools

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

// HTTPClient performs requests to the configured storage service.
//
//go:generate mockgen -package mock -destination mock/http_client.go . HTTPClient
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// Base64 and MCP response serialization keep several copies of each transfer live.
// Leave headroom for concurrent requests in the default 256 MiB deployment.
const maxStorageTransferBytes = 4 << 20

type storageTool struct {
	endpoint string
	client   HTTPClient
}

type storageResponse struct {
	StatusCode int         `json:"statusCode"`
	Headers    http.Header `json:"headers"`
	Body       any         `json:"body,omitempty"`
	Data       *string     `json:"data,omitempty"`
}

var (
	errStorageURL = errors.New(
		"storage-url must be an absolute HTTP(S) URL without credentials, query or fragment",
	)
	errStorageFileID   = errors.New("id must be a nonempty file ID, not a path")
	errStorageFilename = errors.New("file name is required")
	errStorageSize     = errors.New("storage transfer exceeds size limit")
)

// RegisterStorage registers upload, download, update and delete tools for a
// storage service URL (including its API prefix, normally /v1).
func RegisterStorage(server *mcpserver.MCPServer, endpoint string) error {
	u, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("parsing storage-url: %w", err)
	}

	if (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" ||
		u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return errStorageURL
	}

	const timeout = 5 * time.Minute

	t := &storageTool{
		endpoint: strings.TrimRight(u.String(), "/"),
		client: &http.Client{ //nolint:exhaustruct // Keep the standard transport and cookie behavior.
			Timeout: timeout,
			// Never redirect a credential-bearing request away from the configured service.
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
	t.registerUpload(server)
	t.registerDownload(server)
	t.registerUpdate(server)
	t.registerDelete(server)

	return nil
}

func storageAnnotation(title string, readOnly, destructive, idempotent bool) mcp.ToolOption {
	return mcp.WithToolAnnotation(mcp.ToolAnnotation{
		Title:           title,
		ReadOnlyHint:    new(readOnly),
		DestructiveHint: new(destructive),
		IdempotentHint:  new(idempotent),
		OpenWorldHint:   new(true),
	})
}

func storageFilePath(id string) (string, error) {
	if id == "" || id == "." || id == ".." || strings.ContainsAny(id, "/\\") {
		return "", errStorageFileID
	}

	return "/files/" + url.PathEscape(id), nil
}

func (t *storageTool) call(
	ctx context.Context,
	method, path string,
	query url.Values,
	headers http.Header,
	body io.Reader,
	download bool,
) (*mcp.CallToolResult, error) {
	endpoint := t.endpoint + path
	if len(query) != 0 {
		endpoint += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("creating storage request", err), nil
	}

	if headers != nil {
		req.Header = headers.Clone()
	}

	if err := authorizationInterceptor(ctx, req); err != nil {
		return mcp.NewToolResultErrorFromErr("authorizing storage request", err), nil
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("calling storage service", err), nil
	}
	defer resp.Body.Close()

	if resp.ContentLength > maxStorageTransferBytes {
		return storageSizeError(resp, download), nil
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxStorageTransferBytes+1))
	if err != nil {
		return mcp.NewToolResultErrorFromErr("reading storage response", err), nil
	}

	if len(data) > maxStorageTransferBytes {
		return storageSizeError(resp, download), nil
	}

	return storageResult(resp, data, download), nil
}

func storageSizeError(resp *http.Response, download bool) *mcp.CallToolResult {
	message := fmt.Sprintf(
		"Storage response exceeds the %d-byte MCP transfer limit.",
		maxStorageTransferBytes,
	)
	if download {
		message += fmt.Sprintf(
			" Retry with range (e.g. bytes=0-%d) and download in chunks. "+
				"Omit transformations, since storage ignores range when transforming images.",
			maxStorageTransferBytes-1,
		)
	}

	result := mcp.NewToolResultStructuredOnly(storageResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       message,
		Data:       nil,
	})
	result.IsError = true

	return result
}

func storageResult(resp *http.Response, data []byte, download bool) *mcp.CallToolResult {
	response := storageResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       nil,
		Data:       nil,
	}
	isError := (resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices) &&
		resp.StatusCode != http.StatusNotModified

	// Partial ranges are not necessarily decodable images; retain them as base64 only.
	isImage := download && resp.StatusCode == http.StatusOK && len(data) != 0 &&
		strings.HasPrefix(resp.Header.Get("Content-Type"), "image/")
	if download && !isImage {
		response.Data = new(base64.StdEncoding.EncodeToString(data))
	}

	if len(data) != 0 && (!download || isError) {
		if json.Valid(data) {
			response.Body = json.RawMessage(data)
		} else {
			response.Body = string(data)
		}
	}

	result := mcp.NewToolResultStructuredOnly(response)
	result.IsError = isError

	if isImage {
		result.Content = append(result.Content, mcp.NewImageContent(
			base64.StdEncoding.EncodeToString(
				data,
			),
			strings.Split(resp.Header.Get("Content-Type"), ";")[0],
		))
	}

	return result
}

type storageIDRequest struct {
	ID string `json:"id" jsonschema:"description=ID of the stored file"`
}

func (t *storageTool) registerDelete(server *mcpserver.MCPServer) {
	server.AddTool(mcp.NewTool(
		"storage-delete",
		mcp.WithDescription(
			"Permanently delete a file or image and its metadata from the connected storage service "+
				"(DELETE /files/{id}). Returns the HTTP status and response headers/body.",
		),
		storageAnnotation("Delete Storage File", false, true, true),
		mcp.WithInputSchema[storageIDRequest](),
	), mcp.NewTypedToolHandler(t.handleDelete))
}

func (t *storageTool) handleDelete(
	ctx context.Context, _ mcp.CallToolRequest, args storageIDRequest,
) (*mcp.CallToolResult, error) {
	path, err := storageFilePath(args.ID)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("invalid file ID", err), nil
	}

	return t.call(ctx, http.MethodDelete, path, nil, nil, nil, false)
}
