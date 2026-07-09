package project

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/tui"
	emailtemplates "github.com/nhost/nhost/services/auth/email-templates"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
	"gopkg.in/yaml.v3"
)

const (
	flagRemote = "remote"
)

var errAlreadyInitialized = errors.New(
	"project already initialized. To reinitialize, remove the nhost/ folder first",
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

func writeProjectFiles(ps *clienv.PathStructure) error {
	if err := writeFS(embeddedFS, "templates/init", ps.Root()); err != nil {
		return fmt.Errorf("failed to write project files: %w", err)
	}

	return nil
}

func writeEmailTemplates(ps *clienv.PathStructure) error {
	if err := writeFS(
		emailtemplates.FS,
		".",
		filepath.Join(ps.NhostFolder(), "emails"),
	); err != nil {
		return fmt.Errorf("failed to write email templates: %w", err)
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
				Usage:   "Initialize pulling configuration, migrations and metadata from the remote project",
				Value:   false,
				Sources: cli.EnvVars("NHOST_REMOTE"),
			},
		},
	}
}

func commandInit(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if clienv.PathExists(ce.Path.NhostFolder()) {
		return errAlreadyInitialized
	}

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	if err := config.InitConfigAndSecrets(ce); err != nil {
		return fmt.Errorf("failed to initialize configuration: %w", err)
	}

	if cmd.Bool(flagRemote) {
		if err := InitRemote(ctx, ce); err != nil {
			return fmt.Errorf("failed to initialize remote project: %w", err)
		}
	} else {
		if err := initInit(ce); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	ce.Infoln("Successfully initialized, run `nhost up` to start development")

	return nil
}

func initInit(ce *clienv.CliEnv) error {
	if term.IsTerminal(int(os.Stdout.Fd())) {
		return initInitTUI(ce)
	}

	return initInitPlain(ce)
}

func initInitTUI(ce *clienv.CliEnv) error {
	return tui.RunSteps([]tui.Step{ //nolint:wrapcheck
		{
			Name: "Creating project structure",
			Fn: func() error {
				return initFolders(ce.Path)
			},
		},
		{
			Name: "Initializing Hasura",
			Fn: func() error {
				hasuraConf := map[string]any{"version": hasuraMetadataVersion}

				return clienv.MarshalFile(
					hasuraConf, ce.Path.HasuraConfig(), yaml.Marshal,
				)
			},
		},
		{
			Name: "Writing default configuration",
			Fn: func() error {
				return writeProjectFiles(ce.Path)
			},
		},
		{
			Name: "Writing email templates",
			Fn: func() error {
				return writeEmailTemplates(ce.Path)
			},
		},
	})
}

func initInitPlain(ce *clienv.CliEnv) error {
	ce.Infoln("Creating project structure...")

	if err := initFolders(ce.Path); err != nil {
		return err
	}

	ce.Infoln("Initializing Hasura...")

	hasuraConf := map[string]any{"version": hasuraMetadataVersion}
	if err := clienv.MarshalFile(hasuraConf, ce.Path.HasuraConfig(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
	}

	ce.Infoln("Writing default configuration...")

	if err := writeProjectFiles(ce.Path); err != nil {
		return err
	}

	ce.Infoln("Writing email templates...")

	if err := writeEmailTemplates(ce.Path); err != nil {
		return err
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
	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, "")
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	if term.IsTerminal(int(os.Stdout.Fd())) {
		return initRemoteTUI(ctx, ce, proj)
	}

	return initRemotePlain(ctx, ce, proj)
}

func initRemoteTUI(
	ctx context.Context,
	ce *clienv.CliEnv,
	proj *graphql.AppSummaryFragment,
) error {
	var cfg *model.ConfigConfig

	// Suppress ce output during TUI — config.Pull prints status internally
	ce.SetStdout(io.Discard)
	defer ce.SetStdout(os.Stdout)

	return tui.RunSteps([]tui.Step{ //nolint:wrapcheck
		{
			Name: "Pulling configuration from cloud",
			Fn: func() error {
				var err error

				cfg, err = config.Pull(ctx, ce, proj, true)
				if err != nil {
					return fmt.Errorf("failed to pull config: %w", err)
				}

				return nil
			},
		},
		{
			Name: "Creating project structure",
			Fn:   func() error { return initFolders(ce.Path) },
		},
		{
			Name: "Initializing Hasura",
			Fn: func() error {
				c := map[string]any{"version": hasuraMetadataVersion}
				return clienv.MarshalFile(c, ce.Path.HasuraConfig(), yaml.Marshal)
			},
		},
		{
			Name: "Writing default configuration",
			Fn:   func() error { return writeProjectFiles(ce.Path) },
		},
		{
			Name: "Writing email templates",
			Fn:   func() error { return writeEmailTemplates(ce.Path) },
		},
		{
			Name: "Creating migrations",
			Fn: func() error {
				return deployRemote(ctx, ce, cfg, proj)
			},
		},
	})
}

func initRemotePlain(
	ctx context.Context,
	ce *clienv.CliEnv,
	proj *graphql.AppSummaryFragment,
) error {
	ce.Infoln("Pulling configuration from cloud...")

	cfg, err := config.Pull(ctx, ce, proj, true)
	if err != nil {
		return fmt.Errorf("failed to pull config: %w", err)
	}

	if err := initInitPlain(ce); err != nil {
		return err
	}

	ce.Infoln("Creating migrations...")

	if err := deployRemote(ctx, ce, cfg, proj); err != nil {
		return err
	}

	return nil
}

func deployRemote(
	ctx context.Context,
	ce *clienv.CliEnv,
	cfg *model.ConfigConfig,
	proj *graphql.AppSummaryFragment,
) error {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	hasuraAdminSecret, err := cl.GetHasuraAdminSecret(ctx, proj.ID)
	if err != nil {
		return fmt.Errorf("failed to get hasura admin secret: %w", err)
	}

	return deploy(
		ctx, ce, cfg,
		clienv.NhostHasuraURL(proj.Subdomain, proj.Region.Name),
		hasuraAdminSecret.App.Config.Hasura.AdminSecret,
	)
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
