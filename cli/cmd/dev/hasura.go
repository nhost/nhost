package dev

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

func CommandHasura() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:            "hasura",
		Aliases:         []string{},
		Usage:           "hasura-cli wrapper",
		Action:          commandHasura,
		Flags:           []cli.Flag{},
		SkipFlagParsing: true,
	}
}

func commandHasura(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	docker := dockercompose.NewDocker()

	return docker.HasuraWrapper( //nolint:wrapcheck
		ctx,
		ce.LocalSubdomain(),
		ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		cmd.Args().Slice()...,
	)
}
