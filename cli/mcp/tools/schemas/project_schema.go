package schemas

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

const (
	ToolGetGraphqlSchemaName         = "project-get-graphql-schema"
	ToolGetGraphqlSchemaInstructions = `Get GraphQL schema for an Nhost project running in the Nhost Cloud.`
)

var (
	ErrNotFound           = errors.New("not found")
	ErrInvalidRequestBody = errors.New("invalid request body")
)

type GetGraphqlSchemaRequest struct {
	Role             string `json:"role"`
	ProjectSubdomain string `json:"projectSubdomain"`
}

func toQueries(q []string) []graphql.Queries {
	if q == nil {
		return nil
	}

	queries := make([]graphql.Queries, len(q))
	for i, v := range q {
		queries[i] = graphql.Queries{
			Name:           v,
			DisableNesting: false,
		}
	}

	return queries
}

func (t *Tool) handleProjectGraphqlSchema(
	ctx context.Context,
	role string,
	subdomain string,
	summary bool,
	queries, mutations []string,
) (string, error) {
	project, err := t.cfg.Projects.Get(subdomain)
	if err != nil {
		return "", fmt.Errorf("failed to get project by subdomain: %w", err)
	}

	authInterceptor, err := project.GetAuthInterceptor()
	if err != nil {
		return "", fmt.Errorf("failed to get auth interceptor: %w", err)
	}

	interceptors := []func(ctx context.Context, req *http.Request) error{
		authInterceptor,
		auth.WithRole(role),
	}

	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		project.GetGraphqlURL(),
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		[]string{"*"},
		nil,
		interceptors...,
	); err != nil {
		return "", fmt.Errorf("failed to query GraphQL schema: %w", err)
	}

	var schema string
	if summary {
		schema = graphql.SummarizeSchema(introspection)
	} else {
		schema = graphql.ParseSchema(
			introspection,
			graphql.Filter{
				AllowQueries:   toQueries(queries),
				AllowMutations: toQueries(mutations),
			},
		)
	}

	return schema, nil
}
