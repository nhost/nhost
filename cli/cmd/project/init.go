package project

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/hashicorp/go-getter"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
	"gopkg.in/yaml.v3"
)

const (
	flagRemote = "remote"
)

//go:embed templates/init/*
var embeddedFS embed.FS

func writeFiles(ps *clienv.PathStructure, root, relPath string) error {
	dirEntries, err := embeddedFS.ReadDir(filepath.Join(root, relPath))
	if err != nil {
		return fmt.Errorf("failed to read dir: %w", err)
	}

	for _, entry := range dirEntries {
		if entry.IsDir() {
			return writeFiles(ps, root, filepath.Join(relPath, entry.Name()))
		}

		src := filepath.Join(root, relPath, entry.Name())

		fileData, err := fs.ReadFile(embeddedFS, src)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", src, err)
		}

		dst := filepath.Join(ps.Root(), relPath, entry.Name())

		f, err := os.OpenFile(
			filepath.Join(ps.Root(), dst),
			os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0o600, //nolint:mnd
		)
		if err != nil {
			return fmt.Errorf("failed to open file %s: %w", dst, err)
		}
		defer f.Close()

		if _, err := f.Write(fileData); err != nil {
			return fmt.Errorf("failed to write file %s: %w", dst, err)
		}
	}

	return nil
}

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
				Sources: cli.EnvVars("NHOST_REMOTE"),
			},
		},
	}
}

func commandInit(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if clienv.PathExists(ce.Path.NhostFolder()) {
		return errors.New("nhost folder already exists") //nolint:err113
	}

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	ce.Infoln("Initializing Nhost project")

	if err := config.InitConfigAndSecrets(ce); err != nil {
		return fmt.Errorf("failed to initialize configuration: %w", err)
	}

	if cmd.Bool(flagRemote) {
		if err := InitRemote(ctx, ce); err != nil {
			return fmt.Errorf("failed to initialize remote project: %w", err)
		}
	} else {
		if err := initInit(ctx, ce.Path); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	ce.Infoln("Successfully initialized Nhost project, run `nhost up` to start development")

	return nil
}

func initInit(
	ctx context.Context, ps *clienv.PathStructure,
) error {
	hasuraConf := map[string]any{"version": hasuraMetadataVersion}
	if err := clienv.MarshalFile(hasuraConf, ps.HasuraConfig(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
	}

	if err := initFolders(ps); err != nil {
		return err
	}

	if err := writeFiles(ps, "templates/init", ""); err != nil {
		return err
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

func initFolders(ps *clienv.PathStructure) error {
	folders := []string{
		ps.DotNhostFolder(),
		filepath.Join(ps.Root(), "functions"),
		filepath.Join(ps.NhostFolder(), "migrations", "default"),
		filepath.Join(ps.NhostFolder(), "metadata"),
		filepath.Join(ps.NhostFolder(), "seeds"),
		filepath.Join(ps.NhostFolder(), "emails"),
	}
	for _, f := range folders {
		if err := os.MkdirAll(f, 0o755); err != nil { //nolint:mnd
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

	cfg, err := config.Pull(ctx, ce, proj, true)
	if err != nil {
		return fmt.Errorf("failed to pull config: %w", err)
	}

	if err := initInit(ctx, ce.Path); err != nil {
		return err
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	hasuraAdminSecret, err := cl.GetHasuraAdminSecret(ctx, proj.ID)
	if err != nil {
		return fmt.Errorf("failed to get hasura admin secret: %w", err)
	}

	hasuraEndpoint := fmt.Sprintf(
		"https://%s.hasura.%s.nhost.run", proj.Subdomain, proj.Region.Name,
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
		ce.LocalSubdomain(),
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

	ce.Infoln("Downloading metadata...")

	if err := docker.HasuraWrapper(
		ctx,
		ce.LocalSubdomain(),
		ce.Path.NhostFolder(),
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
