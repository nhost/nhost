package project

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/dockercompose"
	emailtemplates "github.com/nhost/nhost/services/auth/email-templates"
	"github.com/urfave/cli/v3"
	"gopkg.in/yaml.v3"
)

const (
	flagRemote = "remote"
)

//go:embed templates/init/*
var embeddedFS embed.FS

func writeFS(srcFS fs.FS, srcRoot, dstRoot string) error {
	return fs.WalkDir( //nolint:wrapcheck
		srcFS,
		srcRoot,
		func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return fmt.Errorf("failed to walk %s: %w", p, err)
			}

			rel, err := filepath.Rel(srcRoot, p)
			if err != nil {
				return fmt.Errorf("failed to compute relative path for %s: %w", p, err)
			}

			dst := filepath.Join(dstRoot, rel)

			if d.IsDir() {
				if err := os.MkdirAll(dst, 0o755); err != nil { //nolint:mnd
					return fmt.Errorf("failed to create dir %s: %w", dst, err)
				}

				return nil
			}

			data, err := fs.ReadFile(srcFS, p)
			if err != nil {
				return fmt.Errorf("failed to read file %s: %w", p, err)
			}

			if err := os.WriteFile(dst, data, 0o600); err != nil { //nolint:mnd
				return fmt.Errorf("failed to write file %s: %w", dst, err)
			}

			return nil
		},
	)
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
		if err := initInit(ce.Path); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	ce.Infoln("Successfully initialized Nhost project, run `nhost up` to start development")

	return nil
}

func initInit(ps *clienv.PathStructure) error {
	hasuraConf := map[string]any{"version": hasuraMetadataVersion}
	if err := clienv.MarshalFile(hasuraConf, ps.HasuraConfig(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
	}

	if err := initFolders(ps); err != nil {
		return err
	}

	if err := writeFS(embeddedFS, "templates/init", ps.Root()); err != nil {
		return fmt.Errorf("failed to write project files: %w", err)
	}

	if err := writeFS(
		emailtemplates.FS,
		".",
		filepath.Join(ps.NhostFolder(), "emails"),
	); err != nil {
		return fmt.Errorf("failed to write email templates: %w", err)
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

	if err := initInit(ce.Path); err != nil {
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
