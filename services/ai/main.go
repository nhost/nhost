package main

import (
	"log"
	"os"

	"github.com/nhost/nhost/services/ai/cmd"
	"github.com/urfave/cli/v2"
)

var Version string

//go:generate gqlgen
//go:generate gqlgenc
func main() {
	app := &cli.App{ //nolint:exhaustruct
		Name:    "graphite",
		Version: Version,
		Usage:   "Graphite is a GraphQL API for AI operations",
		Commands: []*cli.Command{
			cmd.CommandHealthCheck(),
			cmd.CommandServe(),
			cmd.CommandJWTGen(),
			cmd.CommandGenDocs(),
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
