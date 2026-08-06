package config

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const flagJSON = "json"

func CommandShow() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:        "show",
		Aliases:     []string{},
		Usage:       "Shows configuration after resolving secrets",
		Description: "Note that this command will always use the local secrets, even if you specify subdomain",
		Action:      commandShow,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Show this subdomain's rendered configuration. Defaults to base configuration",
				Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagJSON,
				Usage: "Output as JSON",
			},
		},
	}
}

func commandShow(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cfg, err := Validate(ce, cmd.String(flagSubdomain), secrets)
	if err != nil {
		return err
	}

	if cmd.Bool(flagJSON) {
		return showJSON(cfg)
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("error marshalling config: %w", err)
	}

	ce.Println("%s", b)

	return nil
}

func showJSON(cfg *model.ConfigConfig) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")

	if err := enc.Encode(cfg); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}
