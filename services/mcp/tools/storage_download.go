package tools

import (
	"context"
	"net/http"
	"net/url"
	"strconv"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

type storageDownloadRequest struct {
	ID string `json:"id" jsonschema:"description=Stored file ID"`

	Q *int `json:"q,omitempty" jsonschema:"minimum=1,maximum=100,description=Image quality"`

	H *int `json:"h,omitempty" jsonschema:"minimum=1,description=Max height in pixels; preserves aspect ratio"`

	W *int `json:"w,omitempty" jsonschema:"minimum=1,description=Max width in pixels; preserves aspect ratio"`

	B *float64 `json:"b,omitempty" jsonschema:"minimum=0,description=Blur sigma"`

	F string `json:"f,omitempty" jsonschema:"enum=auto,enum=same,enum=jpeg,enum=webp,enum=png,enum=avif,enum=heic"`

	Accept string `json:"accept,omitempty" jsonschema:"description=Accept header for f=auto (e.g. image/webp)"`

	Range string `json:"range,omitempty" jsonschema:"description=Range header (e.g. bytes=0-1023)"`

	IfMatch string `json:"ifMatch,omitempty" jsonschema:"description=If-Match ETag condition"`

	IfNoneMatch string `json:"ifNoneMatch,omitempty" jsonschema:"description=If-None-Match ETag condition"`

	IfModifiedSince string `json:"ifModifiedSince,omitempty" jsonschema:"description=If-Modified-Since HTTP date"`

	IfUnmodifiedSince string `json:"ifUnmodifiedSince,omitempty" jsonschema:"description=If-Unmodified-Since HTTP date"`
}

func (t *storageTool) registerDownload(server *mcpserver.MCPServer) {
	server.AddTool(mcp.NewTool(
		"storage-download",
		mcp.WithDescription(
			"Download a file or image from the connected storage service (GET /files/{id}). "+
				"Supports image transformations (q/h/w/b/f), Accept format negotiation (accept), "+
				"ETag/date conditions and byte ranges. Storage ignores ranges when transformations are requested. "+
				"Returns HTTP status, response headers (including ETag, caching and Content-Range), and base64 data; "+
				"complete images also return MCP image content. A 304 is a successful bodyless result; "+
				"a 412 is a precondition failure with headers preserved.",
		),
		storageAnnotation("Download Storage File", true, false, true),
		mcp.WithInputSchema[storageDownloadRequest](),
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
