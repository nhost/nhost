package create

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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
	flagTemplatePath   = "template-path"
	flagTemplatesRepo  = "templates-repo"
	flagTemplatesRef   = "templates-ref"

	defaultClientURL = "http://localhost:3000"
)

var errNameRequired = errors.New(
	"project name is required (usage: nhost create <name>)",
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
				Usage:   "Template to scaffold",
				Value:   defaultTemplate,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagPackageManager,
				Usage: "Package manager for the frontend (pnpm, npm or bun)",
				Value: "pnpm",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Aliases: []string{"y"},
				Usage:   "Skip prompts",
				Value:   false,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagNoInstall,
				Usage: "Skip installing frontend dependencies",
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
				Usage:   "Git ref to fetch templates from",
				Value:   defaultTemplatesRef,
				Sources: cli.EnvVars("NHOST_CREATE_TEMPLATES_REF"),
				Hidden:  true,
			},
		},
	}
}

func action(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	tmpl, ok := lookupTemplate(cmd.String(flagTemplate))
	if !ok {
		return fmt.Errorf( //nolint:err113
			"unknown template %q; available templates: %s",
			cmd.String(flagTemplate), strings.Join(templateNames(), ", "),
		)
	}

	packageManager := cmd.String(flagPackageManager)
	if err := validatePackageManager(packageManager); err != nil {
		return err
	}

	name, err := resolveName(ce, cmd.Args().First(), cmd.Bool(flagYes))
	if err != nil {
		return err
	}

	wd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to determine working directory: %w", err)
	}

	target := filepath.Join(wd, name)
	if clienv.PathExists(target) {
		return fmt.Errorf("destination %q already exists", name) //nolint:err113
	}

	ce.Infoln("Creating Nhost project %q from template %q", name, tmpl.Name)

	if err := stageProject(ctx, ce, cmd, tmpl, name, target, packageManager); err != nil {
		return err
	}

	if !cmd.Bool(flagNoInstall) {
		ce.Infoln("Installing frontend dependencies with %s...", packageManager)

		if err := runInstall(ctx, packageManager, filepath.Join(target, "frontend")); err != nil {
			ce.Warnln(
				"Could not install dependencies (%v). Run `%s install` in %s/frontend yourself.",
				err, packageManager, name,
			)
		}
	}

	printNextSteps(ce, name, packageManager, cmd.Bool(flagNoInstall))

	return nil
}

func stageProject(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
	tmpl Template,
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

	if err := scaffoldBackend(filepath.Join(staging, "backend")); err != nil {
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

	if packageManager != "pnpm" {
		_ = os.Remove(filepath.Join(frontend, "pnpm-lock.yaml"))
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
	tmpl Template,
	staging string,
) error {
	if local := cmd.String(flagTemplatePath); local != "" {
		ce.Infoln("Using local template at %s", local)

		if err := copyDir(local, staging); err != nil {
			return fmt.Errorf("failed to copy template: %w", err)
		}

		return nil
	}

	ce.Infoln("Fetching template %q...", tmpl.Name)

	return fetchTemplate(
		ctx,
		ce,
		cmd.String(flagTemplatesRepo),
		cmd.String(flagTemplatesRef),
		tmpl,
		staging,
	)
}

func scaffoldBackend(root string) error {
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	if err := os.MkdirAll(ps.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
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

var nameRE = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

func resolveName(ce *clienv.CliEnv, arg string, yes bool) (string, error) {
	name := strings.TrimSpace(arg)
	if name == "" {
		if yes || !term.IsTerminal(int(os.Stdin.Fd())) {
			return "", errNameRequired
		}

		ce.PromptMessage("Project name: ")

		input, err := ce.PromptInput(false)
		if err != nil {
			return "", fmt.Errorf("failed to read project name: %w", err)
		}

		name = strings.TrimSpace(input)
	}

	if err := validateName(name); err != nil {
		return "", err
	}

	return name, nil
}

func validateName(name string) error {
	if name == "" || name == "." || name == ".." || !nameRE.MatchString(name) {
		return fmt.Errorf( //nolint:err113
			"invalid project name %q: use letters, numbers, '.', '_' or '-'", name,
		)
	}

	return nil
}

func validatePackageManager(pm string) error {
	switch pm {
	case "pnpm", "npm", "bun":
		return nil
	default:
		return fmt.Errorf("invalid package manager %q: use pnpm, npm or bun", pm) //nolint:err113
	}
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

func printNextSteps(ce *clienv.CliEnv, name, pm string, noInstall bool) {
	projectName := strings.ToLower(name)

	ce.Println("")
	ce.Infoln("Created %s", name)
	ce.Println("")
	ce.Println("Next steps:")
	ce.Println("  1. Start the backend:")
	ce.Println("       cd %s/backend", name)
	ce.Println(
		"       export NHOST_PROJECT_NAME=%s   # isolates this project's local containers and database volume",
		projectName,
	)
	ce.Println("       nhost up")
	ce.Println("  2. In another terminal, start the frontend:")

	if noInstall {
		ce.Println("       cd %s/frontend && %s install && %s dev", name, pm, pm)
	} else {
		ce.Println("       cd %s/frontend && %s dev", name, pm)
	}

	ce.Println("")
	ce.Println(
		"After you change the schema, run `%s` in %s/frontend.",
		packageManagerScript(pm, "codegen"),
		name,
	)
	ce.Println(
		"The app runs on http://localhost:3000 and sign-in emails appear in the local mailbox.",
	)
	ce.Println(
		"Keep NHOST_PROJECT_NAME set (or pass --project-name) for `nhost up`/`down`/`logs` in this project.",
	)
}
