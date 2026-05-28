package main

import (
	"context"
	"log"
	"os"

	"github.com/nhost/nhost/tools/ghactivity/cmd/report"
	"github.com/urfave/cli/v3"
)

var Version string

func main() {
	// Invoked as `gh activity` once installed with `gh extension install`.
	cmd := &cli.Command{ //nolint:exhaustruct
		Name:    "activity",
		Version: Version,
		Usage:   "Generate a markdown report of a user's GitHub activity in an org over a time range.",
		Flags:   report.Flags(),
		Action:  report.Action,
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}
