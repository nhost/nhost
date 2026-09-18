// Package create implements `nhost create`, which scaffolds a new Nhost
// project: it resolves the template, project name, target directory and
// package manager (from flags, or by asking), materialises the template
// alongside a generated backend, and installs the frontend's dependencies.
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
	flagName           = "name"
	flagPackageManager = "package-manager"
	flagYes            = "yes"
	flagNoInstall      = "no-install"
	flagTemplatePath   = "template-path"
	flagTemplatesRepo  = "templates-repo"
	flagTemplatesRef   = "templates-ref"

	defaultClientURL      = "http://localhost:3000"
	defaultPackageManager = "pnpm"
	// defaultProjectName is what a create that was told neither a name nor a
	// directory calls the project, and so the directory it makes for it.
	defaultProjectName = "nhost-starter-app"

	// stagingPrefix names the directory the project is built in before it is
	// moved into place. It sits inside the target, so the name has to be one
	// nothing else would claim.
	stagingPrefix = ".nhost-create.partial-"
)

var errNameRequired = errors.New(
	"could not name the project after the target directory; pass --name",
)

var errTargetConflict = errors.New("would overwrite existing files")

// Command returns the `nhost create` command.
func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "create",
		Usage:     "Create a new Nhost project from a template",
		ArgsUsage: "[directory]",
		Description: "Scaffolds into [directory] when one is given, otherwise into a " +
			"directory named after the project, or into the current directory when " +
			"that is already its name. The directory is created if it does not exist, " +
			"and files already in it are left alone unless the template would " +
			"overwrite them.",
		Action: action,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name: flagName,
				Usage: fmt.Sprintf(
					"Project name, and the directory it lands in (default: %s, or [directory]'s name)",
					defaultProjectName,
				),
				Value: "",
			},
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

	if !res.answered.dir {
		resolved = retarget(resolved)
	}

	// validateChoices already rejected unknown templates.
	tmpl, _ := lookupTemplate(resolved.template)

	target := resolved.dir

	// Which directories are ours decides who cleans them up: one the user
	// already had is never removed, however the create ends. MkdirAll makes the
	// missing parents too -- `nhost create projects/my-app` may be making
	// projects/ as well -- so the topmost one it has to make is where the
	// unwind stops.
	madeRoot := topmostMissingDir(target)

	if err := os.MkdirAll(target, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create %s: %w", target, err)
	}

	success := false

	defer func() {
		if !success {
			removeMadeDirs(target, madeRoot)
		}
	}()

	// An interactive run closed its frame by saying this, under the answers it
	// is made of, so it is only worth saying here when nothing was asked. The
	// same line is what the spinner animates, which is why the frame left it
	// undrawn for this to own.
	if !res.prompt {
		ce.Infoln("Creating Nhost project %q from template %q", resolved.name, tmpl.name)
	}

	prog := newProgress(ce, res.prompt, "Creating "+resolved.name)
	defer prog.stop()

	if err := stageProject(
		ctx, prog, cmd, tmpl, resolved.name, target, resolved.packageManager,
	); err != nil {
		return err
	}

	// installNow ends up meaning what the rest of the command needs it to mean:
	// the frontend has its dependencies. An install that failed leaves the
	// project in the same shape --no-install would have, so the next steps have
	// to include the install again.
	resolved.installNow = installFrontendDependencies(ctx, ce, prog, resolved, target)

	success = true

	// Settle the closing line before the result is printed, so the frame is
	// finished above what the create has to say rather than after it.
	prog.stop()
	printNextSteps(ce, resolved, cmd.Root().Version)

	return nil
}

// topmostMissingDir is the highest directory os.MkdirAll would have to create
// on the way to target, or "" when target is already there. It bounds what a
// failed create may remove: everything from target up to it is this command's
// doing, and everything above it was the user's already.
func topmostMissingDir(target string) string {
	highest := ""

	for dir := target; ; {
		// Only a directory that is definitely missing counts as ours. A stat
		// that failed for any other reason leaves the unwind short rather than
		// claiming a directory this command may not have made.
		if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
			break
		}

		highest = dir

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}

		dir = parent
	}

	return highest
}

// removeMadeDirs takes back the directories a failed create made, leaf first,
// from target up to and including root.
//
// os.Remove, never RemoveAll: it only succeeds on an empty directory, so
// anything left behind -- staged files, or work the user put there meanwhile --
// stops the unwind and surfaces rather than being deleted.
func removeMadeDirs(target, root string) {
	if root == "" {
		return
	}

	for dir := target; ; {
		if err := os.Remove(dir); err != nil {
			return
		}

		if dir == root {
			return
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}

		dir = parent
	}
}

// installFrontendDependencies reports whether the frontend ended up with its
// dependencies. A failed install is a warning rather than a failed create: the
// project is on disk either way.
func installFrontendDependencies(
	ctx context.Context,
	ce *clienv.CliEnv,
	prog progress,
	resolved choices,
	target string,
) bool {
	if !resolved.installNow {
		return false
	}

	// A package manager draws its own progress, on the same line a spinner is
	// redrawing, so the spinner settles and hands the terminal over before the
	// install starts. What it draws is worth the handover: this is the longest
	// wait in a create, and the only one that reports how far along it is.
	if prog.animating() {
		prog.stop()
		ce.Println("")
	}

	ce.Infoln("Installing frontend dependencies with %s...", resolved.packageManager)

	if err := runInstallFn(
		ctx, resolved.packageManager, filepath.Join(target, "frontend"),
	); err != nil {
		ce.Warnln(
			"Could not install dependencies (%v). Run `%s install` in %s yourself.",
			err, resolved.packageManager, resolved.path("frontend"),
		)

		return false
	}

	return true
}

func stageProject(
	ctx context.Context,
	prog progress,
	cmd *cli.Command,
	tmpl template,
	name, target, packageManager string,
) error {
	// Staging lives inside the target so that finalizing is a rename per entry
	// on one filesystem, and so a create that fails leaves nothing behind
	// anywhere but the directory it was pointed at.
	staging, err := os.MkdirTemp(target, stagingPrefix+"*")
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

	if err := addTemplate(ctx, prog, cmd, tmpl, staging); err != nil {
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

	if err := adoptStaging(staging, target); err != nil {
		return err
	}

	if err := os.Remove(staging); err != nil {
		return fmt.Errorf("failed to clean up staging directory: %w", err)
	}

	success = true

	return nil
}

// adoptStaging moves the staged project into the target directory. Scaffolding
// into a directory that already holds files is the point, so the check is per
// entry rather than "is it empty": a .git, a README or notes are left alone,
// and only a name the template would land on top of stops the create. The
// whole check runs before the first move, so a refusal leaves the directory
// exactly as it was.
func adoptStaging(staging, target string) error {
	entries, err := os.ReadDir(staging)
	if err != nil {
		return fmt.Errorf("failed to read staged project: %w", err)
	}

	conflicts := make([]string, 0, len(entries))

	for _, entry := range entries {
		if clienv.PathExists(filepath.Join(target, entry.Name())) {
			conflicts = append(conflicts, entry.Name())
		}
	}

	if len(conflicts) > 0 {
		return fmt.Errorf(
			"cannot scaffold into %s: %w: %s",
			target, errTargetConflict, strings.Join(conflicts, ", "),
		)
	}

	for _, entry := range entries {
		if err := os.Rename(
			filepath.Join(staging, entry.Name()),
			filepath.Join(target, entry.Name()),
		); err != nil {
			return fmt.Errorf("failed to move %s into place: %w", entry.Name(), err)
		}
	}

	return nil
}

func addTemplate(
	ctx context.Context,
	prog progress,
	cmd *cli.Command,
	tmpl template,
	staging string,
) error {
	if local := cmd.String(flagTemplatePath); local != "" {
		src, err := localTemplateDir(local)
		if err != nil {
			return err
		}

		prog.update("using local template at %s", local)

		if err := copyDir(src, staging); err != nil {
			return fmt.Errorf("failed to copy template: %w", err)
		}

		return nil
	}

	ref := cmd.String(flagTemplatesRef)
	if ref == "" {
		ref = defaultTemplatesRef(cmd.Root().Version)
	}

	prog.update("fetching template %q at %s...", tmpl.name, ref)

	return fetchTemplate(
		ctx,
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

// runInstallFn is the seam the install tests replace, so that the warn-rather
// -than-fail contract can be exercised without a package manager on PATH.
var runInstallFn = runInstall //nolint:gochecknoglobals // test seam for the install step

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

func printNextSteps(ce *clienv.CliEnv, resolved choices, version string) {
	ce.Println("")
	ce.Infoln("Created %s in %s", resolved.name, resolved.where())
	ce.Println("")
	ce.Println("Next steps:")
	printStartCommands(ce, resolved, nhostCommand(version))
}

// nhostCommand is how the next steps spell this CLI. A released build is on the
// PATH under its own name, so `nhost` is what to say. A development build is
// not: `nhost` there is whatever release the user installed, and one older than
// the project name file names the compose project after the directory it runs
// in, so the containers come up called backend-* rather than after the project.
// A dev build names itself, so the commands handed back are the ones that were
// just used to scaffold.
func nhostCommand(version string) string {
	if version != devVersion {
		return "nhost"
	}

	exe, err := os.Executable()
	if err != nil {
		return "nhost"
	}

	return exe
}

// printStartCommands prints the two commands that bring the project up, in the
// order it needs them: the backend first, because the frontend renders against
// its GraphQL API.
//
// Running them is left to the user. They own the two processes either way, so
// starting them here would only take away the terminal that stops them.
func printStartCommands(ce *clienv.CliEnv, resolved choices, nhost string) {
	devCommand := packageManagerScript(resolved.packageManager, "dev")

	// Each step is a block with air around it: the two are run in different
	// terminals, and the blank lines are what say where one ends.
	ce.Println("  1. Start the backend:")
	ce.Println("       cd %s && %s up", resolved.path("backend"), nhost)
	ce.Println("")
	ce.Println("  2. In another terminal, start the frontend:")

	if resolved.installNow {
		ce.Println("       cd %s && %s", resolved.path("frontend"), devCommand)
	} else {
		ce.Println(
			"       cd %s && %s install && %s",
			resolved.path("frontend"), resolved.packageManager, devCommand,
		)
	}

	ce.Println("")
}
