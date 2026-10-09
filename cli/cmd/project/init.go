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
	return writeFSExcept(srcFS, srcRoot, dstRoot, nil)
}

// writeFSExcept copies a tree, leaving out the source paths named in skip
// along with everything under them. Paths in skip are as they appear in srcFS,
// so they are slash-separated whatever the host.
func writeFSExcept(srcFS fs.FS, srcRoot, dstRoot string, skip map[string]bool) error {
	return fs.WalkDir( //nolint:wrapcheck
		srcFS,
		srcRoot,
		func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return fmt.Errorf("failed to walk %s: %w", p, err)
			}

			if skip[p] {
				if d.IsDir() {
					return fs.SkipDir
				}

				return nil
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
	// Held here rather than read back through the command, so the action sees
	// exactly what the parser set.
	tv := new(templateValue)

	return &cli.Command{ //nolint:exhaustruct
		Name:    "init",
		Aliases: []string{},
		Usage:   "Initialize a new Nhost project",
		Action: func(ctx context.Context, cmd *cli.Command) error {
			return commandInit(ctx, cmd, tv)
		},
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagRemote,
				Usage:   "Initialize pulling configuration, migrations and metadata from the linked project",
				Value:   false,
				Sources: cli.EnvVars("NHOST_REMOTE"),
			},
			&cli.GenericFlag{ //nolint:exhaustruct
				Name: flagTemplate,
				// Backticks here are urfave's placeholder syntax, not Markdown:
				// the first quoted span becomes the flag's value name in help.
				// Only NAME may carry them, or the flag renders as its own usage
				// text, as in `--template --template NAME`.
				Usage: "Add a starter frontend next to the backend. `NAME` picks one; a bare --template lists them",
				Value: tv,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagAuthMethods,
				Usage:   authMethodsUsage(),
				Value:   defaultAuthMethods,
				Sources: cli.EnvVars("NHOST_AUTH_METHODS"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagUI,
				Usage:   uiUsage(),
				Value:   defaultUI,
				Sources: cli.EnvVars("NHOST_UI"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagNavigation,
				Usage:   navUsage(),
				Value:   defaultNavigation,
				Sources: cli.EnvVars("NHOST_NAVIGATION"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagPackageManager,
				Usage:   packageManagerUsage(),
				Value:   defaultPackageManager,
				Sources: cli.EnvVars("NHOST_PACKAGE_MANAGER"),
			},
		},
	}
}

func commandInit(ctx context.Context, cmd *cli.Command, tv *templateValue) error {
	ce := clienv.FromCLI(cmd)

	// Everything that can refuse runs before anything is written, so a typo
	// or a cancelled picker leaves the directory as it was.
	template, asked, err := resolveTemplate(ce, cmd, tv)
	if err != nil {
		return err
	}

	choices, err := resolveTemplateChoices(ce, cmd, template, asked)
	if err != nil {
		return err
	}

	// The same predicate the hard fail used, so --nhost-folder is honoured.
	hasBackend := clienv.PathExists(ce.Path.NhostFolder())

	if hasBackend && template == "" {
		return errors.New("nhost folder already exists") //nolint:err113
	}

	var layout templateLayout
	if template != "" {
		if layout, err = planTemplate(ce.Path, template); err != nil {
			return err
		}
	}

	configures := writesAuthConfig(hasBackend, cmd.Bool(flagRemote))

	if hasBackend {
		// An existing backend is left exactly as it is: no config is rewritten
		// for the template, which is why the next steps name what to enable.
		ce.Infoln("Found an existing Nhost project, adding only the %s template", template)
	} else if err := initBackend(
		ctx, ce, cmd, template, choices.methods, configures,
	); err != nil {
		return err
	}

	if template == "" {
		ce.Infoln("Successfully initialized Nhost project, run `nhost up` to start development")

		return nil
	}

	if err := writeTemplate(
		ce.Path, template, layout,
		choices.methods, choices.ui, choices.nav, choices.pm,
	); err != nil {
		return err
	}

	printKeptEntries(ce, layout)

	printTemplateNextSteps(
		ce, template, missingConfig(ce, template, choices.methods, configures), choices.pm,
	)

	return nil
}

// templateChoices is what a template is scaffolded with. Without a template
// every field is its zero value.
type templateChoices struct {
	ui      uiSystem
	nav     navigationSystem
	pm      packageManager
	methods []signInMethod
}

// resolveTemplateChoices answers the questions that follow the template. The
// order these run in is the order the questions are asked: what to build it
// with before what it does, since the stack is the decision the rest sit
// inside.
func resolveTemplateChoices(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	asked bool,
) (templateChoices, error) {
	ui, err := resolveUISystem(ce, cmd, template, asked)
	if err != nil {
		return templateChoices{}, err
	}

	nav, err := resolveNavigationSystem(ce, cmd, template, asked)
	if err != nil {
		return templateChoices{}, err
	}

	pm, err := resolvePackageManager(ce, cmd, template, asked)
	if err != nil {
		return templateChoices{}, err
	}

	methods, err := resolveAuthMethods(ce, cmd, template, asked)
	if err != nil {
		return templateChoices{}, err
	}

	return templateChoices{ui: ui, nav: nav, pm: pm, methods: methods}, nil
}

// writesAuthConfig says whether init writes the settings the selected sign-in
// methods need. It does only into the config it generates for a fresh local
// backend: an existing backend's is left as it is, and --remote takes the
// linked project's as it was pulled.
func writesAuthConfig(hasBackend, remote bool) bool {
	return !hasBackend && !remote
}

// initBackend writes a fresh backend: the nhost folder, its configuration and
// secrets, and either the local layout or one pulled from the linked project.
// configures says whether what the template and the selected methods need goes
// into the config.
func initBackend(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	methods []signInMethod,
	configures bool,
) error {
	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	ce.Infoln("Initializing Nhost project")

	tmpl, _ := lookupTemplate(template)

	var configure []func(*model.ConfigConfig)
	if configures {
		configure = append(authMethodConfigure(methods), allowRedirects(tmpl.redirectURLs))
	}

	if err := config.InitConfigAndSecrets(ce, configure...); err != nil {
		return fmt.Errorf("failed to initialize configuration: %w", err)
	}

	if cmd.Bool(flagRemote) {
		if err := InitRemote(ctx, ce); err != nil {
			return fmt.Errorf("failed to initialize remote project: %w", err)
		}

		return nil
	}

	if err := initProject(ce.Path); err != nil {
		return fmt.Errorf("failed to initialize project: %w", err)
	}

	if configures {
		if err := writeLocalRedirects(ce.Path, tmpl.localRedirectURLs); err != nil {
			return fmt.Errorf("failed to initialize project: %w", err)
		}
	}

	return nil
}

// initProject scaffolds the local project layout at the given path, creating
// every folder it writes into, including the nhost folder itself.
func initProject(ps *clienv.PathStructure) error {
	if err := initFolders(ps); err != nil {
		return err
	}

	hasuraConf := map[string]any{"version": hasuraMetadataVersion}
	if err := clienv.MarshalFile(hasuraConf, ps.HasuraConfig(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
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
	ep, err := ce.ResolveProject(ctx, "")
	if err != nil {
		return fmt.Errorf("failed to resolve project: %w", err)
	}

	cfg, err := config.Pull(ctx, ce, ep.App, true)
	if err != nil {
		return fmt.Errorf("failed to pull config: %w", err)
	}

	if err := initProject(ce.Path); err != nil {
		return err
	}

	adminSecret, err := ep.AdminSecret(ctx)
	if err != nil {
		return fmt.Errorf("failed to get admin secret: %w", err)
	}

	if err := deploy(ctx, ce, cfg, ep.HasuraURL, adminSecret); err != nil {
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

	hostUser, err := dockercompose.ResolveHostUser(ctx, os.Getenv("NHOST_DOCKER_USER"))
	if err != nil {
		return fmt.Errorf("failed to resolve NHOST_DOCKER_USER: %w", err)
	}

	ce.Infoln("Creating postgres migration")

	if err := docker.HasuraWrapper(
		ctx,
		ce.LocalSubdomain(),
		ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		hostUser,
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
		hostUser,
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
