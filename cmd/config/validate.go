package config

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
	jsonpatch "gopkg.in/evanphx/json-patch.v5"
)

func CommandValidate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "validate",
		Aliases: []string{},
		Usage:   "Validate configuration",
		Action:  commandValidate,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Validate this subdomain's configuration. Defaults to linked project",
				EnvVars: []string{"NHOST_SUBDOMAIN"},
			},
		},
	}
}

func commandValidate(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	subdomain := cCtx.String(flagSubdomain)
	if subdomain != "" && subdomain != "local" {
		return ValidateRemote(
			cCtx.Context,
			ce,
			cCtx.String(flagSubdomain),
		)
	}

	ce.Infoln("Verifying configuration...")
	if _, err := Validate(ce, "local"); err != nil {
		return err
	}
	ce.Infoln("Configuration is valid!")
	return nil
}

func applyJSONPatches(
	ce *clienv.CliEnv,
	cfg model.ConfigConfig,
	subdomain string,
) (*model.ConfigConfig, error) {
	f, err := os.Open(ce.Path.Overlay(subdomain))
	if err != nil {
		return nil, fmt.Errorf("failed to open json patches file: %w", err)
	}
	defer f.Close()

	patchesb, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("failed to read json patches file: %w", err)
	}

	cfgb, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	patch, err := jsonpatch.DecodePatch(patchesb)
	if err != nil {
		return nil, fmt.Errorf("failed to apply json patches: %w", err)
	}

	cfgb, err = patch.Apply(cfgb)
	if err != nil {
		return nil, fmt.Errorf("failed to apply json patches: %w", err)
	}

	cfg = model.ConfigConfig{} //nolint:exhaustruct
	if err := json.Unmarshal(cfgb, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

func Validate(ce *clienv.CliEnv, subdomain string) (*model.ConfigConfig, error) {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return nil, fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	if clienv.PathExists(ce.Path.Overlay(subdomain)) {
		var err error
		cfg, err = applyJSONPatches(ce, *cfg, subdomain)
		if err != nil {
			return nil, fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	schema, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	cfg, err = appconfig.SecretsResolver[model.ConfigConfig](cfg, secrets, schema.Fill)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	return cfg, nil
}

func ValidateRemote(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain string,
) error {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	schema, err := schema.New()
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	proj, err := ce.GetAppInfo(ctx, subdomain)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	session, err := ce.LoadSession(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	ce.Infoln("Getting secrets...")
	cl := ce.GetNhostClient()
	secretsResp, err := cl.GetSecrets(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	if clienv.PathExists(ce.Path.Overlay(proj.GetSubdomain())) {
		var err error
		cfg, err = applyJSONPatches(ce, *cfg, proj.GetSubdomain())
		if err != nil {
			return fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	secrets := respToSecrets(secretsResp.GetAppSecrets(), false)
	_, err = appconfig.SecretsResolver[model.ConfigConfig](cfg, secrets, schema.Fill)
	if err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Infoln("Config is valid!")

	return nil
}
