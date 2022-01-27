package graphql

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/hasura/go-graphql-client/internal/jsonutil"
)

// This function allows you to tweak the HTTP request. It might be useful to set authentication
// headers  amongst other things
type RequestModifier func(*http.Request)

// Client is a GraphQL client.
type Client struct {
	url             string // GraphQL server URL.
	httpClient      *http.Client
	requestModifier RequestModifier
}

// NewClient creates a GraphQL client targeting the specified GraphQL server URL.
// If httpClient is nil, then http.DefaultClient is used.
func NewClient(url string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		url:             url,
		httpClient:      httpClient,
		requestModifier: nil,
	}
}

// Query executes a single GraphQL query request,
// with a query derived from q, populating the response into it.
// q should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Query(ctx context.Context, q interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, queryOperation, q, variables, options...)
}

// NamedQuery executes a single GraphQL query request, with operation name
//
// Deprecated: this is the shortcut of Query method, with NewOperationName option
func (c *Client) NamedQuery(ctx context.Context, name string, q interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, queryOperation, q, variables, append(options, OperationName(name))...)
}

// Mutate executes a single GraphQL mutation request,
// with a mutation derived from m, populating the response into it.
// m should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Mutate(ctx context.Context, m interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, mutationOperation, m, variables, options...)
}

// NamedMutate executes a single GraphQL mutation request, with operation name
//
// Deprecated: this is the shortcut of Mutate method, with NewOperationName option
func (c *Client) NamedMutate(ctx context.Context, name string, m interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, mutationOperation, m, variables, append(options, OperationName(name))...)
}

// Query executes a single GraphQL query request,
// with a query derived from q, populating the response into it.
// q should be a pointer to struct that corresponds to the GraphQL schema.
// return raw bytes message.
func (c *Client) QueryRaw(ctx context.Context, q interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, queryOperation, q, variables, options...)
}

// NamedQueryRaw executes a single GraphQL query request, with operation name
// return raw bytes message.
func (c *Client) NamedQueryRaw(ctx context.Context, name string, q interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, queryOperation, q, variables, append(options, OperationName(name))...)
}

// MutateRaw executes a single GraphQL mutation request,
// with a mutation derived from m, populating the response into it.
// m should be a pointer to struct that corresponds to the GraphQL schema.
// return raw bytes message.
func (c *Client) MutateRaw(ctx context.Context, m interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, mutationOperation, m, variables, options...)
}

// NamedMutateRaw executes a single GraphQL mutation request, with operation name
// return raw bytes message.
func (c *Client) NamedMutateRaw(ctx context.Context, name string, m interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, mutationOperation, m, variables, append(options, OperationName(name))...)
}

// do executes a single GraphQL operation.
// return raw message and error
func (c *Client) doRaw(ctx context.Context, op operationType, v interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	var query string
	var err error
	switch op {
	case queryOperation:
		query, err = constructQuery(v, variables, options...)
	case mutationOperation:
		query, err = constructMutation(v, variables, options...)
	}

	if err != nil {
		return nil, err
	}

	in := struct {
		Query     string                 `json:"query"`
		Variables map[string]interface{} `json:"variables,omitempty"`
	}{
		Query:     query,
		Variables: variables,
	}
	var buf bytes.Buffer
	err = json.NewEncoder(&buf).Encode(in)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, &buf)
	if err != nil {
		return nil, fmt.Errorf("problem constructing request: %w", err)
	}
	request.Header.Add("Content-Type", "application/json")

	if c.requestModifier != nil {
		c.requestModifier(request)
	}

	resp, err := c.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("non-200 OK status code: %v body: %q", resp.Status, body)
	}
	var out struct {
		Data   *json.RawMessage
		Errors Errors
	}
	err = json.NewDecoder(resp.Body).Decode(&out)
	if err != nil {
		// TODO: Consider including response body in returned error, if deemed helpful.
		return nil, err
	}

	if len(out.Errors) > 0 {
		return out.Data, out.Errors
	}

	return out.Data, nil
}

// do executes a single GraphQL operation and unmarshal json.
func (c *Client) do(ctx context.Context, op operationType, v interface{}, variables map[string]interface{}, options ...Option) error {
	var query string
	var err error
	switch op {
	case queryOperation:
		query, err = constructQuery(v, variables, options...)
	case mutationOperation:
		query, err = constructMutation(v, variables, options...)
	}

	if err != nil {
		return err
	}

	in := struct {
		Query     string                 `json:"query"`
		Variables map[string]interface{} `json:"variables,omitempty"`
	}{
		Query:     query,
		Variables: variables,
	}
	var buf bytes.Buffer
	err = json.NewEncoder(&buf).Encode(in)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, &buf)
	if err != nil {
		return fmt.Errorf("problem constructing request: %w", err)
	}
	request.Header.Add("Content-Type", "application/json")

	if c.requestModifier != nil {
		c.requestModifier(request)
	}

	resp, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	r := resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		r, err = gzip.NewReader(r)
		if err != nil {
			return fmt.Errorf("problem trying to create gzip reader: %w", err)
		}
		defer r.Close()
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(r)
		return fmt.Errorf("non-200 OK status code: %v body: %q", resp.Status, body)
	}
	var out struct {
		Data   *json.RawMessage
		Errors Errors
	}

	err = json.NewDecoder(r).Decode(&out)
	if err != nil {
		// TODO: Consider including response body in returned error, if deemed helpful.
		return err
	}
	if out.Data != nil {
		err := jsonutil.UnmarshalGraphQL(*out.Data, v)
		if err != nil {
			// TODO: Consider including response body in returned error, if deemed helpful.
			return err
		}
	}
	if len(out.Errors) > 0 {
		return out.Errors
	}
	return nil
}

// Returns a copy of the client with the request modifier set. This allows you to reuse the same
// TCP connection for multiple slghtly different requests to the same server
// (i.e. different authentication headers for multitenant applications)
func (c *Client) WithRequestModifier(f RequestModifier) *Client {
	return &Client{
		url:             c.url,
		httpClient:      c.httpClient,
		requestModifier: f,
	}
}

// errors represents the "errors" array in a response from a GraphQL server.
// If returned via error interface, the slice is expected to contain at least 1 element.
//
// Specification: https://facebook.github.io/graphql/#sec-Errors.
type Errors []struct {
	Message    string
	Extensions map[string]interface{}
	Locations  []struct {
		Line   int
		Column int
	}
}

// Error implements error interface.
func (e Errors) Error() string {
	b := strings.Builder{}
	for _, err := range e {
		b.WriteString(fmt.Sprintf("Message: %s, Locations: %+v", err.Message, err.Locations))
	}
	return b.String()
}

type operationType uint8

const (
	queryOperation operationType = iota
	mutationOperation
	// subscriptionOperation // Unused.
)
