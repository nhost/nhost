package gen

import (
	"context"
	"fmt"
	"net/http"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

const (
	flagNhostGraphqlURL = "nhost-graphql-url"
	flagWithMutations   = "with-mutations"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "gen",
		Usage: "Generate GraphQL schema for Nhost Cloud",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagNhostGraphqlURL,
				Usage:   "Nhost GraphQL URL",
				Hidden:  true,
				Value:   "https://otsispdzcwxyqzbfntmj.graphql.eu-central-1.nhost.run/v1",
				Sources: cli.EnvVars("NHOST_GRAPHQL_URL"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagWithMutations,
				Usage:   "Include mutations in the generated schema",
				Value:   false,
				Sources: cli.EnvVars("WITH_MUTATIONS"),
			},
		},
		Action: action,
	}
}

func buildFilter(withMutations bool) graphql.Filter {
	filter := graphql.Filter{
		AllowQueries: []graphql.Queries{
			{Name: "organizations", DisableNesting: true},
			{Name: "organization", DisableNesting: true},
			{Name: "app", DisableNesting: true},
			{Name: "apps", DisableNesting: true},
			{Name: "config", DisableNesting: false},
		},
		AllowMutations: []graphql.Queries{},
	}

	if withMutations {
		filter.AllowMutations = []graphql.Queries{
			{Name: "updateConfig", DisableNesting: false},
		}
	}

	return filter
}

func buildInterceptor(
	ctx context.Context,
	ce *clienv.CliEnv,
) (func(ctx context.Context, req *http.Request) error, error) {
	if pat := ce.PAT(); pat != "" {
		cl, err := ce.NewAuthClient()
		if err != nil {
			return nil, fmt.Errorf("failed to create auth client: %w", err)
		}

		return nhostclient.WithPAT(cl, pat), nil
	}

	creds, err := ce.Credentials()
	if err != nil {
		return nil, fmt.Errorf(
			"failed to load credentials (run `nhost login` first): %w",
			err,
		)
	}

	authClient, err := ce.NewAuthClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create auth client: %w", err)
	}

	metadataResp, err := authClient.GetOAuthAuthorizationServerWithResponse(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	if metadataResp.JSON200 == nil {
		return nil, fmt.Errorf( //nolint:err113
			"OAuth2 metadata endpoint returned status %d",
			metadataResp.StatusCode(),
		)
	}

	return nhostclient.WithOAuth2RefreshToken(
		auth.NewRotatingTokenSource(
			metadataResp.JSON200.TokenEndpoint,
			ce.OAuth2ClientID(),
			creds.RefreshToken,
		),
	), nil
}

func action(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	interceptor, err := buildInterceptor(ctx, ce)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		cmd.String(flagNhostGraphqlURL),
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		nil,
		nil,
		interceptor,
	); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	schema := graphql.ParseSchema(
		introspection,
		buildFilter(cmd.Bool(flagWithMutations)),
	)

	fmt.Print(schema) //nolint:forbidigo

	return nil
}
