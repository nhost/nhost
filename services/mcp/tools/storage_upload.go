package tools

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"

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
	server.AddTool(mcp.NewTool(
		"storage-upload",
		mcp.WithDescription(
			"Upload files or images to the connected storage service (POST /files). "+
				"Supports batch uploads, bucket selection, custom IDs, names and JSON metadata. "+
				"Supply file bytes as base64; storage detects MIME types from the bytes. "+
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
	server.AddTool(mcp.NewTool(
		"storage-update",
		mcp.WithDescription(
			"Replace a stored file or image with base64-encoded content while preserving its ID (PUT /files/{id}). "+
				"Supports an optional replacement name and custom JSON metadata. "+
				"Returns HTTP status, headers and the complete storage response. "+
				"Replacement is not atomic and failures may leave intermediate changes; "+
				"metadata follows storage replacement semantics, not patch semantics.",
		),
		storageAnnotation("Replace Storage File", false, true, false),
		mcp.WithInputSchema[storageUpdateRequest](),
	), mcp.NewTypedToolHandler(t.handleUpdate))
}

func writeStorageFile(writer *multipart.Writer, field string, file storageFile) error {
	if file.Name == "" {
		return errStorageFilename
	}

	data, err := base64.StdEncoding.DecodeString(file.Data)
	if err != nil {
		return fmt.Errorf("decoding file %q as base64: %w", file.Name, err)
	}

	contentType := file.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if _, _, err := mime.ParseMediaType(contentType); err != nil {
		return fmt.Errorf("parsing content type for file %q: %w", file.Name, err)
	}

	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {mime.FormatMediaType("form-data", map[string]string{
			"name": field, "filename": file.Name,
		})},
		"Content-Type": {contentType},
	})
	if err != nil {
		return fmt.Errorf("creating multipart file: %w", err)
	}

	if _, err := part.Write(data); err != nil {
		return fmt.Errorf("writing multipart file: %w", err)
	}

	return nil
}

func writeStorageMetadata(writer *multipart.Writer, field string, metadata any) error {
	data, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("encoding file metadata: %w", err)
	}

	// Storage reads metadata from form values, not file parts: no filename here.
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {
			mime.FormatMediaType("form-data", map[string]string{"name": field}),
		},
		"Content-Type": {"application/json"},
	})
	if err != nil {
		return fmt.Errorf("creating metadata part: %w", err)
	}

	if _, err := part.Write(data); err != nil {
		return fmt.Errorf("writing metadata part: %w", err)
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

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if args.BucketID != nil {
		if err := writer.WriteField("bucket-id", *args.BucketID); err != nil {
			return mcp.NewToolResultErrorFromErr("writing bucket ID", err), nil
		}
	}

	for i, file := range args.Files {
		if err := writeStorageFile(writer, "file[]", file); err != nil {
			return mcp.NewToolResultErrorFromErr("preparing upload", err), nil
		}

		if len(args.Metadata) != 0 {
			if err := writeStorageMetadata(writer, "metadata[]", args.Metadata[i]); err != nil {
				return mcp.NewToolResultErrorFromErr("preparing upload metadata", err), nil
			}
		}
	}

	if err := writer.Close(); err != nil {
		return mcp.NewToolResultErrorFromErr("closing upload multipart body", err), nil
	}

	return t.call(ctx, http.MethodPost, "/files", nil,
		http.Header{"Content-Type": {writer.FormDataContentType()}}, body, false)
}

func (t *storageTool) handleUpdate(
	ctx context.Context, _ mcp.CallToolRequest, args storageUpdateRequest,
) (*mcp.CallToolResult, error) {
	path, err := storageFilePath(args.ID)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("invalid file ID", err), nil
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if err := writeStorageFile(writer, "file", args.File); err != nil {
		return mcp.NewToolResultErrorFromErr("preparing replacement", err), nil
	}

	if args.Metadata != nil {
		if err := writeStorageMetadata(writer, "metadata", args.Metadata); err != nil {
			return mcp.NewToolResultErrorFromErr("preparing replacement metadata", err), nil
		}
	}

	if err := writer.Close(); err != nil {
		return mcp.NewToolResultErrorFromErr("closing replacement multipart body", err), nil
	}

	return t.call(ctx, http.MethodPut, path, nil,
		http.Header{"Content-Type": {writer.FormDataContentType()}}, body, false)
}
