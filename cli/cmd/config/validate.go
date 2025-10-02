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
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
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
				Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
			},
		},
	}
}

func commandValidate(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	subdomain := cmd.String(flagSubdomain)
	if subdomain != "" && subdomain != "local" {
		proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
		if err != nil {
			return fmt.Errorf("failed to get app info: %w", err)
		}

		_, _, err = ValidateRemote(
			ctx,
			ce,
			proj.GetSubdomain(),
			proj.GetID(),
		)

		return err
	}

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	ce.Infoln("Verifying configuration...")

	if _, err := Validate(ce, "local", secrets); err != nil {
		return err
	}

	ce.Infoln("Configuration is valid!")

	return nil
}

func ApplyJSONPatches[T any](
	cfg T,
	overlayPath string,
) (*T, error) {
	f, err := os.Open(overlayPath)
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

	var r T
	if err := json.Unmarshal(cfgb, &r); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &r, nil
}

func Validate(
	ce *clienv.CliEnv,
	subdomain string,
	secrets model.Secrets,
) (*model.ConfigConfig, error) {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	if clienv.PathExists(ce.Path.Overlay(subdomain)) {
		var err error

		cfg, err = ApplyJSONPatches(*cfg, ce.Path.Overlay(subdomain))
		if err != nil {
			return nil, fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	schema, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	cfg, err = appconfig.SecretsResolver(cfg, secrets, schema.Fill)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	return cfg, nil
}

// ValidateRemote validates the configuration of a remote project by fetching
// the secrets and applying them to the configuration. It also applies any
// JSON patches from the overlay directory if it exists.
// It returns the original configuration with the applied patches (without being filled
// and without secrets resolved) and another configuration filled and with secrets resolved.
func ValidateRemote(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain string,
	appID string,
) (*model.ConfigConfig, *model.ConfigConfig, error) {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), cfg, toml.Unmarshal); err != nil {
		return nil, nil, fmt.Errorf("failed to parse config: %w", err)
	}

	if clienv.PathExists(ce.Path.Overlay(subdomain)) {
		var err error

		cfg, err = ApplyJSONPatches(*cfg, ce.Path.Overlay(subdomain))
		if err != nil {
			return nil, nil, fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	schema, err := schema.New()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create schema: %w", err)
	}

	ce.Infoln("Getting secrets...")

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get nhost client: %w", err)
	}

	secretsResp, err := cl.GetSecrets(
		ctx,
		appID,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get secrets: %w", err)
	}

	secrets := respToSecrets(secretsResp.GetAppSecrets(), false)

	cfgSecrets, err := appconfig.SecretsResolver(cfg, secrets, schema.Fill)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Infoln("Config is valid!")

	return cfg, cfgSecrets, nil
}
