package tools

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/textproto"
	"strings"
)

type storageMultipartBody struct {
	io.Reader

	contentType   string
	contentLength int64
}

type storageMultipartBuilder struct {
	writer        *multipart.Writer
	buffer        *bytes.Buffer
	parts         []io.Reader
	contentLength int64
}

func storageFileHeader(field string, file storageFile) (textproto.MIMEHeader, int64, error) {
	if file.Name == "" {
		return nil, 0, errStorageFilename
	}

	contentType := file.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if _, _, err := mime.ParseMediaType(contentType); err != nil {
		return nil, 0, fmt.Errorf("parsing content type for file %q: %w", file.Name, err)
	}

	// Validate without retaining decoded bytes, before any storage request can mutate a batch.
	size, err := io.Copy(
		io.Discard,
		base64.NewDecoder(base64.StdEncoding, strings.NewReader(file.Data)),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("decoding file %q as base64: %w", file.Name, err)
	}

	return textproto.MIMEHeader{
		"Content-Disposition": {mime.FormatMediaType("form-data", map[string]string{
			"name": field, "filename": file.Name,
		})},
		"Content-Type": {contentType},
	}, size, nil
}

func (b *storageMultipartBuilder) flush() {
	control := b.buffer.String()
	b.parts = append(b.parts, strings.NewReader(control))
	b.contentLength += int64(len(control))
	b.buffer.Reset()
}

func (b *storageMultipartBuilder) file(field string, file storageFile) error {
	header, size, err := storageFileHeader(field, file)
	if err != nil {
		return fmt.Errorf("validating multipart file: %w", err)
	}

	if _, err := b.writer.CreatePart(header); err != nil {
		return fmt.Errorf("creating multipart file: %w", err)
	}

	b.flush()
	b.parts = append(b.parts, base64.NewDecoder(base64.StdEncoding, strings.NewReader(file.Data)))
	b.contentLength += size

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

func newStorageMultipart(
	files []storageFile, metadata []any, bucketID *string, batch bool,
) (*storageMultipartBody, error) {
	buffer := &bytes.Buffer{}
	builder := storageMultipartBuilder{
		writer:        multipart.NewWriter(buffer),
		buffer:        buffer,
		parts:         nil,
		contentLength: 0,
	}

	if bucketID != nil {
		if err := builder.writer.WriteField("bucket-id", *bucketID); err != nil {
			return nil, fmt.Errorf("writing bucket ID: %w", err)
		}
	}

	fileField, metadataField := "file", "metadata"
	if batch {
		fileField, metadataField = "file[]", "metadata[]"
	}

	for i, file := range files {
		if err := builder.file(fileField, file); err != nil {
			return nil, fmt.Errorf("preparing file %d: %w", i, err)
		}

		if len(metadata) != 0 {
			if err := writeStorageMetadata(builder.writer, metadataField, metadata[i]); err != nil {
				return nil, fmt.Errorf("preparing metadata %d: %w", i, err)
			}
		}
	}

	if err := builder.writer.Close(); err != nil {
		return nil, fmt.Errorf("closing multipart body: %w", err)
	}

	builder.flush()

	return &storageMultipartBody{
		Reader:        io.MultiReader(builder.parts...),
		contentType:   builder.writer.FormDataContentType(),
		contentLength: builder.contentLength,
	}, nil
}
