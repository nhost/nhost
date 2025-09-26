package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/textproto"
	"strings"
)

func WithMetadata(metadata UploadFileMetadata) func(file *File) {
	return func(file *File) {
		file.md = &metadata
	}
}

type File struct {
	r    io.ReadSeeker
	name string
	md   *UploadFileMetadata
}

func NewFile(name string, r io.ReadSeeker, metadata *UploadFileMetadata) *File {
	return &File{
		r:    r,
		name: name,
		md:   metadata,
	}
}

func createMultiForm(
	writer *multipart.Writer,
	fieldName string,
	file *File,
	multiple bool,
) error {
	formWriter, err := writer.CreateFormFile(fieldName, file.name)
	if err != nil {
		return fmt.Errorf("problem create part: %w", err)
	}

	_, err = io.Copy(formWriter, file.r)
	if err != nil {
		return fmt.Errorf("problem copying file into the form: %w", err)
	}

	if file.md != nil { //nolint:nestif
		h := make(textproto.MIMEHeader)
		if multiple {
			h.Set("Content-Disposition", `form-data; name="metadata[]"`)
		} else {
			h.Set("Content-Disposition", `form-data; name="metadata"`)
		}

		h.Set("Content-Type", "application/json")

		formWriter, err = writer.CreatePart(h)
		if err != nil {
			return fmt.Errorf("problem creating part for metadata: %w", err)
		}

		b, err := json.Marshal(file.md)
		if err != nil {
			return fmt.Errorf("problem marshaling metadata: %w", err)
		}

		_, err = io.Copy(formWriter, bytes.NewReader(b))
		if err != nil {
			return fmt.Errorf("problem copying metadata into the form: %w", err)
		}
	}

	return nil
}

func CreateUploadMultiForm(
	bucketID string,
	files ...*File,
) (io.Reader, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	formWriter, err := writer.CreateFormField("bucket-id")
	if err != nil {
		return nil, "", fmt.Errorf("problem creating form field for bucket-id: %w", err)
	}

	_, err = io.Copy(formWriter, strings.NewReader(bucketID))
	if err != nil {
		return nil, "", fmt.Errorf("problem writing bucket-id: %w", err)
	}

	for _, file := range files {
		if err := createMultiForm(writer, "file[]", file, true); err != nil {
			return nil, "", fmt.Errorf("problem creating form for file %s: %w", file.name, err)
		}
	}

	writer.Close()

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType(), nil
}

func CreateUpdateMultiForm(
	file *File,
) (io.Reader, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if err := createMultiForm(writer, "file", file, false); err != nil {
		return nil, "", fmt.Errorf("problem creating form for file %s: %w", file.name, err)
	}

	writer.Close()

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType(), nil
}
