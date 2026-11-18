// Package api provides raw access to the Nhost Cloud GraphQL API.
package api

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
		Name:  "api",
		Usage: "Raw Nhost Cloud GraphQL access; schema is offline, request uses your nhost login session",
		Description: "Sends GraphQL to the Nhost Cloud API, which manages your organizations and " +
			"projects, not to your project's own GraphQL API. Only `request` uses your nhost login " +
			"session; `schema` reads an offline snapshot bundled with the CLI. Prefer `nhost mcp` tools. This raw " +
			"pass-through runs exactly what you send with your permissions; reads can return secrets " +
			"and mutations are not checked or confirmed, so configure your agent to ask before running " +
			"`nhost api request`. Projects are called apps.",
		Commands: []*cli.Command{
			CommandRequest(),
			CommandSchema(),
		},
	}
}
