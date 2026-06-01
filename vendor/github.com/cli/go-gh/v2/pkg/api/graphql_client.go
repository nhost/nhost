package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/cli/go-gh/v2/pkg/auth"
	graphql "github.com/cli/shurcooL-graphql"
)

// GraphQLClient wraps methods for the different types of
// API requests that are supported by the server.
type GraphQLClient struct {
	client     *graphql.Client
	host       string
	httpClient *http.Client
}

func DefaultGraphQLClient() (*GraphQLClient, error) {
	return NewGraphQLClient(ClientOptions{})
}

// NewGraphQLClient builds a client to send requests to GitHub GraphQL API endpoints.
//
// As part of the configuration a hostname, auth token, default set of headers,
// and unix domain socket are resolved from the gh environment configuration.
// These behaviors can be overridden using the opts argument.
func NewGraphQLClient(opts ClientOptions) (*GraphQLClient, error) {
	if optionsNeedResolution(opts) {
		var err error
		opts, err = resolveOptions(opts)
		if err != nil {
			return nil, err
		}
	}

	httpClient, err := NewHTTPClient(opts)
	if err != nil {
		return nil, err
	}

	endpoint := graphQLEndpoint(opts.Host)

	return &GraphQLClient{
		client:     graphql.NewClient(endpoint, httpClient),
		host:       endpoint,
		httpClient: httpClient,
	}, nil
}

// DoWithContext executes a GraphQL query request.
// The response is populated into the response argument.
func (c *GraphQLClient) DoWithContext(ctx context.Context, query string, variables map[string]interface{}, response interface{}) error {
	reqBody, err := json.Marshal(map[string]interface{}{"query": query, "variables": variables})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.host, bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	if !success {
		return HandleHTTPError(resp)
	}

	if resp.StatusCode == http.StatusNoContent {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	gr := graphQLResponse{Data: response}
	err = json.Unmarshal(body, &gr)
	if err != nil {
		return err
	}

	if len(gr.Errors) > 0 {
		return &GraphQLError{Errors: gr.Errors}
	}

	return nil
}

// Do wraps DoWithContext using context.Background.
func (c *GraphQLClient) Do(query string, variables map[string]interface{}, response interface{}) error {
	return c.DoWithContext(context.Background(), query, variables, response)
}

// MutateWithContext executes a GraphQL mutation request.
// The mutation string is derived from the mutation argument, and the
// response is populated into it.
// The mutation argument should be a pointer to struct that corresponds
// to the GitHub GraphQL schema.
// Provided input will be set as a variable named input.
func (c *GraphQLClient) MutateWithContext(ctx context.Context, name string, m interface{}, variables map[string]interface{}) error {
	err := c.client.MutateNamed(ctx, name, m, variables)
	var graphQLErrs graphql.Errors
	if err != nil && errors.As(err, &graphQLErrs) {
		items := make([]GraphQLErrorItem, len(graphQLErrs))
		for i, e := range graphQLErrs {
			items[i] = GraphQLErrorItem{
				Message:    e.Message,
				Locations:  e.Locations,
				Path:       e.Path,
				Extensions: e.Extensions,
				Type:       e.Type,
			}
		}
		err = &GraphQLError{items}
	}
	return err
}

// Mutate wraps MutateWithContext using context.Background.
func (c *GraphQLClient) Mutate(name string, m interface{}, variables map[string]interface{}) error {
	return c.MutateWithContext(context.Background(), name, m, variables)
}

// QueryWithContext executes a GraphQL query request,
// The query string is derived from the query argument, and the
// response is populated into it.
// The query argument should be a pointer to struct that corresponds
// to the GitHub GraphQL schema.
func (c *GraphQLClient) QueryWithContext(ctx context.Context, name string, q interface{}, variables map[string]interface{}) error {
	err := c.client.QueryNamed(ctx, name, q, variables)
	var graphQLErrs graphql.Errors
	if err != nil && errors.As(err, &graphQLErrs) {
		items := make([]GraphQLErrorItem, len(graphQLErrs))
		for i, e := range graphQLErrs {
			items[i] = GraphQLErrorItem{
				Message:    e.Message,
				Locations:  e.Locations,
				Path:       e.Path,
				Extensions: e.Extensions,
				Type:       e.Type,
			}
		}
		err = &GraphQLError{items}
	}
	return err
}

// Query wraps QueryWithContext using context.Background.
func (c *GraphQLClient) Query(name string, q interface{}, variables map[string]interface{}) error {
	return c.QueryWithContext(context.Background(), name, q, variables)
}

type graphQLResponse struct {
	Data   interface{}
	Errors []GraphQLErrorItem
}

func graphQLEndpoint(host string) string {
	if isGarage(host) {
		return fmt.Sprintf("https://%s/api/graphql", host)
	}
	host = auth.NormalizeHostname(host)
	if auth.IsEnterprise(host) {
		return fmt.Sprintf("https://%s/api/graphql", host)
	}
	if strings.EqualFold(host, localhost) {
		return fmt.Sprintf("http://api.%s/graphql", host)
	}
	return fmt.Sprintf("https://api.%s/graphql", host)
}
