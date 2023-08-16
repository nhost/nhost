package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func CreateUploadMultiForm(files ...*File) (io.Reader, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	formWriter, err := writer.CreateFormField("bucket-id")
	if err != nil {
		return nil, "", fmt.Errorf("problem creating form field for bucket-id: %w", err)
	}
	_, err = io.Copy(formWriter, strings.NewReader("default"))
	if err != nil {
		return nil, "", fmt.Errorf("problem writing bucket-id: %w", err)
	}

	for _, file := range files {
		if err := CreateMultiFormFile(writer, "file[]", file, true); err != nil {
			return nil, "", fmt.Errorf("problem creating form for file %s: %w", file.md.Name, err)
		}
	}
	writer.Close()

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType(), nil
}

func (c *Client) UploadFile(ctx context.Context, files ...*File) (*controller.UploadFileResponse, error) {
	if len(files) == 0 {
		return nil, ErrNoFiles
	}

	body, contentType, err := CreateUploadMultiForm(files...)
	if err != nil {
		return nil, fmt.Errorf("problem creating multiform: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/files/", body)
	if err != nil {
		return nil, fmt.Errorf("problem creating request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+c.jwt)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("problem executing request: %w", err)
	}
	defer resp.Body.Close()

	response := &controller.UploadFileResponse{}

	decoder := json.NewDecoder(resp.Body)
	if err := decoder.Decode(response); err != nil {
		return nil, fmt.Errorf("problem unmarshaling response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated {
		return nil,
			&APIResponseError{
				resp.StatusCode,
				response.Error,
				response,
			}
	}

	return response, nil
}
