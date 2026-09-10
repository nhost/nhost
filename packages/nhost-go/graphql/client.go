// Package graphql executes GraphQL operations against a Hasura GraphQL endpoint
// through the shared HTTP middleware installed on the client's Transport.
package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/transport"
)

// Variables is a GraphQL variables map. Request and Execute also accept typed
// structs when callers want compile-time types for their variables.
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

// ResponseError reports errors returned in a GraphQL response. Data contains
// any partial response data supplied alongside the errors. Request and Execute
// attempt to decode that partial data into the caller's destination before
// returning this error.
type ResponseError struct {
	Errors  []Error
	Data    json.RawMessage
	Status  int
	Headers http.Header
	cause   error
}

// Error implements the error interface.
func (e *ResponseError) Error() string {
	messages := make([]string, 0, len(e.Errors))

	for _, item := range e.Errors {
		if item.Message != "" {
			messages = append(messages, item.Message)
		}
	}

	if len(messages) == 0 {
		return "GraphQL request failed"
	}

	return strings.Join(messages, ", ")
}

// Unwrap returns an error encountered while decoding partial response data, if
// any.
func (e *ResponseError) Unwrap() error {
	return e.cause
}

// DecodeError reports a failure to decode a successful GraphQL response or its
// data into the requested destination type.
type DecodeError struct {
	cause error
}

// Error implements the error interface.
func (e *DecodeError) Error() string {
	return fmt.Sprintf("decode GraphQL response: %v", e.cause)
}

// Unwrap returns the underlying JSON decoding error.
func (e *DecodeError) Unwrap() error {
	return e.cause
}

type requestOptions struct {
	operationName string
	headers       http.Header
}

// RequestOption configures a GraphQL request.
type RequestOption func(*requestOptions)

// WithOperationName sets the GraphQL operationName request field.
func WithOperationName(operationName string) RequestOption {
	return func(options *requestOptions) {
		options.operationName = operationName
	}
}

// WithHeaders adds HTTP headers to a GraphQL request.
func WithHeaders(headers http.Header) RequestOption {
	headers = headers.Clone()

	return func(options *requestOptions) {
		options.headers = headers
	}
}

func applyRequestOptions(opts []RequestOption) requestOptions {
	var options requestOptions

	for _, option := range opts {
		if option != nil {
			option(&options)
		}
	}

	return options
}

type requestPayload struct {
	Query         string `json:"query"`
	Variables     any    `json:"variables,omitempty"`
	OperationName string `json:"operationName,omitempty"`
}

type responseEnvelope struct {
	Data   json.RawMessage `json:"data"`
	Errors []Error         `json:"errors,omitempty"`
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
	variables any,
	options requestOptions,
) (*http.Response, []byte, error) {
	payload := requestPayload{
		Query:         query,
		Variables:     variables,
		OperationName: options.operationName,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, fmt.Errorf("encode GraphQL request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL, bytes.NewReader(raw))
	if err != nil {
		return nil, nil, fmt.Errorf("create GraphQL request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	for key, values := range options.headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("execute GraphQL request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("read GraphQL response: %w", err)
	}

	return resp, body, nil
}

func decodeResponseBody(body []byte) any {
	if len(body) == 0 {
		return nil
	}

	var result any
	if err := json.Unmarshal(body, &result); err != nil {
		return string(body)
	}

	return result
}

// Request executes a GraphQL operation and decodes its data into destination,
// which should be a pointer to the expected response type. A nil destination
// discards response data. Variables may be either a typed struct or Variables.
//
// GraphQL errors are returned as *ResponseError. If a response contains both
// data and errors, Request decodes the partial data before returning the error.
// Non-success HTTP responses without GraphQL errors are returned as
// *transport.APIError, and successful responses that cannot be decoded are
// returned as *DecodeError.
func (c *Client) Request(
	ctx context.Context,
	query string,
	variables any,
	destination any,
	opts ...RequestOption,
) (*transport.Response, error) {
	options := applyRequestOptions(opts)

	//nolint:bodyclose // c.do closes the response body before returning.
	resp, body, err := c.do(ctx, query, variables, options)
	if err != nil {
		return nil, fmt.Errorf("perform GraphQL request: %w", err)
	}

	response := &transport.Response{Status: resp.StatusCode, Headers: resp.Header}
	if len(body) == 0 {
		if resp.StatusCode >= http.StatusMultipleChoices {
			return response, transport.NewAPIError(nil, resp.StatusCode, resp.Header)
		}

		return response, nil
	}

	var envelope responseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		if resp.StatusCode >= http.StatusMultipleChoices {
			return response, transport.NewAPIError(
				decodeResponseBody(body), resp.StatusCode, resp.Header,
			)
		}

		return response, &DecodeError{cause: err}
	}

	var dataDecodeError error
	if destination != nil && len(envelope.Data) > 0 {
		if err := json.Unmarshal(envelope.Data, destination); err != nil {
			dataDecodeError = &DecodeError{cause: err}
		}
	}

	if len(envelope.Errors) > 0 {
		return response, &ResponseError{
			Errors:  envelope.Errors,
			Data:    envelope.Data,
			Status:  resp.StatusCode,
			Headers: resp.Header,
			cause:   dataDecodeError,
		}
	}

	if resp.StatusCode >= http.StatusMultipleChoices {
		return response, transport.NewAPIError(
			decodeResponseBody(body), resp.StatusCode, resp.Header,
		)
	}

	if dataDecodeError != nil {
		return response, dataDecodeError
	}

	return response, nil
}

// Execute runs a GraphQL operation and returns its data decoded into T. It is a
// generic convenience over Client.Request; use Client.Request directly when a
// destination-style API is preferable.
//
//nolint:ireturn // Execute returns the caller-selected concrete GraphQL response type.
func Execute[T any](
	ctx context.Context,
	client *Client,
	query string,
	variables any,
	opts ...RequestOption,
) (T, *transport.Response, error) {
	var result T

	response, err := client.Request(ctx, query, variables, &result, opts...)
	if err != nil {
		return result, response, fmt.Errorf("execute GraphQL operation: %w", err)
	}

	return result, response, nil
}
