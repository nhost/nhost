package tools

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

type storageDownloadRequest struct {
	ID string `json:"id" jsonschema:"Stored file ID"`

	Q *int `json:"q,omitempty" jsonschema:"Image quality"`

	H *int `json:"h,omitempty" jsonschema:"Max height in pixels; preserves aspect ratio"`

	W *int `json:"w,omitempty" jsonschema:"Max width in pixels; preserves aspect ratio"`

	B *float64 `json:"b,omitempty" jsonschema:"Blur sigma"`

	F string `json:"f,omitempty" jsonschema:"Output image format"`

	Accept string `json:"accept,omitempty" jsonschema:"Accept header for f=auto (e.g. image/webp)"`

	Range string `json:"range,omitempty" jsonschema:"Range header (e.g. bytes=0-1023)"`

	IfMatch string `json:"ifMatch,omitempty" jsonschema:"If-Match ETag condition"`

	IfNoneMatch string `json:"ifNoneMatch,omitempty" jsonschema:"If-None-Match ETag condition"`

	IfModifiedSince string `json:"ifModifiedSince,omitempty" jsonschema:"If-Modified-Since HTTP date"`

	IfUnmodifiedSince string `json:"ifUnmodifiedSince,omitempty" jsonschema:"If-Unmodified-Since HTTP date"`
}

func storageDownloadInputSchema() (mcp.ToolOption, error) {
	const maxImageQuality = 100.0

	return constrainedStorageInputSchema[storageDownloadRequest](
		func(props map[string]*jsonschema.Schema) {
			props["q"].Minimum = new(1.0)
			props["q"].Maximum = new(maxImageQuality)
			props["h"].Minimum = new(1.0)
			props["w"].Minimum = new(1.0)
			props["b"].Minimum = new(0.0)
			props["f"].Enum = []any{"auto", "same", "jpeg", "webp", "png", "avif", "heic"}
		},
	)
}

func (t *storageTool) registerDownload(server *mcpserver.MCPServer, schema mcp.ToolOption) {
	limit := fmt.Sprintf("Responses are limited to %d bytes; ", t.maxTransferBytes)
	server.AddTool(mcp.NewTool(
		"storage-download",
		mcp.WithDescription(
			"Download a file or image from the connected storage service (GET /files/{id}). "+
				"Supports image transformations (q/h/w/b/f), Accept format negotiation (accept), "+
				"ETag/date conditions and byte ranges. Storage ignores ranges when transformations are requested. "+
				"Returns HTTP status and response headers (including ETag, caching and Content-Range). "+
				"Complete images carry bytes only in MCP image content; other downloads return base64 data. "+
				limit+
				"use range to download larger files in chunks, without transformations. A 304 is a successful bodyless result; "+
				"a 412 is a precondition failure with headers preserved.",
		),
		storageAnnotation("Download Storage File", true, false, true),
		schema,
	), mcp.NewTypedToolHandler(t.handleDownload))
}

func (t *storageTool) handleDownload(
	ctx context.Context, _ mcp.CallToolRequest, args storageDownloadRequest,
) (*mcp.CallToolResult, error) {
	path, err := storageFilePath(args.ID)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("invalid file ID", err), nil
	}

	query := url.Values{}
	for key, value := range map[string]*int{"q": args.Q, "h": args.H, "w": args.W} {
		if value != nil {
			query.Set(key, strconv.Itoa(*value))
		}
	}

	if args.B != nil {
		query.Set("b", strconv.FormatFloat(*args.B, 'g', -1, 64))
	}

	if args.F != "" {
		query.Set("f", args.F)
	}

	headers := http.Header{}
	for name, value := range map[string]string{
		"Accept":              args.Accept,
		"Range":               args.Range,
		"If-Match":            args.IfMatch,
		"If-None-Match":       args.IfNoneMatch,
		"If-Modified-Since":   args.IfModifiedSince,
		"If-Unmodified-Since": args.IfUnmodifiedSince,
	} {
		if value != "" {
			headers.Set(name, value)
		}
	}

	return t.call(ctx, http.MethodGet, path, query, headers, nil, true)
}
