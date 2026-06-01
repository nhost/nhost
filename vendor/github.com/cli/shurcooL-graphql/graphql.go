package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/cli/shurcooL-graphql/internal/jsonutil"
)

// Client is a GraphQL client.
type Client struct {
	url        string       // GraphQL server URL.
	httpClient *http.Client // Non-nil.
}

// NewClient creates a GraphQL client targeting the specified GraphQL server URL.
// If httpClient is nil, then http.DefaultClient is used.
func NewClient(url string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		url:        url,
		httpClient: httpClient,
	}
}

// Query executes a single GraphQL query request,
// with a query derived from q, populating the response into it.
// Argument q should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Query(ctx context.Context, q any, variables map[string]any) error {
	return c.do(ctx, queryOperation, q, variables, "")
}

// QueryNamed is the same as Query but allows a name to be specified for the query.
func (c *Client) QueryNamed(ctx context.Context, queryName string, q any, variables map[string]any) error {
	return c.do(ctx, queryOperation, q, variables, queryName)
}

// Mutate executes a single GraphQL mutation request,
// with a mutation derived from m, populating the response into it.
// Argument m should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Mutate(ctx context.Context, m any, variables map[string]any) error {
	return c.do(ctx, mutationOperation, m, variables, "")
}

// MutateNamed is the same as Mutate but allows a name to be specified for the mutation.
func (c *Client) MutateNamed(ctx context.Context, queryName string, m any, variables map[string]any) error {
	return c.do(ctx, mutationOperation, m, variables, queryName)
}

// do executes a single GraphQL operation.
func (c *Client) do(ctx context.Context, op operationType, v any, variables map[string]any, queryName string) error {
	var query string
	switch op {
	case queryOperation:
		query = constructQuery(v, variables, queryName)
	case mutationOperation:
		query = constructMutation(v, variables, queryName)
	}
	in := struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables,omitempty"`
	}{
		Query:     query,
		Variables: variables,
	}
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(in)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("non-200 OK status code: %v body: %q", resp.Status, body)
	}
	var out struct {
		Data   *json.RawMessage
		Errors Errors
		//Extensions any // Unused.
	}
	err = json.NewDecoder(resp.Body).Decode(&out)
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

// Errors represents the "errors" array in a response from a GraphQL server.
// If returned via error interface, the slice is expected to contain at least 1 element.
//
// Specification: https://spec.graphql.org/October2021/#sec-Errors.
type Errors []struct {
	Message   string
	Locations []struct {
		Line   int
		Column int
	}
	Path       []any
	Extensions map[string]any
	Type       string
}

// Error implements error interface.
func (e Errors) Error() string {
	b := strings.Builder{}
	l := len(e)
	for i, err := range e {
		b.WriteString(fmt.Sprintf("Message: %s, Locations: %+v", err.Message, err.Locations))
		if i != l-1 {
			b.WriteString("\n")
		}
	}
	return b.String()
}

type operationType uint8

const (
	queryOperation operationType = iota
	mutationOperation
)
