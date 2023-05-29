package config

import (
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const (
	flagSkipPatches = "skip-patches"
)

func CommandShow() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "show",
		Aliases: []string{},
		Usage:   "Shows configuration after applying jsonpatches and resolving secrets",
		Action:  commandShow,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagSkipPatches,
				Usage:   "Skip applying jsonpatches",
				Value:   false,
				EnvVars: []string{"NHOST_SKIP_PATCHES"},
			},
		},
	}
}

func commandShow(c *cli.Context) error {
	ce := clienv.FromCLI(c)

	cfg, err := Validate(ce, !c.Bool(flagSkipPatches))
	if err != nil {
		return err
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("error marshalling config: %w", err)
	}

	ce.Println(string(b))
	return nil
}
