package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/v2/nhostclient/credentials"
	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/project/env"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
	"github.com/pelletier/go-toml/v2"
)

const (
	DefaultHasuraGraphqlAdminSecret = "nhost-admin-secret" //nolint:gosec
	DefaultGraphqlJWTSecret         = "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db"
	DefaultNhostWebhookSecret       = "nhost-webhook-secret" //nolint:gosec
)

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

func configPull(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	proj *graphql.GetWorkspacesApps_Workspaces_Apps,
	session credentials.Session,
) error {
	p.Println(tui.Info("Pulling config from Nhost..."))
	cfg, err := cl.GetConfigRawJSON(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	var v model.ConfigConfig
	if err := json.Unmarshal([]byte(cfg.ConfigRawJSON), &v); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if err := os.MkdirAll(system.PathNhost(), 0o755); err != nil { //nolint:gomnd
		return fmt.Errorf("failed to create nhost directory: %w", err)
	}

	if err := MarshalFile(v, system.PathConfig(), toml.Marshal); err != nil {
		return fmt.Errorf("failed to save nhost.toml: %w", err)
	}

	p.Println(tui.Info("Getting secrets list from Nhost..."))
	resp, err := cl.GetSecrets(ctx, proj.ID, graphql.WithAccessToken(session.Session.AccessToken))
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	secrets := respToSecrets(resp.GetAppSecrets(), true)
	if err := MarshalFile(&secrets, system.PathSecrets(), env.Marshal); err != nil {
		return fmt.Errorf("failed to save nhost.toml: %w", err)
	}

	p.Println(tui.Info("Adding .secrets to .gitignore..."))
	if err := system.AddToGitignore("\n.secrets\n"); err != nil {
		return fmt.Errorf("failed to add .secrets to .gitignore: %w", err)
	}

	p.Println(tui.Info("Success!"))
	p.Println(
		tui.Warn(
			"- Review `nhost/nhost.toml` and make sure there are no secrets before you commit it to git.",
		),
	)
	p.Println(tui.Warn("- Review `.secrets` file and set your development secrets"))
	p.Println(tui.Warn("- Review `.secrets` was added to .gitignore"))

	return nil
}

func ConfigPull(
	ctx context.Context,
	p Printer,
	cl NhostClient,
) error {
	proj, err := GetAppInfo(ctx, p, cl)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	return configPull(ctx, p, cl, proj, session)
}
