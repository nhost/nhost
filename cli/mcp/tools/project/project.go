package project

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

type Project struct {
	subdomain       string
	graphqlURL      string
	authInterceptor func(ctx context.Context, req *http.Request) error
	allowQueries    []string
	allowMutations  []string
}

type Tool struct {
	projects map[string]Project
}

func allowedQueries(allowQueries []string) []string {
	if len(allowQueries) == 1 && allowQueries[0] == "*" {
		return nil
	}

	return allowQueries
}

func NewTool(
	projList []config.Project,
) (*Tool, error) {
	projects := make(map[string]Project)

	for _, proj := range projList {
		authURL := fmt.Sprintf("https://%s.auth.%s.nhost.run/v1", proj.Subdomain, proj.Region)
		graphqlURL := fmt.Sprintf("https://%s.graphql.%s.nhost.run/v1", proj.Subdomain, proj.Region)

		var interceptor func(ctx context.Context, req *http.Request) error

		switch {
		case proj.AdminSecret != nil && *proj.AdminSecret != "":
			interceptor = auth.WithAdminSecret(*proj.AdminSecret)
		case proj.PAT != nil && *proj.PAT != "":
			var err error

			interceptor, err = auth.WithPAT(authURL, *proj.PAT)
			if err != nil {
				return nil,
					fmt.Errorf("failed to create PAT interceptor for %s: %w", proj.Subdomain, err)
			}
		default:
			return nil, fmt.Errorf( //nolint:err113
				"project %s does not have a valid auth mechanism", proj.Subdomain)
		}

		projects[proj.Subdomain] = Project{
			subdomain:       proj.Subdomain,
			graphqlURL:      graphqlURL,
			authInterceptor: interceptor,
			allowQueries:    allowedQueries(proj.AllowQueries),
			allowMutations:  allowedQueries(proj.AllowMutations),
		}
	}

	return &Tool{
		projects: projects,
	}, nil
}

func (t *Tool) Register(mcpServer *server.MCPServer) error {
	projectNames := make([]string, 0, len(t.projects))
	for _, proj := range t.projects {
		projectNames = append(projectNames, proj.subdomain)
	}

	slices.Sort(projectNames)

	projectNamesStr := strings.Join(projectNames, ", ")

	t.registerGetGraphqlSchemaTool(mcpServer, projectNamesStr)
	t.registerGraphqlQuery(mcpServer, projectNamesStr)

	return nil
}
