package config

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const (
	flagRemote = "remote"
)

func CommandValidate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "validate",
		Aliases: []string{},
		Usage:   "Validate configuration",
		Action:  commandValidate,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagRemote,
				Usage:   "Validate local configuration against remote projec",
				Value:   false,
				EnvVars: []string{"NHOST_REMOTE"},
			},
		},
	}
}

func commandValidate(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)

	if cCtx.Bool(flagRemote) {
		return ValidateRemote(
			cCtx.Context,
			ce,
		)
	}

	_, err := Validate(ce)
	return err
}

func Validate(ce *clienv.CliEnv) (*model.ConfigConfig, error) {
	ce.Infoln("Verifying configuration...")

	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse secrets: %w", err)
	}

	schema, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	cfg, err = appconfig.Config(schema, cfg, secrets)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Infoln("Configuration is valid!")

	return cfg, nil
}

func ValidateRemote(
	ctx context.Context,
	ce *clienv.CliEnv,
) error {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	schema, err := schema.New()
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	proj, err := ce.GetAppInfo(ctx)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	session, err := ce.LoadSession(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	ce.Infoln("Getting secrets...")
	cl := ce.GetNhostClient()
	secrets, err := cl.GetSecrets(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	_, err = appconfig.Config(schema, cfg, respToSecrets(secrets.GetAppSecrets(), false))
	if err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Infoln("Config is valid!")

	return nil
}
