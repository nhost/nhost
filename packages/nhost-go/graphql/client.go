// Package graphql executes GraphQL operations against a Hasura GraphQL endpoint
// through the shared fetch middleware chain.
package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/nhost/nhost/packages/nhost-go/fetch"
)

// Variables is a GraphQL variables map.
type Variables map[string]any

// ErrorLocation is the line/column of a GraphQL error.
type ErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// Error is a single GraphQL error entry as defined by the GraphQL spec.
type Error struct {
	Message    string          `json:"message"`
	Locations  []ErrorLocation `json:"locations,omitempty"`
	Path       []any           `json:"path,omitempty"`
	Extensions map[string]any  `json:"extensions,omitempty"`
}

// Response is the standard GraphQL response envelope, generic over the shape of
// the data field.
type Response[T any] struct {
	Data   T       `json:"data"`
	Errors []Error `json:"errors,omitempty"`
}

// Client is a GraphQL API client backed by an *http.Client and a middleware
// chain.
type Client struct {
	URL            string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}

// NewClient creates a new GraphQL client.
func NewClient(url string, chainFunctions []fetch.ChainFunction, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{} //nolint:exhaustruct
	}

	chain := append([]fetch.ChainFunction{}, chainFunctions...)

	return &Client{
		URL:            url,
		chainFunctions: chain,
		httpClient:     httpClient,
		fetch:          fetch.CreateEnhancedFetch(httpClient, chain),
	}
}

// PushChainFunction appends a middleware chain function and rebuilds the pipeline.
func (c *Client) PushChainFunction(cf fetch.ChainFunction) {
	c.chainFunctions = append(c.chainFunctions, cf)
	c.fetch = fetch.CreateEnhancedFetch(c.httpClient, c.chainFunctions)
}

func (c *Client) do(
	ctx context.Context,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*http.Response, []byte, error) {
	payload := map[string]any{"query": query}
	if variables != nil {
		payload["variables"] = variables
	}

	if operationName != "" {
		payload["operationName"] = operationName
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL, bytes.NewReader(raw))
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	req.Header.Set("Content-Type", "application/json")

	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	resp, err := c.fetch(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	return resp, body, nil
}

// Request executes a GraphQL operation, decoding data into a generic map. It
// returns a *fetch.FetchError if the response contains GraphQL errors.
func (c *Client) Request(
	ctx context.Context,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*fetch.FetchResponse[Response[map[string]any]], error) {
	return Execute[map[string]any](ctx, c, query, variables, operationName, headers)
}

// Execute runs a GraphQL operation and decodes the data field into T.
//
// It returns a *fetch.FetchError when either (a) the response body carries a
// top-level GraphQL `errors` array, or (b) the transport returns a non-2xx/3xx
// HTTP status (e.g. auth/gateway failures whose body has no `errors` key).
// GraphQL-level errors take precedence over the HTTP status.
//
// Note: when a GraphQL `errors` array is present the typed data is dropped and
// only the raw response survives in FetchError.Body. Callers needing partial
// data (data + errors, as Hasura may return for remote-schema/action failures)
// must read FetchError.Body.
func Execute[T any](
	ctx context.Context,
	c *Client,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*fetch.FetchResponse[Response[T]], error) {
	resp, body, err := c.do(ctx, query, variables, operationName, headers) //nolint:bodyclose // c.do closes the body
	if err != nil {
		return nil, err
	}

	var result Response[T]

	if len(body) > 0 {
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, err //nolint:wrapcheck
		}
	}

	if len(result.Errors) > 0 {
		var parsed any

		_ = json.Unmarshal(body, &parsed)

		return nil, fetch.NewFetchError(parsed, resp.StatusCode, resp.Header)
	}

	// Gate on HTTP status, consistent with the functions/auth/storage clients:
	// a non-2xx/3xx response without a GraphQL `errors` array is still a
	// failure and must surface as a *fetch.FetchError, not a zero-value success.
	if resp.StatusCode >= 300 { //nolint:mnd
		var parsed any

		_ = json.Unmarshal(body, &parsed)

		return nil, fetch.NewFetchError(parsed, resp.StatusCode, resp.Header)
	}

	return &fetch.FetchResponse[Response[T]]{
		Body:    result,
		Status:  resp.StatusCode,
		Headers: resp.Header,
	}, nil
}
