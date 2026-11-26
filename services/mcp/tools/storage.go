package tools

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type storageTool struct {
	endpoint         string
	client           httpClient
	maxTransferBytes int64
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
	errStorageFileID = errors.New("id must be a nonempty file ID, not a path")
	errStorageLimit  = errors.New(
		"storage transfer limit must be positive and less than MaxInt64",
	)
)

// RegisterStorage registers the read-only download tool for a storage service URL
// (including its API prefix, normally /v1). maxTransferBytes bounds upstream response bodies.
func RegisterStorage(server *mcpserver.MCPServer, endpoint string, maxTransferBytes int64) error {
	if maxTransferBytes <= 0 || maxTransferBytes == math.MaxInt64 {
		return errStorageLimit
	}

	u, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("parsing storage-url: %w", err)
	}

	if (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" ||
		u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return errStorageURL
	}

	downloadSchema, err := storageDownloadInputSchema()
	if err != nil {
		return fmt.Errorf("building storage-download schema: %w", err)
	}

	const timeout = 5 * time.Minute

	t := &storageTool{
		endpoint:         strings.TrimRight(u.String(), "/"),
		maxTransferBytes: maxTransferBytes,
		client: &http.Client{ //nolint:exhaustruct // Keep the standard transport and cookie behavior.
			Timeout: timeout,
			// Never redirect a credential-bearing request away from the configured service.
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}

	registerStoragePreview(server)
	t.registerDownload(server, downloadSchema)

	return nil
}

func storageFilePath(id string) (string, error) {
	if id == "" || id == "." || id == ".." || strings.ContainsAny(id, "/\\") {
		return "", errStorageFileID
	}

	return "/files/" + url.PathEscape(id), nil
}

func (t *storageTool) fetchDownload(
	ctx context.Context,
	path string,
	query url.Values,
	headers http.Header,
) (*mcp.CallToolResult, error) {
	endpoint := t.endpoint + path
	if len(query) != 0 {
		endpoint += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
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

	if resp.ContentLength > t.maxTransferBytes {
		return t.storageSizeError(resp), nil
	}

	if (resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices) ||
		resp.StatusCode == http.StatusNotModified {
		return t.downloadResult(resp), nil
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, t.maxTransferBytes+1))
	if err != nil {
		return mcp.NewToolResultErrorFromErr("reading storage response", err), nil
	}

	if int64(len(data)) > t.maxTransferBytes {
		return t.storageSizeError(resp), nil
	}

	return storageDownloadError(resp, data), nil
}

func (t *storageTool) storageSizeError(resp *http.Response) *mcp.CallToolResult {
	message := fmt.Sprintf(
		"Storage response exceeds the %d-byte MCP transfer limit. "+
			"Retry with range (e.g. bytes=0-%d) and download in chunks. "+
			"Omit transformations, since storage ignores range when transforming images.",
		t.maxTransferBytes, t.maxTransferBytes-1,
	)

	result := mcp.NewToolResultStructuredOnly(storageResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       message,
		Data:       nil,
	})
	result.IsError = true

	return result
}

func storageDownloadError(resp *http.Response, data []byte) *mcp.CallToolResult {
	response := storageResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       nil,
		Data:       new(base64.StdEncoding.EncodeToString(data)),
	}

	if len(data) != 0 {
		if json.Valid(data) {
			response.Body = json.RawMessage(data)
		} else {
			response.Body = string(data)
		}
	}

	result := mcp.NewToolResultStructuredOnly(response)
	result.IsError = true

	return result
}

func (t *storageTool) downloadResult(resp *http.Response) *mcp.CallToolResult {
	const maxPreallocationBytes = math.MaxInt / 4

	var encoded strings.Builder
	if resp.ContentLength > 0 && resp.ContentLength <= int64(maxPreallocationBytes) {
		encoded.Grow(base64.StdEncoding.EncodedLen(int(resp.ContentLength)))
	}

	encoder := base64.NewEncoder(base64.StdEncoding, &encoded)

	size, err := io.Copy(encoder, io.LimitReader(resp.Body, t.maxTransferBytes+1))
	if err != nil {
		return mcp.NewToolResultErrorFromErr("reading storage response", err)
	}

	if err := encoder.Close(); err != nil {
		return mcp.NewToolResultErrorFromErr("encoding storage response", err)
	}

	if size > t.maxTransferBytes {
		return t.storageSizeError(resp)
	}

	response := storageResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       nil,
		Data:       nil,
	}
	// Partial ranges are not necessarily decodable images; retain them as base64 only.
	isImage := resp.StatusCode == http.StatusOK && size != 0 &&
		strings.HasPrefix(resp.Header.Get("Content-Type"), "image/")
	if !isImage {
		response.Data = new(encoded.String())
	}

	result := mcp.NewToolResultStructuredOnly(response)
	if isImage {
		result.Content = append(result.Content, mcp.NewImageContent(
			encoded.String(), strings.Split(resp.Header.Get("Content-Type"), ";")[0],
		))
	}

	return result
}
