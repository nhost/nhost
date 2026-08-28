package run

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "run",
		Aliases: []string{},
		Usage:   "Perform operations on Nhost Run",
		Commands: []*cli.Command{
			CommandConfigShow(),
			CommandConfigDeploy(),
			CommandConfigEdit(),
			CommandConfigEditImage(),
			CommandConfigPull(),
			CommandConfigValidate(),
			CommandConfigExample(),
			CommandEnv(),
		},
	}
}

// Repeated flag descriptions and file names.
const (
	ifSpecifiedApplyThisOverlay = "If specified, apply this overlay"
	serviceConfigurationFile    = "Service configuration file"
	nhostRunServiceToml         = "nhost-run-service.toml"
)
