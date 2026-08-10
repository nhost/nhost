// Package gh is a thin adapter around the go-gh/v2 API clients so the rest of
// the tool can issue GraphQL and REST requests without instantiating clients
// directly. Auth and host resolution are inherited from the `gh` CLI's stored
// session (or the GH_TOKEN / GITHUB_TOKEN env vars), so this binary is meant
// to run as a `gh` extension.
package gh

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/cli/go-gh/v2/pkg/api"
)

// Sentinel errors returned by Client. Wrap with %w when adding call-site context.
var (
	ErrNoLogin      = errors.New("gh api user returned an empty login")
	ErrClientInit   = errors.New("initialising gh client failed")
	ErrGraphQL      = errors.New("graphql request returned errors")
	ErrREST         = errors.New("rest request failed")
	ErrMissingScope = errors.New("gh token is missing a required OAuth scope")
)

// Client wraps the go-gh GraphQL and REST clients. Auth, host resolution, and
// HTTP transport are entirely owned by go-gh.
type Client struct {
	gql  *api.GraphQLClient
	rest *api.RESTClient
}

// New constructs a Client backed by the default `gh` authentication context.
func New() (*Client, error) {
	gql, err := api.DefaultGraphQLClient()
	if err != nil {
		return nil, fmt.Errorf("%w: graphql: %w", ErrClientInit, err)
	}

	rest, err := api.DefaultRESTClient()
	if err != nil {
		return nil, fmt.Errorf("%w: rest: %w", ErrClientInit, err)
	}

	return &Client{gql: gql, rest: rest}, nil
}

// GraphQL executes a GraphQL query against api.github.com and decodes the
// `data` field of the response into out.
func (c *Client) GraphQL(
	ctx context.Context,
	query string,
	vars map[string]any,
	out any,
) error {
	if err := c.gql.DoWithContext(ctx, query, vars, out); err != nil {
		if isInsufficientScopes(err) {
			return fmt.Errorf("%w: %w", ErrMissingScope, err)
		}

		return fmt.Errorf("%w: %w", ErrGraphQL, err)
	}

	return nil
}

// APIJSON runs a GET against the REST API and decodes the JSON response into
// out. The path is the same `gh api PATH` accepts (e.g. "user").
func (c *Client) APIJSON(ctx context.Context, path string, out any) error {
	if err := c.rest.DoWithContext(ctx, http.MethodGet, path, nil, out); err != nil {
		return fmt.Errorf("%w: GET %s: %w", ErrREST, path, err)
	}

	return nil
}

// AuthenticatedLogin returns the login of the user the gh session is
// authenticated as.
func (c *Client) AuthenticatedLogin(ctx context.Context) (string, error) {
	var resp struct {
		Login string `json:"login"`
	}
	if err := c.APIJSON(ctx, "user", &resp); err != nil {
		return "", err
	}

	if resp.Login == "" {
		return "", ErrNoLogin
	}

	return resp.Login, nil
}

// isInsufficientScopes reports whether a go-gh error indicates the token is
// missing a required OAuth scope. GitHub surfaces this either as a GraphQL
// error item of type INSUFFICIENT_SCOPES or, less consistently, as a plain
// message saying "has not been granted the required scopes".
func isInsufficientScopes(err error) bool {
	var gqlErr *api.GraphQLError
	if errors.As(err, &gqlErr) {
		for _, item := range gqlErr.Errors {
			if item.Type == "INSUFFICIENT_SCOPES" {
				return true
			}
		}
	}

	return strings.Contains(err.Error(), "has not been granted the required scopes")
}
