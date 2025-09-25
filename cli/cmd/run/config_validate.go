package run

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/nhostclient"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const (
	flagConfig      = "config"
	flagOverlayName = "overlay-name"
)

func CommandConfigValidate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-validate",
		Aliases: []string{},
		Usage:   "Validates service configuration after resolving secrets",
		Action:  commandConfigValidate,
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
				EnvVars: []string{"NHOST_SERVICE_OVERLAY_NAME"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagServiceID,
				Usage:   "If specified, apply this overlay and remote secrets for this service",
				EnvVars: []string{"NHOST_RUN_SERVICE_ID"},
			},
		},
	}
}

func respToSecrets(env []*graphql.GetSecrets_AppSecrets) model.Secrets {
	secrets := make(model.Secrets, len(env))
	for i, s := range env {
		secrets[i] = &model.ConfigEnvironmentVariable{
			Name:  s.Name,
			Value: s.Value,
		}
	}

	return secrets
}

func loadConfig(
	path string,
) (*model.ConfigRunServiceConfig, error) {
	cfg := &model.ConfigRunServiceConfig{} //nolint:exhaustruct

	r, err := os.Open(path)
	if err != nil {
		return cfg, fmt.Errorf("failed to open file: %w", err)
	}
	defer r.Close()

	decoder := toml.NewDecoder(r)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(cfg); err != nil {
		return cfg, fmt.Errorf("failed to parse config: %w", err)
	}

	return cfg, nil
}

func getAppIDFromServiceID(
	ctx context.Context,
	cl *nhostclient.Client,
	serviceID string,
) (string, error) {
	resp, err := cl.GetRunServiceInfo(
		ctx,
		serviceID,
	)
	if err != nil {
		return "", fmt.Errorf("failed to get app info from service id: %w", err)
	}

	return resp.GetRunService().GetAppID(), nil
}

func Validate(
	ce *clienv.CliEnv,
	configPath string,
	overlayName string,
	secrets model.Secrets,
	testSecretsOnly bool,
) (*model.ConfigRunServiceConfig, error) {
	cfg, err := loadConfig(configPath)
	if err != nil {
		return nil, err
	}

	if clienv.PathExists(ce.Path.RunServiceOverlay(configPath, overlayName)) {
		cfg, err = config.ApplyJSONPatches(*cfg, ce.Path.RunServiceOverlay(configPath, overlayName))
		if err != nil {
			return nil, fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	schema, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	cfgSecretsResolved, err := appconfig.SecretsResolver(cfg, secrets, schema.FillRunServiceConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	if !testSecretsOnly {
		cfg = cfgSecretsResolved
	}

	return cfg, nil
}

func getRemoteSecrets(
	ctx context.Context,
	cl *nhostclient.Client,
	serviceID string,
) (model.Secrets, string, error) {
	appID, err := getAppIDFromServiceID(ctx, cl, serviceID)
	if err != nil {
		return nil, "", err
	}

	secretsResp, err := cl.GetSecrets(
		ctx,
		appID,
	)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get secrets: %w", err)
	}

	return respToSecrets(secretsResp.GetAppSecrets()), appID, nil
}

func commandConfigValidate(cCtx *cli.Context) error {
	var (
		overlayName string
		serviceID   string
	)

	switch {
	case cCtx.String(flagServiceID) != "" && cCtx.String(flagOverlayName) != "":
		return errors.New("cannot specify both service id and overlay name") //nolint:err113
	case cCtx.String(flagServiceID) != "":
		serviceID = cCtx.String(flagServiceID)
		overlayName = serviceID
	case cCtx.String(flagOverlayName) != "":
		overlayName = cCtx.String(flagOverlayName)
	}

	ce := clienv.FromCLI(cCtx)

	var secrets model.Secrets

	ce.Infoln("Getting secrets...")

	if serviceID != "" {
		cl, err := ce.GetNhostClient(cCtx.Context)
		if err != nil {
			return fmt.Errorf("failed to get nhost client: %w", err)
		}

		secrets, _, err = getRemoteSecrets(cCtx.Context, cl, serviceID)
		if err != nil {
			return err
		}
	} else {
		if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
			return fmt.Errorf(
				"failed to parse secrets, make sure secret values are between quotes: %w",
				err,
			)
		}
	}

	ce.Infoln("Verifying configuration...")

	if _, err := Validate(
		ce,
		cCtx.String(flagConfig),
		overlayName,
		secrets,
		false,
	); err != nil {
		return err
	}

	ce.Infoln("Configuration is valid!")

	return nil
}
