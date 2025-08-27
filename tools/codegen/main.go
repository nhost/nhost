package main

import (
	"context"
	"log"
	"os"

	"github.com/nhost/nhost/tools/codegen/cmd/gen"
	"github.com/urfave/cli/v3"
)

var Version string

func main() {
	cmd := &cli.Command{ //nolint:exhaustruct
		Name:    "boom",
		Version: Version,
		Usage:   "make an explosive entrance",
		Commands: []*cli.Command{
			gen.Command(),
		},
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}
