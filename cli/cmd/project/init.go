package project

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/hashicorp/go-getter/v2"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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

		if err := writeEmbeddedFile(ps, root, relPath, entry); err != nil {
			return err
		}
	}

	return nil
}

func writeEmbeddedFile(
	ps *clienv.PathStructure,
	root, relPath string,
	entry fs.DirEntry,
) error {
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
		return errors.New("project already initialized. To reinitialize, remove the nhost/ folder first") //nolint:err113
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
		if err := initInit(ctx, ce); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	ce.Infoln("Successfully initialized, run `nhost up` to start development")

	return nil
}

func initInit(ctx context.Context, ce *clienv.CliEnv) error {
	if term.IsTerminal(int(os.Stdout.Fd())) {
		return initInitTUI(ctx, ce)
	}

	return initInitPlain(ctx, ce)
}

func initInitTUI(ctx context.Context, ce *clienv.CliEnv) error {
	return tui.RunSteps([]tui.Step{
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
				return writeFiles(ce.Path, "templates/init", "")
			},
		},
		{
			Name: "Downloading email templates",
			Fn: func() error {
				return downloadEmailTemplates(ctx)
			},
		},
	}) //nolint:wrapcheck
}

func initInitPlain(ctx context.Context, ce *clienv.CliEnv) error {
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

	if err := writeFiles(ce.Path, "templates/init", ""); err != nil {
		return err
	}

	ce.Infoln("Downloading email templates...")

	if err := downloadEmailTemplates(ctx); err != nil {
		return err
	}

	return nil
}

func downloadEmailTemplates(ctx context.Context) error {
	getclient := &getter.Client{}                    //nolint:exhaustruct
	if _, err := getclient.Get(ctx, &getter.Request{ //nolint:exhaustruct
		Src:             "git::https://github.com/nhost/nhost.git//services/auth/email-templates",
		Dst:             "nhost/emails",
		DisableSymlinks: true,
	}); err != nil {
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
	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, "")
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cfg, err := config.Pull(ctx, ce, proj, true)
	if err != nil {
		return fmt.Errorf("failed to pull config: %w", err)
	}

	if err := initInit(ctx, ce); err != nil {
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
