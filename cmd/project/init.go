package project

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/hashicorp/go-getter"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/cmd/config"
	"github.com/nhost/cli/dockercompose"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/nhost/cli/system"
	"github.com/urfave/cli/v2"
	"gopkg.in/yaml.v3"
)

const (
	flagRemote = "remote"
)

const hasuraMetadataVersion = 3

func CommandInit() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "init",
		Aliases: []string{},
		Usage:   "Initialize a new Nhost project",
		Action:  commandInit,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagRemote,
				Usage:   "Initialize pulling configuration, migrations and metadata from the linked project",
				Value:   false,
				EnvVars: []string{"NHOST_REMOTE"},
			},
		},
	}
}

func commandInit(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if clienv.PathExists(ce.Path.NhostFolder()) {
		return fmt.Errorf("nhost folder already exists") //nolint:goerr113
	}

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:gomnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	ce.Infoln("Initializing Nhost project")
	if err := config.InitConfigAndSecrets(ce); err != nil {
		return fmt.Errorf("failed to initialize configuration: %w", err)
	}

	if cCtx.Bool(flagRemote) {
		if err := InitRemote(cCtx.Context, ce); err != nil {
			return fmt.Errorf("failed to initialize remote project: %w", err)
		}
	} else {
		if err := initInit(cCtx.Context, ce.Path); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	ce.Infoln("Successfully initialized Nhost project, run `nhost up` to start development")
	return nil
}

func initInit(
	ctx context.Context, fs *clienv.PathStructure,
) error {
	hasuraConf := map[string]any{"version": hasuraMetadataVersion}
	if err := clienv.MarshalFile(hasuraConf, fs.HasuraConfig(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
	}

	if err := initFolders(fs); err != nil {
		return err
	}

	gitingoref, err := os.OpenFile(".gitignore", os.O_RDWR|os.O_CREATE, 0o600) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("failed to open .gitignore file: %w", err)
	}
	defer gitingoref.Close()

	if err := system.AddToGitignore(".secrets\n"); err != nil {
		return fmt.Errorf("failed to add secrets to .gitignore: %w", err)
	}

	if err := system.AddToGitignore(".nhost\n"); err != nil {
		return fmt.Errorf("failed to add .nhost to .gitignore: %w", err)
	}

	getclient := &getter.Client{ //nolint:exhaustruct
		Ctx:  ctx,
		Src:  "github.com/nhost/hasura-auth/email-templates",
		Dst:  "nhost/emails",
		Mode: getter.ClientModeAny,
		Detectors: []getter.Detector{
			&getter.GitHubDetector{},
		},
	}

	if err := getclient.Get(); err != nil {
		return fmt.Errorf("failed to download email templates: %w", err)
	}

	return nil
}

func initFolders(fs *clienv.PathStructure) error {
	folders := []string{
		fs.DotNhostFolder(),
		filepath.Join(fs.Root(), "functions"),
		filepath.Join(fs.NhostFolder(), "migrations", "default"),
		filepath.Join(fs.NhostFolder(), "metadata"),
		filepath.Join(fs.NhostFolder(), "seeds"),
		filepath.Join(fs.NhostFolder(), "emails"),
	}
	for _, f := range folders {
		if err := os.MkdirAll(f, 0o755); err != nil { //nolint:gomnd
			return fmt.Errorf("failed to create folder %s: %w", f, err)
		}
	}

	return nil
}

func InitRemote(
	ctx context.Context,
	ce *clienv.CliEnv,
) error {
	proj, err := ce.GetAppInfo(ctx, "")
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	session, err := ce.LoadSession(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	cfg, err := config.Pull(ctx, ce, proj, session, true)
	if err != nil {
		return fmt.Errorf("failed to pull config: %w", err)
	}

	if err := initInit(ctx, ce.Path); err != nil {
		return err
	}

	cl := ce.GetNhostClient()
	hasuraAdminSecret, err := cl.GetHasuraAdminSecret(
		ctx, proj.ID, graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get hasura admin secret: %w", err)
	}

	hasuraEndpoint := fmt.Sprintf(
		"https://%s.hasura.%s.%s", proj.Subdomain, proj.Region.AwsName, ce.Domain(),
	)

	if err := deploy(
		ctx, ce, cfg, hasuraEndpoint, hasuraAdminSecret.App.Config.Hasura.AdminSecret,
	); err != nil {
		return fmt.Errorf("failed to deploy: %w", err)
	}

	ce.Infoln("Project initialized successfully!")
	return nil
}

func deploy(
	ctx context.Context,
	ce *clienv.CliEnv,
	cfg *model.ConfigConfig,
	hasuraEndpoint string,
	hasuraAdminSecret string,
) error {
	docker := dockercompose.NewDocker()
	ce.Infoln("Creating postgres migration")
	if err := docker.HasuraWrapper(
		ctx,
		ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		"migrate", "create", "init", "--from-server", "--schema", "public",
		"--database-name", "default",
		"--skip-update-check",
		"--log-level", "ERROR",
		"--endpoint", hasuraEndpoint,
		"--admin-secret", hasuraAdminSecret,
	); err != nil {
		return fmt.Errorf("failed to create postgres migration: %w", err)
	}

	ce.Infoln("Downloading metadata")
	if err := docker.HasuraWrapper(
		ctx, ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		"metadata", "export",
		"--skip-update-check",
		"--log-level", "ERROR",
		"--endpoint", hasuraEndpoint,
		"--admin-secret", hasuraAdminSecret,
	); err != nil {
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	return nil
}
