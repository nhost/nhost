package hasura

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

type MetadataRequestError struct {
	StatusCode int
	Body       *MetadataRequestErrorBody
}

func (e *MetadataRequestError) Error() string {
	b, err := json.Marshal(e.Body)
	if err != nil {
		b = fmt.Appendf(nil, "failed to marshal error body: %s", err)
	}

	return fmt.Sprintf("request failed with status %d: %s", e.StatusCode, string(b))
}

type MetadataRequestErrorBody struct {
	Err  string `json:"error"`
	Path string `json:"path"`
	Code string `json:"code"`
}

func (c *Client) QueryMetadata(ctx context.Context, req any, resp any) error {
	uri, err := url.Parse(c.Client.BaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse url: %w", err)
	}

	uri = uri.JoinPath("..", "..", "/v1", "metadata")

	b, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		uri.String(),
		bytes.NewBuffer(b),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json; charset=UTF-8")

	if err := c.Client.RequestInterceptor(ctx, request, nil, resp, c.do); err != nil {
		e := &RequestError{} //nolint:exhaustruct
		if errors.As(err, &e) {
			var body MetadataRequestErrorBody
			if err := json.Unmarshal(e.Body, &body); err != nil {
				return fmt.Errorf("failed to unmarshal error body: %w", err)
			}

			return &MetadataRequestError{
				StatusCode: e.StatusCode,
				Body:       &body,
			}
		}

		return err //nolint:wrapcheck
	}

	return nil
}
