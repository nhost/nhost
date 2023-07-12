package config

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/credentials"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/nhost/cli/project/env"
	"github.com/nhost/cli/system"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const (
	DefaultHasuraGraphqlAdminSecret = "nhost-admin-secret" //nolint:gosec
	DefaultGraphqlJWTSecret         = "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db"
	DefaultNhostWebhookSecret       = "nhost-webhook-secret" //nolint:gosec
)

func CommandPull() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "pull",
		Aliases: []string{},
		Usage:   "Get cloud configuration",
		Action:  commandPull,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Pull this subdomain's configuration. Defaults to linked project",
				EnvVars: []string{"NHOST_SUBDOMAIN"},
			},
		},
	}
}

func commandPull(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if err := verifyFile(ce, ce.Path.NhostToml()); err != nil {
		return err
	}

	writeSecrets := true
	if err := verifyFile(ce, ce.Path.Secrets()); err != nil {
		writeSecrets = false
	}

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	session, err := ce.LoadSession(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}
	_, err = Pull(cCtx.Context, ce, proj, session, writeSecrets)
	return err
}

func verifyFile(ce *clienv.CliEnv, name string) error {
	if clienv.PathExists(name) {
		ce.PromptMessage(
			fmt.Sprintf("%s already exists. Do you want to overwrite it? [y/N] ", name),
		)
		resp, err := ce.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}
		if resp != "y" && resp != "Y" {
			return fmt.Errorf("aborting") //nolint:goerr113
		}
	}
	return nil
}

func respToSecrets(env []*graphql.GetSecrets_AppSecrets, anonymize bool) model.Secrets {
	secrets := make(model.Secrets, len(env))
	for i, s := range env {
		if anonymize {
			switch s.Name {
			case "HASURA_GRAPHQL_ADMIN_SECRET":
				s.Value = DefaultHasuraGraphqlAdminSecret
			case "HASURA_GRAPHQL_JWT_SECRET":
				s.Value = DefaultGraphqlJWTSecret
			case "NHOST_WEBHOOK_SECRET":
				s.Value = DefaultNhostWebhookSecret
			default:
				s.Value = "FIXME"
			}
		}
		secrets[i] = &model.ConfigEnvironmentVariable{
			Name:  s.Name,
			Value: s.Value,
		}
	}
	return secrets
}

func pullSecrets(
	ctx context.Context,
	ce *clienv.CliEnv,
	proj *graphql.GetWorkspacesApps_Workspaces_Apps,
	session credentials.Session,
) error {
	ce.Infoln("Getting secrets list from Nhost...")
	cl := ce.GetNhostClient()
	resp, err := cl.GetSecrets(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	secrets := respToSecrets(resp.GetAppSecrets(), true)
	if err := clienv.MarshalFile(&secrets, ce.Path.Secrets(), env.Marshal); err != nil {
		return fmt.Errorf("failed to save nhost.toml: %w", err)
	}

	ce.Infoln("Adding .secrets to .gitignore...")
	if err := system.AddToGitignore("\n.secrets\n"); err != nil {
		return fmt.Errorf("failed to add .secrets to .gitignore: %w", err)
	}

	return nil
}

func Pull(
	ctx context.Context,
	ce *clienv.CliEnv,
	proj *graphql.GetWorkspacesApps_Workspaces_Apps,
	session credentials.Session,
	writeSecrts bool,
) (*model.ConfigConfig, error) {
	ce.Infoln("Pulling config from Nhost...")

	cl := ce.GetNhostClient()
	cfg, err := cl.GetConfigRawJSON(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	var v model.ConfigConfig
	if err := json.Unmarshal([]byte(cfg.ConfigRawJSON), &v); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:gomnd
		return nil, fmt.Errorf("failed to create nhost directory: %w", err)
	}

	if err := clienv.MarshalFile(v, ce.Path.NhostToml(), toml.Marshal); err != nil {
		return nil, fmt.Errorf("failed to save nhost.toml: %w", err)
	}

	if writeSecrts {
		if err := pullSecrets(ctx, ce, proj, session); err != nil {
			return nil, err
		}
	}

	ce.Infoln("Success!")
	ce.Warnln(
		"- Review `nhost/nhost.toml` and make sure there are no secrets before you commit it to git.",
	)
	ce.Warnln("- Review `.secrets` file and set your development secrets")
	ce.Warnln("- Review `.secrets` was added to .gitignore")

	return &v, nil
}
