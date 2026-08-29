package main

import (
	"log"
	"os"

	"github.com/nhost/nhost/services/ai/cmd"
	"github.com/urfave/cli/v2"
)

var Version string

func main() {
	app := &cli.App{ //nolint:exhaustruct
		Name:    "graphite",
		Version: Version,
		Usage:   "Nhost service for auto-embeddings and multi-provider agents",
		Commands: []*cli.Command{
			cmd.CommandHealthCheck(),
			cmd.CommandServe(),
			cmd.CommandJWTGen(),
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
