package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func CreateUpdateMultiForm(file *File) (io.Reader, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if err := CreateMultiFormFile(writer, "file", file, false); err != nil {
		return nil, "", fmt.Errorf("problem creating form for file %s: %w", file.md.Name, err)
	}
	writer.Close()

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType(), nil
}

func (c *Client) UpdateFile(ctx context.Context, fileID string, file *File) (*controller.UpdateFileResponse, error) {
	body, contentType, err := CreateUpdateMultiForm(file)
	if err != nil {
		return nil, fmt.Errorf("problem creating multiform: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", c.baseURL+"/files/"+fileID, body)
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

	response := &controller.UpdateFileResponse{}

	decoder := json.NewDecoder(resp.Body)
	if err := decoder.Decode(response); err != nil {
		return nil, fmt.Errorf("problem unmarshaling response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &APIResponseError{
			resp.StatusCode,
			response.Error,
			nil,
		}
	}

	return response, nil
}
