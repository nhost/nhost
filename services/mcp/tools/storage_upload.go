package tools

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

type storageFile struct {
	Name string `json:"name" jsonschema:"description=Original filename including extension"`

	Data string `json:"data" jsonschema:"description=Standard base64 file bytes; not a data URL"`

	ContentType string `json:"contentType,omitempty" jsonschema:"description=Optional multipart MIME type"`
}

type storageUploadMetadata struct {
	ID       string          `json:"id,omitempty"`
	Name     string          `json:"name,omitempty"`
	Metadata *map[string]any `json:"metadata,omitempty"`
}

type storageUploadRequest struct {
	Files []storageFile `json:"files" jsonschema:"minItems=1,description=Files in upload order"`

	BucketID *string `json:"bucketId,omitempty" jsonschema:"description=Target bucket; omit for default"`

	Metadata []storageUploadMetadata `json:"metadata,omitempty" jsonschema:"description=One entry per file or omit"`
}

type storageUpdateMetadata struct {
	Name     string          `json:"name,omitempty"`
	Metadata *map[string]any `json:"metadata,omitempty"`
}

type storageUpdateRequest struct {
	ID string `json:"id" jsonschema:"description=File ID to preserve and replace"`

	File storageFile `json:"file"`

	Metadata *storageUpdateMetadata `json:"metadata,omitempty" jsonschema:"description=Replacement metadata"`
}

func (t *storageTool) registerUpload(server *mcpserver.MCPServer) {
	limit := fmt.Sprintf(
		"The decoded files must total at most %d bytes per call; split larger batches. ",
		t.maxTransferBytes,
	)
	server.AddTool(mcp.NewTool(
		"storage-upload",
		mcp.WithDescription(
			"Upload files or images to the connected storage service (POST /files). "+
				"Supports batch uploads, bucket selection, custom IDs, names and JSON metadata. "+
				"Supply file bytes as base64; storage detects MIME types from the bytes. "+
				limit+
				"Omit metadata or provide one entry per file in order (use {} for files without overrides). "+
				"Returns HTTP status, headers and the complete storage response, "+
				"including processedFiles on partial failure. "+
				"Uploads are not atomic; do not blindly retry a failed batch.",
		),
		storageAnnotation("Upload Storage Files", false, false, false),
		mcp.WithInputSchema[storageUploadRequest](),
	), mcp.NewTypedToolHandler(t.handleUpload))
}

func (t *storageTool) registerUpdate(server *mcpserver.MCPServer) {
	limit := fmt.Sprintf(
		"The decoded file must be at most %d bytes; use the storage API directly for larger files. ",
		t.maxTransferBytes,
	)
	server.AddTool(mcp.NewTool(
		"storage-update",
		mcp.WithDescription(
			"Replace a stored file or image with base64-encoded content while preserving its ID (PUT /files/{id}). "+
				"Supports an optional replacement name and custom JSON metadata. "+
				limit+
				"Returns HTTP status, headers and the complete storage response. "+
				"Replacement is not atomic and failures may leave intermediate changes; "+
				"metadata follows storage replacement semantics, not patch semantics.",
		),
		storageAnnotation("Replace Storage File", false, true, false),
		mcp.WithInputSchema[storageUpdateRequest](),
	), mcp.NewTypedToolHandler(t.handleUpdate))
}

func validateStorageUploadSize(files []storageFile, limit int64) error {
	remaining := limit

	for _, file := range files {
		length := len(file.Data) - strings.Count(file.Data, "\r") - strings.Count(file.Data, "\n")
		size := int64(base64.StdEncoding.DecodedLen(length))
		// Base64 accepts CR/LF and padding; neither should reject an exactly-at-limit batch.
		data := strings.TrimRight(file.Data, "\r\n")
		if size > 0 && strings.HasSuffix(data, "=") {
			size--

			data = strings.TrimRight(data[:len(data)-1], "\r\n")
			if strings.HasSuffix(data, "=") {
				size--
			}
		}

		if size > remaining {
			return fmt.Errorf(
				"%w: decoded files must total at most %d bytes; split batches or use the storage API directly",
				errStorageSize,
				limit,
			)
		}

		remaining -= size
	}

	return nil
}

func (t *storageTool) handleUpload(
	ctx context.Context, _ mcp.CallToolRequest, args storageUploadRequest,
) (*mcp.CallToolResult, error) {
	if len(args.Files) == 0 {
		return mcp.NewToolResultError("at least one file is required"), nil
	}

	if len(args.Metadata) != 0 && len(args.Metadata) != len(args.Files) {
		return mcp.NewToolResultError(
			"metadata must have one entry for every file, or be omitted",
		), nil
	}

	if err := validateStorageUploadSize(args.Files, t.maxTransferBytes); err != nil {
		return mcp.NewToolResultErrorFromErr("preparing upload", err), nil
	}

	metadata := make([]any, len(args.Metadata))
	for i := range args.Metadata {
		metadata[i] = args.Metadata[i]
	}

	body, err := newStorageMultipart(args.Files, metadata, args.BucketID, true)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("preparing upload", err), nil
	}

	return t.call(ctx, http.MethodPost, "/files", nil,
		http.Header{"Content-Type": {body.contentType}}, body, false)
}

func (t *storageTool) handleUpdate(
	ctx context.Context, _ mcp.CallToolRequest, args storageUpdateRequest,
) (*mcp.CallToolResult, error) {
	path, err := storageFilePath(args.ID)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("invalid file ID", err), nil
	}

	files := []storageFile{args.File}
	if err := validateStorageUploadSize(files, t.maxTransferBytes); err != nil {
		return mcp.NewToolResultErrorFromErr("preparing replacement", err), nil
	}

	var metadata []any
	if args.Metadata != nil {
		metadata = []any{args.Metadata}
	}

	body, err := newStorageMultipart(files, metadata, nil, false)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("preparing replacement", err), nil
	}

	return t.call(ctx, http.MethodPut, path, nil,
		http.Header{"Content-Type": {body.contentType}}, body, false)
}
