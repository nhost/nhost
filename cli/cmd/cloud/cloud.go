// Package cloud provides commands for Nhost Cloud.
package cloud

import (
	"errors"

	"github.com/urfave/cli/v3"
)

var (
	errInvalidArgs      = errors.New("invalid number of arguments")
	errInvalidVariables = errors.New("expected one JSON object")
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "cloud",
		Usage: "Work with your Nhost Cloud organizations and projects",
		Commands: []*cli.Command{
			CommandGraphQL(),
		},
	}
}

func CommandGraphQL() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "graphql",
		Usage: "Inspect the Nhost Cloud GraphQL schema and send raw GraphQL requests",
		Commands: []*cli.Command{
			CommandRequest(),
			CommandSchema(),
		},
	}
}
