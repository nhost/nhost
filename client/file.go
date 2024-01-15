package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/textproto"
)

type fileOptions func(file *File)

func WithUUID(id string) func(file *File) {
	return func(file *File) {
		file.md.ID = id
	}
}

func WithMetadata(metdata map[string]any) func(file *File) {
	return func(file *File) {
		file.md.Metadata = metdata
	}
}

type fileMetadata struct {
	Name     string         `json:"name,omitempty"`
	ID       string         `json:"id,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type File struct {
	r  io.ReadSeeker
	md fileMetadata
}

func NewFile(name string, r io.ReadSeeker, opts ...fileOptions) *File {
	file := &File{
		r: r,
		md: fileMetadata{
			Name: name,
		},
	}
	for _, o := range opts {
		o(file)
	}
	return file
}

func CreateMultiFormFile(
	writer *multipart.Writer,
	fieldName string,
	file *File,
	multiple bool,
) error {
	formWriter, err := writer.CreateFormFile(fieldName, file.md.Name)
	if err != nil {
		return fmt.Errorf("problem create part: %w", err)
	}

	_, err = io.Copy(formWriter, file.r)
	if err != nil {
		return fmt.Errorf("problem copying file into the form: %w", err)
	}

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
	return nil
}
