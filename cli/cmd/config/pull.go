package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/project"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/nhost/nhost/cli/system"
	"github.com/nhost/nhost/cli/tui"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

const (
	DefaultHasuraGraphqlAdminSecret = "nhost-admin-secret" //nolint:gosec
	DefaultGraphqlJWTSecret         = "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db"
	DefaultNhostWebhookSecret       = "nhost-webhook-secret" //nolint:gosec
)

const (
	flagYes = "yes"
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
				Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Usage:   "Skip confirmation",
				Sources: cli.EnvVars("NHOST_YES"),
			},
		},
	}
}

func commandPull(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if !clienv.PathExists(ce.Path.NhostFolder()) {
		return errors.New( //nolint:err113
			"nhost folder not found. Please run `nhost init --remote` first to initialize your project",
		)
	}

	skipConfirmation := cmd.Bool(flagYes)

	if !skipConfirmation {
		if err := verifyFile(ce, ce.Path.NhostToml()); err != nil {
			return err
		}
	}

	writeSecrets := true

	if !skipConfirmation {
		if err := verifyFile(ce, ce.Path.Secrets()); err != nil {
			writeSecrets = false
		}
	}

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	_, err = Pull(ctx, ce, proj, writeSecrets)

	return err
}

func verifyFile(ce *clienv.CliEnv, name string) error {
	if !clienv.PathExists(name) {
		return nil
	}

	if term.IsTerminal(int(os.Stdout.Fd())) {
		confirmed, err := tui.RunConfirm(
			fmt.Sprintf("Overwrite %s?", name),
		)
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}

		if !confirmed {
			return errors.New("operation cancelled") //nolint:err113
		}

		return nil
	}

	ce.PromptMessage("%s",
		name+" already exists. Do you want to overwrite it? [y/N] ",
	)

	resp, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if resp != "y" && resp != "Y" {
		return errors.New("operation cancelled") //nolint:err113
	}

	return nil
}

func respToSecrets(env []*graphql.GetSecrets_AppSecrets, anonymize bool) model.Secrets {
	secrets := make(model.Secrets, len(env))
	for i, s := range env {
		if anonymize {
			s = anonymizeSecret(s)
		}

		secrets[i] = &model.ConfigEnvironmentVariable{
			Name:  s.Name,
			Value: s.Value,
		}
	}

	return secrets
}

func anonymizeSecret(
	s *graphql.GetSecrets_AppSecrets,
) *graphql.GetSecrets_AppSecrets {
	clone := *s

	switch clone.Name {
	case "HASURA_GRAPHQL_ADMIN_SECRET":
		clone.Value = DefaultHasuraGraphqlAdminSecret
	case "HASURA_GRAPHQL_JWT_SECRET":
		clone.Value = DefaultGraphqlJWTSecret
	case "NHOST_WEBHOOK_SECRET":
		clone.Value = DefaultNhostWebhookSecret
	case "NHOST_JWT_PUBLIC_KEY":
		clone.Value = project.DefaultPubKey
	case "NHOST_JWT_PRIVATE_KEY":
		clone.Value = project.DefaultPrivKey
	case "NHOST_JWT_KID":
		clone.Value = project.DefaultNhostKID
	default:
		clone.Value = "FIXME"
	}

	return &clone
}

func pullSecrets(
	ctx context.Context,
	ce *clienv.CliEnv,
	proj *graphql.AppSummaryFragment,
) error {
	ce.Infoln("Getting secrets list from Nhost...")

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	resp, err := cl.GetSecrets(
		ctx,
		proj.ID,
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
	proj *graphql.AppSummaryFragment,
	writeSecrts bool,
) (*model.ConfigConfig, error) {
	ce.Infoln("Pulling config from Nhost...")

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get nhost client: %w", err)
	}

	cfg, err := cl.GetConfigRawJSON(
		ctx,
		proj.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	var v model.ConfigConfig
	if err := json.Unmarshal([]byte(cfg.ConfigRawJSON), &v); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return nil, fmt.Errorf("failed to create nhost directory: %w", err)
	}

	if err := clienv.MarshalFile(v, ce.Path.NhostToml(), toml.Marshal); err != nil {
		return nil, fmt.Errorf("failed to save nhost.toml: %w", err)
	}

	if writeSecrts {
		if err := pullSecrets(ctx, ce, proj); err != nil {
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
