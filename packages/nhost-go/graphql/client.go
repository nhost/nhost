// Package graphql executes GraphQL operations against a Hasura GraphQL endpoint
// through the shared HTTP middleware installed on the client's Transport.
package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/nhost/nhost/packages/nhost-go/transport"
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

// Client is a GraphQL API client backed by an *http.Client.
type Client struct {
	URL        string
	httpClient *http.Client
}

// NewClient creates a new GraphQL client. A nil httpClient uses a default
// *http.Client; supply one whose Transport carries the desired middleware.
func NewClient(url string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{} //nolint:exhaustruct
	}

	return &Client{
		URL:        url,
		httpClient: httpClient,
	}
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

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err //nolint:wrapcheck
	}

	return resp, body, nil
}

// Request executes a GraphQL operation, decoding data into a generic map. It
// returns a *transport.APIError if the response contains GraphQL errors.
func (c *Client) Request(
	ctx context.Context,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (Response[map[string]any], *transport.Response, error) {
	return Execute[map[string]any](ctx, c, query, variables, operationName, headers)
}

// Execute runs a GraphQL operation and decodes the data field into T. It
// returns the decoded envelope, the HTTP response metadata, and an error.
//
// It returns a *transport.APIError when either (a) the response body carries a
// top-level GraphQL `errors` array, or (b) the transport returns a non-2xx/3xx
// HTTP status (e.g. auth/gateway failures whose body has no `errors` key).
// GraphQL-level errors take precedence over the HTTP status.
//
// Note: when a GraphQL `errors` array is present the typed data is dropped and
// only the raw response survives in APIError.Body. Callers needing partial data
// (data + errors, as Hasura may return for remote-schema/action failures) must
// read APIError.Body.
func Execute[T any](
	ctx context.Context,
	c *Client,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (Response[T], *transport.Response, error) {
	var result Response[T]

	//nolint:bodyclose // c.do closes the response body before returning.
	resp, body, err := c.do(ctx, query, variables, operationName, headers)
	if err != nil {
		return result, nil, err
	}

	if len(body) > 0 {
		if err := json.Unmarshal(body, &result); err != nil {
			return result, nil, err //nolint:wrapcheck
		}
	}

	if len(result.Errors) > 0 {
		var parsed any

		_ = json.Unmarshal(body, &parsed)

		return result, nil, transport.NewAPIError(parsed, resp.StatusCode, resp.Header)
	}

	// Gate on HTTP status, consistent with the functions/auth/storage clients:
	// a non-2xx/3xx response without a GraphQL `errors` array is still a
	// failure and must surface as a *transport.APIError, not a zero-value
	// success.
	if resp.StatusCode >= 300 { //nolint:mnd
		var parsed any

		_ = json.Unmarshal(body, &parsed)

		return result, nil, transport.NewAPIError(parsed, resp.StatusCode, resp.Header)
	}

	return result, &transport.Response{Status: resp.StatusCode, Headers: resp.Header}, nil
}
