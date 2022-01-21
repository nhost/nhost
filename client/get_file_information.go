package client

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

type FileInformationHeader struct {
	CacheControl  string
	ContentLength int
	ContentType   string
	Etag          string
	LastModified  string
	Error         string
	StatusCode    int
}

func fileInformationFromResponse(resp *http.Response) (*FileInformationHeader, error) {
	var err error
	length := 0
	if resp.Header.Get("Content-Length") != "" {
		length, err = strconv.Atoi(resp.Header.Get("Content-Length"))
		if err != nil {
			return nil, fmt.Errorf("problem converting Content-Length %s to integer: %w", resp.Header.Get("Content-Length"), err)
		}
	}

	info := &FileInformationHeader{
		CacheControl:  resp.Header.Get("Cache-Control"),
		ContentLength: length,
		ContentType:   resp.Header.Get("Content-Type"),
		Etag:          resp.Header.Get("Etag"),
		LastModified:  resp.Header.Get("Last-Modified"),
		StatusCode:    resp.StatusCode,
		Error:         resp.Header.Get("X-Error"),
	}

	if info.Error != "" {
		return nil, &APIResponseError{
			StatusCode: resp.StatusCode,
			ErrorResponse: &controller.ErrorResponse{
				Message: info.Error,
			},
		}
	}
	return info, nil
}

type GetFileInformationOpt func(header http.Header)

func WithIfMatch(etags ...string) func(header http.Header) {
	return func(header http.Header) {
		for _, e := range etags {
			header.Add("if-match", e)
		}
	}
}

func WithNoneMatch(etags ...string) func(header http.Header) {
	return func(header http.Header) {
		for _, e := range etags {
			header.Add("if-none-match", e)
		}
	}
}

func WithIfModifiedSince(modifiedSince string) func(header http.Header) {
	return func(header http.Header) {
		header.Add("if-modified-since", modifiedSince)
	}
}

func WithIfUnmodifiedSince(modifiedSince string) func(header http.Header) {
	return func(header http.Header) {
		header.Add("if-unmodified-since", modifiedSince)
	}
}

func (c *Client) GetFileInformation(
	ctx context.Context,
	fileID string,
	opts ...GetFileInformationOpt,
) (*FileInformationHeader, error) {
	req, err := http.NewRequestWithContext(ctx, "HEAD", c.baseURL+"/files/"+fileID, nil)
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
	defer resp.Body.Close()

	return fileInformationFromResponse(resp)
}
