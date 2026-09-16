package create

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	cmdproject "github.com/nhost/nhost/cli/cmd/project"
	"github.com/nhost/nhost/cli/project"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

const (
	flagTemplate       = "template"
	flagPackageManager = "package-manager"
	flagYes            = "yes"
	flagNoInstall      = "no-install"
	flagStart          = "start"
	flagTemplatePath   = "template-path"
	flagTemplatesRepo  = "templates-repo"
	flagTemplatesRef   = "templates-ref"

	defaultClientURL      = "http://localhost:3000"
	defaultPackageManager = "pnpm"
)

var errNameRequired = errors.New(
	"project name is required (usage: nhost create <name>)",
)

var errStartNeedsInstall = errors.New(
	"--start needs the frontend dependencies, so it cannot be used with --no-install",
)

// Command returns the `nhost create` command.
func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "create",
		Usage:     "Create a new Nhost project from a template",
		ArgsUsage: "[name]",
		Action:    action,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagTemplate,
				Aliases: []string{"t"},
				Usage: fmt.Sprintf(
					"Template to scaffold (available: %s)",
					strings.Join(templateNames(), ", "),
				),
				Value: defaultTemplate,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name: flagPackageManager,
				Usage: fmt.Sprintf(
					"Package manager for the frontend (%s)",
					strings.Join(packageManagers(), ", "),
				),
				Value: defaultPackageManager,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Aliases: []string{"y", "skip-prompts"},
				Usage:   "Accept defaults and skip all prompts",
				Value:   false,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagNoInstall,
				Usage: "Skip installing frontend dependencies",
				Value: false,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagStart,
				Usage: "Start the backend and the frontend dev server once the project is created",
				Value: false,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagTemplatePath,
				Usage: "Use a local template directory instead of downloading (offline/dev)",
				Value: "",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagTemplatesRepo,
				Usage:   "Git repository to fetch templates from",
				Value:   defaultTemplatesRepo,
				Sources: cli.EnvVars("NHOST_CREATE_TEMPLATES_REPO"),
				Hidden:  true,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagTemplatesRef,
				Usage:   "Git ref to fetch templates from (default: this CLI's release tag)",
				Value:   "",
				Sources: cli.EnvVars("NHOST_CREATE_TEMPLATES_REF"),
				Hidden:  true,
			},
		},
	}
}

func action(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	interactive := term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd()))

	res, err := resolveChoices(cmd, interactive)
	if err != nil {
		return err
	}

	resolved := res.choices

	if res.prompt {
		if resolved, err = runInteractive(ce, resolved, res.answered); err != nil {
			return err
		}

		if resolved, err = validateChoices(resolved); err != nil {
			return err
		}
	}

	// validateChoices already rejected unknown templates.
	tmpl, _ := lookupTemplate(resolved.template)

	wd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to determine working directory: %w", err)
	}

	target := filepath.Join(wd, resolved.name)
	if clienv.PathExists(target) {
		return fmt.Errorf("destination %q already exists", resolved.name) //nolint:err113
	}

	ce.Infoln("Creating Nhost project %q from template %q", resolved.name, tmpl.name)

	if err := stageProject(
		ctx, ce, cmd, tmpl, resolved.name, target, resolved.packageManager,
	); err != nil {
		return err
	}

	// installNow ends up meaning what the rest of the command needs it to mean:
	// the frontend has its dependencies. An install that failed leaves the
	// project in the same shape --no-install would have, so there is nothing to
	// offer to start and the next steps have to include the install again.
	resolved.installNow = installFrontendDependencies(ctx, ce, resolved, target)

	if resolved.startNow, err = confirmStart(
		ce, resolved, res.prompt && !res.answered.startNow,
	); err != nil {
		return err
	}

	if resolved.startNow {
		return startServers(ctx, ce, cmd.Root().Version, resolved, target)
	}

	printNextSteps(ce, resolved)

	return nil
}

// confirmStart settles whether to start the servers. The question comes after
// the install rather than with the other prompts so that it is asked about a
// project that is ready to run, and --start answers it up front for a run that
// should not stop to ask.
func confirmStart(ce *clienv.CliEnv, resolved choices, ask bool) (bool, error) {
	if !resolved.installNow {
		return false, nil
	}

	if !ask {
		return resolved.startNow, nil
	}

	return runConfirm(ce, "Start backend and frontend?", true)
}

// installFrontendDependencies reports whether the frontend ended up with its
// dependencies. A failed install is a warning rather than a failed create: the
// project is on disk either way.
func installFrontendDependencies(
	ctx context.Context,
	ce *clienv.CliEnv,
	resolved choices,
	target string,
) bool {
	if !resolved.installNow {
		return false
	}

	ce.Infoln("Installing frontend dependencies with %s...", resolved.packageManager)

	if err := runInstall(
		ctx, resolved.packageManager, filepath.Join(target, "frontend"),
	); err != nil {
		ce.Warnln(
			"Could not install dependencies (%v). Run `%s install` in %s/frontend yourself.",
			err, resolved.packageManager, resolved.name,
		)

		return false
	}

	return true
}

func stageProject(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
	tmpl template,
	name, target, packageManager string,
) error {
	staging, err := os.MkdirTemp(filepath.Dir(target), "."+name+".partial-*")
	if err != nil {
		return fmt.Errorf("failed to create staging directory: %w", err)
	}

	success := false
	defer func() {
		if !success {
			_ = os.RemoveAll(staging)
		}
	}()

	if err := os.Chmod(staging, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to set staging permissions: %w", err)
	}

	if err := scaffoldBackend(filepath.Join(staging, "backend"), name); err != nil {
		return fmt.Errorf("failed to scaffold backend: %w", err)
	}

	if err := addTemplate(ctx, ce, cmd, tmpl, staging); err != nil {
		return err
	}

	frontend := filepath.Join(staging, "frontend")
	if err := patchPackageJSONName(
		filepath.Join(frontend, "package.json"), strings.ToLower(name),
	); err != nil {
		return fmt.Errorf("failed to set project name: %w", err)
	}

	if packageManager != defaultPackageManager {
		// Best-effort: the pnpm lockfile is optional and the chosen manager
		// regenerates its own on install. A missing file is not an error here.
		if err := os.Remove(
			filepath.Join(frontend, "pnpm-lock.yaml"),
		); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("failed to remove pnpm-lock.yaml: %w", err)
		}

		// Skipped for pnpm so the generated context files stay byte-identical to
		// the template.
		if err := retargetPackageManagerDocs(staging, packageManager); err != nil {
			return fmt.Errorf("failed to adapt the project docs to %s: %w", packageManager, err)
		}
	}

	if err := os.Rename(staging, target); err != nil {
		return fmt.Errorf("failed to finalize project: %w", err)
	}

	success = true

	return nil
}

func addTemplate(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
	tmpl template,
	staging string,
) error {
	if local := cmd.String(flagTemplatePath); local != "" {
		src, err := localTemplateDir(local)
		if err != nil {
			return err
		}

		ce.Infoln("Using local template at %s", local)

		if err := copyDir(src, staging); err != nil {
			return fmt.Errorf("failed to copy template: %w", err)
		}

		return nil
	}

	ref := cmd.String(flagTemplatesRef)
	if ref == "" {
		ref = defaultTemplatesRef(cmd.Root().Version)
	}

	ce.Infoln("Fetching template %q at %s...", tmpl.name, ref)

	return fetchTemplate(
		ctx,
		ce,
		cmd.String(flagTemplatesRepo),
		ref,
		tmpl,
		staging,
	)
}

// localTemplateDir checks that a --template-path value is a directory and
// resolves it to a real path. Resolving matters because filepath.WalkDir does
// not follow a symlinked root, so a symlink to a template directory would
// otherwise copy nothing and only fail later against the staging path.
func localTemplateDir(local string) (string, error) {
	resolved, err := filepath.EvalSymlinks(local)
	if err != nil {
		return "", fmt.Errorf("failed to read --template-path %q: %w", local, err)
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return "", fmt.Errorf("failed to read --template-path %q: %w", local, err)
	}

	if !info.IsDir() {
		return "", fmt.Errorf("--template-path %q: %w", local, errTemplateNotDirectory)
	}

	return resolved, nil
}

func scaffoldBackend(root, name string) error {
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	if err := os.MkdirAll(ps.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	if err := clienv.WriteProjectName(ps.ProjectNameFile(), name); err != nil {
		return fmt.Errorf("failed to write project name: %w", err)
	}

	cfg, err := project.DefaultConfig()
	if err != nil {
		return fmt.Errorf("failed to build default config: %w", err)
	}

	enableEmailOTP(cfg)
	setClientURL(cfg, defaultClientURL)

	if err := clienv.MarshalFile(cfg, ps.NhostToml(), toml.Marshal); err != nil {
		return fmt.Errorf("failed to write nhost.toml: %w", err)
	}

	if err := clienv.MarshalFile(project.DefaultSecrets(), ps.Secrets(), env.Marshal); err != nil {
		return fmt.Errorf("failed to write secrets: %w", err)
	}

	if err := cmdproject.InitProject(ps); err != nil {
		return fmt.Errorf("failed to write project files: %w", err)
	}

	return nil
}

func enableEmailOTP(cfg *model.ConfigConfig) {
	if cfg.Auth == nil {
		cfg.Auth = &model.ConfigAuth{} //nolint:exhaustruct
	}

	if cfg.Auth.Method == nil {
		cfg.Auth.Method = &model.ConfigAuthMethod{} //nolint:exhaustruct
	}

	if cfg.Auth.Method.Otp == nil {
		cfg.Auth.Method.Otp = &model.ConfigAuthMethodOtp{} //nolint:exhaustruct
	}

	enabled := true
	cfg.Auth.Method.Otp.Email = &model.ConfigAuthMethodOtpEmail{Enabled: &enabled}
}

func setClientURL(cfg *model.ConfigConfig, url string) {
	if cfg.Auth == nil {
		cfg.Auth = &model.ConfigAuth{} //nolint:exhaustruct
	}

	if cfg.Auth.Redirections == nil {
		cfg.Auth.Redirections = &model.ConfigAuthRedirections{} //nolint:exhaustruct
	}

	cfg.Auth.Redirections.ClientUrl = &url
}

var nameRE = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

func validateName(name string) error {
	if !nameRE.MatchString(name) {
		return fmt.Errorf( //nolint:err113
			"invalid project name %q: start with a letter or number, then use letters, numbers, '.', '_' or '-'",
			name,
		)
	}

	return nil
}

// packageManagers lists the supported frontend package managers, most
// preferred first.
func packageManagers() []string {
	return []string{defaultPackageManager, "npm", "bun", "yarn"}
}

func validatePackageManager(pm string) error {
	if slices.Contains(packageManagers(), pm) {
		return nil
	}

	return fmt.Errorf( //nolint:err113
		"invalid package manager %q: use %s",
		pm, strings.Join(packageManagers(), ", "),
	)
}

func runInstall(ctx context.Context, pm, dir string) error {
	cmd := exec.CommandContext(ctx, pm, "install")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("`%s install` failed: %w", pm, err)
	}

	return nil
}

// packageManagerArgs is how pm spells `run <script>`, as argv. Everything that
// names or runs a script goes through it so the printed command and the one we
// execute cannot drift apart.
func packageManagerArgs(pm, script string) []string {
	if pm == defaultPackageManager {
		return []string{script}
	}

	return []string{"run", script}
}

func packageManagerScript(pm, script string) string {
	return fmt.Sprintf("%s %s", pm, strings.Join(packageManagerArgs(pm, script), " "))
}

func printNextSteps(ce *clienv.CliEnv, resolved choices) {
	ce.Println("")
	ce.Infoln("Created %s", resolved.name)
	ce.Println("")
	ce.Println("Next steps:")
	printStartCommands(ce, resolved)
}

// printStartCommands prints the two commands that bring the project up, in the
// order it needs them. Every path that stops short of running them prints this
// same pair, so what the user is told to run cannot drift from what `--start`
// would have done.
func printStartCommands(ce *clienv.CliEnv, resolved choices) {
	devCommand := packageManagerScript(resolved.packageManager, "dev")

	ce.Println("  1. Start the backend:")
	ce.Println("       cd %s/backend && nhost up", resolved.name)
	ce.Println("  2. In another terminal, start the frontend:")

	if resolved.installNow {
		ce.Println("       cd %s/frontend && %s", resolved.name, devCommand)
	} else {
		ce.Println(
			"       cd %s/frontend && %s install && %s",
			resolved.name, resolved.packageManager, devCommand,
		)
	}
}

// printAppURL is only true once something is serving, so it belongs to the
// paths that start the servers rather than to the ones that hand the commands
// back for the user to run later.
func printAppURL(ce *clienv.CliEnv) {
	ce.Println("")
	ce.Println("App: http://localhost:3000")
}
