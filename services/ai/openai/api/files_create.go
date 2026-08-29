package api

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
)

type CreateFileJSONRequestBody = CreateFileRequest

var ErrUnexpectedStatusCode = errors.New("unexpected status code")

type CustomClientWithResponsesInterface interface {
	CreateFileWithResponse(
		ctx context.Context,
		body CreateFileJSONRequestBody,
		reqEditors ...RequestEditorFn,
	) (*CreateFileR, error)
}

type CustomClientWithResponses struct {
	CustomClientInterface
}

type CustomClientInterface interface {
	CreateFile(
		ctx context.Context,
		body CreateFileJSONRequestBody,
		reqEditors ...RequestEditorFn,
	) (*http.Response, error)
}

func (c *Client) CreateFile(
	ctx context.Context,
	body CreateFileJSONRequestBody,
	reqEditors ...RequestEditorFn,
) (*http.Response, error) {
	var buffer bytes.Buffer

	writer := multipart.NewWriter(&buffer)

	part, err := writer.CreateFormFile("file", body.File.Filename())
	if err != nil {
		return nil, fmt.Errorf("error creating form file: %w", err)
	}

	r, err := body.File.Reader()
	if err != nil {
		return nil, fmt.Errorf("error getting file reader: %w", err)
	}

	if _, err := io.Copy(part, r); err != nil {
		return nil, fmt.Errorf("error copying file to form file: %w", err)
	}

	if err := writer.WriteField("purpose", "assistants"); err != nil {
		return nil, fmt.Errorf("error writing field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("error closing writer: %w", err)
	}

	queryURL, err := url.Parse(c.Server + "/files")
	if err != nil {
		return nil, fmt.Errorf("error parsing URL: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		queryURL.String(),
		&buffer,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	if err = c.applyEditors(ctx, req, reqEditors); err != nil {
		return nil, fmt.Errorf("error applying request editors: %w", err)
	}

	return c.Client.Do(req) //nolint: wrapcheck
}

func (c *CustomClientWithResponses) CreateFileWithResponse(
	ctx context.Context,
	body CreateFileJSONRequestBody,
	reqEditors ...RequestEditorFn,
) (*CreateFileR, error) {
	rsp, err := c.CreateFile(ctx, body, reqEditors...) //nolint: bodyclose
	if err != nil {
		return nil, err
	}

	return ParseCreateFileR(rsp)
}

func NewCustomClientWithResponses(
	server string,
	opts ...ClientOption,
) (*CustomClientWithResponses, error) {
	client, err := NewClient(server, opts...)
	if err != nil {
		return nil, err
	}

	return &CustomClientWithResponses{client}, nil
}
