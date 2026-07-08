// Package functions invokes Nhost serverless functions through the shared fetch
// middleware chain.
package functions

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/fetch"
)

// Client is a Functions API client backed by an *http.Client and a middleware
// chain.
type Client struct {
	BaseURL        string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}

// NewClient creates a new Functions client.
func NewClient(baseURL string, chainFunctions []fetch.ChainFunction, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{} //nolint:exhaustruct
	}

	c := &Client{ //nolint:exhaustruct
		BaseURL:        baseURL,
		chainFunctions: append([]fetch.ChainFunction{}, chainFunctions...),
		httpClient:     httpClient,
	}
	c.fetch = fetch.CreateEnhancedFetch(c.httpClient, c.chainFunctions)

	return c
}

// PushChainFunction appends a middleware chain function and rebuilds the pipeline.
func (c *Client) PushChainFunction(cf fetch.ChainFunction) {
	c.chainFunctions = append(c.chainFunctions, cf)
	c.fetch = fetch.CreateEnhancedFetch(c.httpClient, c.chainFunctions)
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

// Fetch invokes a function with an arbitrary method and raw body. The response
// body is decoded by content type (JSON -> parsed value, text/* -> string,
// otherwise []byte). It returns a *fetch.FetchError on a non-2xx/3xx response.
func (c *Client) Fetch(
	ctx context.Context,
	path string,
	method string,
	headers http.Header,
	body io.Reader,
) (*fetch.FetchResponse[any], error) {
	if method == "" {
		method = http.MethodGet
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	resp, err := c.fetch(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	decoded := decodeBody(resp, raw)

	if resp.StatusCode >= 300 { //nolint:mnd
		return nil, fetch.NewFetchError(decoded, resp.StatusCode, resp.Header)
	}

	return &fetch.FetchResponse[any]{Body: decoded, Status: resp.StatusCode, Headers: resp.Header}, nil
}

// Post is a convenience POST with a JSON body and JSON Accept/Content-Type.
func (c *Client) Post(
	ctx context.Context,
	path string,
	body any,
	headers http.Header,
) (*fetch.FetchResponse[any], error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	merged := http.Header{}

	for k, vs := range headers {
		merged[k] = append([]string(nil), vs...)
	}

	merged.Set("Content-Type", "application/json")
	merged.Set("Accept", "application/json")

	return c.Fetch(ctx, path, http.MethodPost, merged, bytes.NewReader(raw))
}
