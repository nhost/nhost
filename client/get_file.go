package client

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"mime"
	"net/http"

	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

type FileInformationHeaderWithReader struct {
	*FileInformationHeader
	Filename string
	Body     io.ReadCloser
}

func unmarshalGetFileError(resp *http.Response) error {
	b, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("got an error but failed to read the body: %w", err)
	}
	response := &controller.GetFileResponse{}
	if err := json.Unmarshal(b, response); err != nil {
		return fmt.Errorf("got an error but failed to unmarshal response: %w", err)
	}
	return &APIResponseError{
		resp.StatusCode,
		response.Error,
		nil,
	}
}

func parseFilename(resp *http.Response) (string, error) {
	_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
	if err != nil {
		return "", fmt.Errorf("problem parsing content-dispoisition: %w", err)
	}

	filename, ok := params["filename"]
	if !ok {
		return "", ErrFilenameNotFound
	}
	return filename, nil
}

// nolint: cyclop
func (c *Client) GetFile(
	ctx context.Context, fileID string, opts ...GetFileInformationOpt,
) (*FileInformationHeaderWithReader, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/files/"+fileID, nil)
	if err != nil {
		return nil, fmt.Errorf("problem creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.jwt)

	for _, o := range opts {
		o(req.Header)
	}

	resp, err := c.httpCliebt.Do(req)
	if err != nil {
		return nil, fmt.Errorf("problem executing request: %w", err)
	}

	if resp.StatusCode != http.StatusOK &&
		resp.StatusCode != http.StatusNotModified &&
		resp.StatusCode != http.StatusPreconditionFailed {
		defer resp.Body.Close()
		return nil, unmarshalGetFileError(resp)
	}

	info, err := fileInformationFromResponse(resp)
	if err != nil {
		return nil, err
	}

	if info.StatusCode == http.StatusPreconditionFailed || info.StatusCode == http.StatusNotModified {
		defer resp.Body.Close()
		return &FileInformationHeaderWithReader{info, "", nil}, nil
	}

	filename, err := parseFilename(resp)
	if err != nil {
		return nil, err
	}

	return &FileInformationHeaderWithReader{
		info,
		filename,
		resp.Body,
	}, nil
}
