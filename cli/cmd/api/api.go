// Package api provides raw access to the Nhost Cloud GraphQL API.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/urfave/cli/v3"
)

var (
	errInvalidArgs      = errors.New("invalid number of arguments")
	errInvalidVariables = errors.New("expected one JSON object")
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "api",
		Usage: "Raw Nhost Cloud GraphQL access with your nhost login session",
		Description: "Sends GraphQL to the Nhost Cloud API, which manages your organizations and " +
			"projects, not to your project's own GraphQL API. Prefer `nhost mcp` tools. This raw " +
			"pass-through runs exactly what you send with your permissions; reads can return secrets. " +
			"`nhost api query` sends mutations only with --with-mutations; nothing else is checked or " +
			"confirmed, so configure your agent to ask before running it. Projects are called apps.",
		Commands: []*cli.Command{
			CommandQuery(),
			CommandSchema(),
		},
	}
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
	queries, mutations []string,
	refusalHint string,
) error {
	if err := graphql.CheckAllowedGraphqlQuery(queries, mutations, document); err != nil {
		if errors.Is(err, graphql.ErrQueryNotAllowed) {
			return fmt.Errorf("%s %w", refusalHint, err)
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
		ctx, ce.GraphqlURL(), document, variables, &response, queries, mutations, interceptor,
	); err != nil {
		return fmt.Errorf("failed to query the Nhost Cloud API: %w", err)
	}

	ce.Println("%s", response.Data)

	return nil
}
