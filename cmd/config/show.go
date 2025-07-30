package config

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

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
				EnvVars: []string{"NHOST_SUBDOMAIN"},
			},
		},
	}
}

func commandShow(c *cli.Context) error {
	ce := clienv.FromCLI(c)

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cfg, err := Validate(ce, c.String(flagSubdomain), secrets)
	if err != nil {
		return err
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("error marshalling config: %w", err)
	}

	ce.Println("%s", b)

	return nil
}
