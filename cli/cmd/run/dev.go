package run

import (
	"fmt"
	"regexp"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/project/env"
	"github.com/urfave/cli/v2"
)

const (
	flagDevPrependExport = "prepend-export"
)

const dotenvEscapeRegex = `[\\\"!\$]`

func CommandEnv() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "env",
		Aliases: []string{},
		Usage:   "Outputs environment variables. Useful to generate .env files",
		Action:  commandConfigDev,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfig,
				Aliases: []string{},
				Usage:   "Service configuration file",
				Value:   "nhost-run-service.toml",
				EnvVars: []string{"NHOST_RUN_SERVICE_CONFIG"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagOverlayName,
				Usage:   "If specified, apply this overlay",
				EnvVars: []string{"NHOST_RUN_SERVICE_ID", "NHOST_SERVICE_OVERLAY_NAME"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDevPrependExport,
				Usage:   "Prepend 'export' to each line",
				EnvVars: []string{"NHOST_RuN_SERVICE_ENV_PREPEND_EXPORT"},
			},
		},
	}
}

func escape(s string) string {
	re := regexp.MustCompile(dotenvEscapeRegex)
	return re.ReplaceAllString(s, "\\$0")
}

func commandConfigDev(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cfg, err := Validate(
		ce,
		cCtx.String(flagConfig),
		cCtx.String(flagOverlayName),
		secrets,
		false,
	)
	if err != nil {
		return err
	}

	for _, v := range cfg.GetEnvironment() {
		value := escape(v.Value)
		if cCtx.Bool(flagDevPrependExport) {
			ce.Println("export %s=\"%s\"", v.Name, value)
		} else {
			ce.Println("%s=\"%s\"", v.Name, value)
		}
	}

	return nil
}
