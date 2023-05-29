package config

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
	jsonpatch "gopkg.in/evanphx/json-patch.v5"
	"gopkg.in/yaml.v3"
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
	ce := clienv.FromCLI(cCtx)

	if cCtx.Bool(flagRemote) {
		return ValidateRemote(
			cCtx.Context,
			ce,
		)
	}

	ce.Infoln("Verifying configuration...")
	if _, err := Validate(ce, true); err != nil {
		return err
	}
	ce.Infoln("Configuration is valid!")
	return nil
}

func applyJSONPatches(ce *clienv.CliEnv, cfg *model.ConfigConfig) (*model.ConfigConfig, error) {
	var y any
	if err := clienv.UnmarshalFile(ce.Path.JSONPatches(), &y, yaml.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse json patches: %w", err)
	}

	b, err := json.Marshal(y)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal json patches: %w", err)
	}

	patch, err := jsonpatch.DecodePatch(b)
	if err != nil {
		return nil, fmt.Errorf("failed to decode json patches: %w", err)
	}

	b, err = json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	b, err = patch.Apply(b)
	if err != nil {
		return nil, fmt.Errorf("failed to apply json patches: %w", err)
	}

	cfg = &model.ConfigConfig{} //nolint:exhaustruct
	if err := json.Unmarshal(b, cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return cfg, nil
}

func Validate(ce *clienv.CliEnv, applyPatches bool) (*model.ConfigConfig, error) {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse secrets: %w", err)
	}

	if applyPatches && clienv.PathExists(ce.Path.JSONPatches()) {
		var err error
		cfg, err = applyJSONPatches(ce, cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	schema, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	cfg, err = appconfig.Config(schema, cfg, secrets)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

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
