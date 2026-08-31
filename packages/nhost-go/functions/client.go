// Package functions invokes Nhost serverless functions through the shared HTTP
// middleware installed on the client's Transport.
package functions

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/transport"
)

// Client is a Functions API client backed by an *http.Client.
type Client struct {
	BaseURL    string
	httpClient *http.Client
}

// NewClient creates a new Functions client. A nil httpClient uses a default
// *http.Client; supply one whose Transport carries the desired middleware.
func NewClient(baseURL string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{} //nolint:exhaustruct
	}

	return &Client{
		BaseURL:    baseURL,
		httpClient: httpClient,
	}
}

func decodeBody(response *http.Response, body []byte) any {
	contentType := response.Header.Get("Content-Type")

	switch {
	case strings.Contains(contentType, "application/json"):
		if len(body) == 0 {
			return nil
		}

		var v any
		if json.Unmarshal(body, &v) == nil {
			return v
		}

		return string(body)
	case strings.HasPrefix(contentType, "text/"):
		return string(body)
	default:
		return body
	}
}

// Call invokes a function with an arbitrary method and raw body. It returns the
// decoded body (JSON -> parsed value, text/* -> string, otherwise []byte), the
// HTTP response metadata, and a *transport.APIError on a non-2xx/3xx response.
func (c *Client) Call(
	ctx context.Context,
	path string,
	method string,
	headers http.Header,
	body io.Reader,
) (any, *transport.Response, error) {
	if method == "" {
		method = http.MethodGet
	}

	// Join with exactly one slash so callers may pass the path with or without
	// a leading "/" (e.g. "echo" or "/echo") without producing a malformed URL.
	url := strings.TrimRight(c.BaseURL, "/") + "/" + strings.TrimLeft(path, "/")

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	decoded := decodeBody(resp, raw)

	if resp.StatusCode >= 300 { //nolint:mnd
		return nil, nil, transport.NewAPIError(decoded, resp.StatusCode, resp.Header)
	}

	return decoded, &transport.Response{Status: resp.StatusCode, Headers: resp.Header}, nil
}

// Post is a convenience POST with a JSON body and JSON Accept/Content-Type.
func (c *Client) Post(
	ctx context.Context,
	path string,
	body any,
	headers http.Header,
) (any, *transport.Response, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	merged := http.Header{}

	for k, vs := range headers {
		merged[k] = append([]string(nil), vs...)
	}

	merged.Set("Content-Type", "application/json")
	merged.Set("Accept", "application/json")

	return c.Call(ctx, path, http.MethodPost, merged, bytes.NewReader(raw))
}
