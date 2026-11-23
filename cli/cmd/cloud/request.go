package cloud

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	flagVariables       = "variables"
	subscriptionRefusal = "Subscriptions are not supported."
)

func CommandRequest() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "request",
		Usage: "Send a query or mutation to the Nhost Cloud API and print its data as JSON",
		Description: "Sends GraphQL to the Nhost Cloud API, which manages your organizations and " +
			"projects, not to your project's own GraphQL API. Uses your nhost login session, or " +
			"NHOST_PAT when set. Prefer `nhost mcp` tools. This raw pass-through runs exactly what " +
			"you send with your permissions; reads can return secrets and mutations are not checked " +
			"or confirmed, so configure your agent to ask before running " +
			"`nhost cloud graphql request`. Projects are called apps.",
		ArgsUsage: "<document>",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagVariables,
				Usage: "GraphQL variables as one JSON object",
				Value: "{}",
			},
		},
		Action: commandRequest,
	}
}

func commandRequest(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 1 {
		return fmt.Errorf("%w: expected one GraphQL document", errInvalidArgs)
	}

	variables, err := parseVariables(cmd.String(flagVariables))
	if err != nil {
		return fmt.Errorf("failed to parse variables: %w", err)
	}

	return execute(ctx, cmd, cmd.Args().First(), variables)
}

func parseVariables(raw string) (map[string]any, error) {
	var variables map[string]any

	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.UseNumber()

	if err := decoder.Decode(&variables); err != nil {
		return nil, fmt.Errorf("%w: %w", errInvalidVariables, err)
	}

	if variables == nil {
		return nil, fmt.Errorf("%w, got null", errInvalidVariables)
	}

	switch err := decoder.Decode(new(any)); {
	case errors.Is(err, io.EOF):
		return variables, nil
	case err != nil:
		return nil, fmt.Errorf("%w: %w", errInvalidVariables, err)
	default:
		return nil, fmt.Errorf("%w, got more than one value", errInvalidVariables)
	}
}

func execute(
	ctx context.Context,
	cmd *cli.Command,
	document string,
	variables map[string]any,
) error {
	allowed := []string{"*"}
	if err := graphql.CheckAllowedGraphqlQuery(allowed, allowed, document); err != nil {
		if hasSubscription(document) {
			return fmt.Errorf("%s %w", subscriptionRefusal, err)
		}

		return fmt.Errorf("failed to check document: %w", err)
	}

	ce := clienv.FromCLI(cmd)

	interceptor, err := ce.NewCloudInterceptor(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	var response graphql.Response[json.RawMessage]
	if err := graphql.Query(
		ctx, ce.GraphqlURL(), document, variables, &response, allowed, allowed, interceptor,
	); err != nil {
		return fmt.Errorf("failed to query the Nhost Cloud API: %w", err)
	}

	ce.Println("%s", response.Data)

	return nil
}

func hasSubscription(document string) bool {
	query, err := parser.ParseQuery(
		&ast.Source{Name: "document.graphql", Input: document, BuiltIn: false},
	)
	if err != nil {
		return false
	}

	return slices.ContainsFunc(query.Operations, func(op *ast.OperationDefinition) bool {
		return op.Operation == ast.Subscription
	})
}
