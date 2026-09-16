package create

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

type choices struct {
	template string
	name     string
	// dir is the absolute directory the project is scaffolded into, and rel
	// is that directory as typed from where the command ran. rel is empty when
	// they are the same place, which is the default.
	dir            string
	rel            string
	packageManager string
	installNow     bool
	startNow       bool
}

// path spells one of the project's directories the way the user would type it
// from where they ran the command.
func (c choices) path(sub string) string {
	if c.rel == "" {
		return sub
	}

	return filepath.Join(c.rel, sub)
}

// where names the directory the project landed in, for prose rather than for a
// command to copy.
func (c choices) where() string {
	switch {
	case c.rel == "":
		return "the current directory"
	case filepath.IsAbs(c.rel):
		return c.rel
	default:
		return "." + string(filepath.Separator) + c.rel
	}
}

// answered records which choices the command line already made. A value passed
// as a flag or an argument is an answer, so the interactive flow asks about
// what is left rather than asking the same question twice.
type answered struct {
	template       bool
	name           bool
	dir            bool
	packageManager bool
	startNow       bool
}

// resolution is where the command line leaves things before any prompt runs.
type resolution struct {
	choices  choices
	answered answered
	prompt   bool
}

// resolveTarget turns the directory argument into the absolute path to
// scaffold into, plus how to refer to it from where the command ran. An empty
// argument means the current directory, which is the common case: you make a
// directory, cd into it, and create there.
func resolveTarget(arg string) (string, string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", "", fmt.Errorf("failed to determine working directory: %w", err)
	}

	if arg == "" {
		return wd, "", nil
	}

	dir, err := filepath.Abs(arg)
	if err != nil {
		return "", "", fmt.Errorf("failed to resolve %q: %w", arg, err)
	}

	if dir == wd {
		return dir, "", nil
	}

	rel, err := filepath.Rel(wd, dir)
	if err != nil {
		return dir, dir, nil //nolint:nilerr // an absolute path is still printable
	}

	return dir, rel, nil
}

// nameFromDir derives a project name from the directory's own name, keeping
// what validateName accepts and replacing the rest. Anything that cannot start
// a name is dropped until the first letter or digit, so "_tmp" becomes "tmp"
// and "my project" becomes "my-project". An empty result means the directory
// name has nothing usable in it and the name has to come from somewhere else.
func nameFromDir(dir string) string {
	var b strings.Builder

	for _, r := range filepath.Base(dir) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
		case b.Len() == 0:
			continue
		case r == '.' || r == '_' || r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}

	return strings.TrimRight(b.String(), "._-")
}

// resolveChoices seeds the choices from flags and reports what is left to ask.
// Without a terminal, or with --yes, every value has to come from flags and
// arguments.
func resolveChoices(cmd *cli.Command, interactive bool) (resolution, error) {
	dir, rel, err := resolveTarget(cmd.Args().First())
	if err != nil {
		return resolution{}, err
	}

	resolved := choices{
		template:       cmd.String(flagTemplate),
		name:           cmd.String(flagName),
		dir:            dir,
		rel:            rel,
		packageManager: cmd.String(flagPackageManager),
		installNow:     !cmd.Bool(flagNoInstall),
		startNow:       cmd.Bool(flagStart),
	}

	given := answered{
		template:       cmd.IsSet(flagTemplate),
		name:           resolved.name != "",
		dir:            cmd.Args().First() != "",
		packageManager: cmd.IsSet(flagPackageManager),
		startNow:       cmd.IsSet(flagStart),
	}

	// The directory the project lands in names it unless --name says otherwise,
	// so the prompt has something to offer and --yes has something to use.
	if !given.name {
		resolved.name = nameFromDir(dir)
	}

	if interactive && !cmd.Bool(flagYes) {
		return resolution{choices: resolved, answered: given, prompt: true}, nil
	}

	validated, err := validateChoices(resolved)
	if err != nil {
		return resolution{}, err
	}

	return resolution{choices: validated, answered: given, prompt: false}, nil
}

// runInteractive asks for the choices the command line did not already make.
// Whether to start the servers is not among them: that question belongs after
// the install, so action asks it once the project can actually run.
func runInteractive(
	ce *clienv.CliEnv,
	defaults choices,
	given answered,
) (choices, error) {
	resolved := defaults

	if !given.template {
		template, err := pickTemplate(ce, defaults.template)
		if err != nil {
			return choices{}, err
		}

		resolved.template = template
	}

	if !given.name {
		name, err := promptProjectName(ce, defaults.name)
		if err != nil {
			return choices{}, err
		}

		resolved.name = name
	}

	if !given.packageManager {
		packageManager, err := pickPackageManager(ce, defaults.packageManager)
		if err != nil {
			return choices{}, err
		}

		resolved.packageManager = packageManager
	}

	return resolved, nil
}

// retarget gives the project a directory of its own. Naming a project
// something other than the directory you are standing in means making that
// directory, which is what creating a project has always done. The flow the
// directory argument exists for is the other case: you make a directory, cd
// into it, and the name the create takes from it already matches, so nothing
// moves. A directory given on the command line is the target as typed and is
// never added to.
func retarget(resolved choices) choices {
	if nameFromDir(resolved.dir) == resolved.name {
		return resolved
	}

	resolved.dir = filepath.Join(resolved.dir, resolved.name)
	resolved.rel = resolved.name

	return resolved
}

func pickTemplate(ce *clienv.CliEnv, preferred string) (string, error) {
	items := make([]pickerItem, len(templates))
	for i, tmpl := range templates {
		items[i] = pickerItem{
			Label: tmpl.display,
			Desc:  tmpl.description,
		}
	}

	idx, err := runPicker(ce, "Template", items, indexOfTemplate(preferred))
	if err != nil {
		return "", err
	}

	return templates[idx].name, nil
}

// indexOfTemplate locates the flag-provided template so that pressing enter
// accepts it. An unknown name falls back to the first entry.
func indexOfTemplate(name string) int {
	for i, tmpl := range templates {
		if tmpl.name == name {
			return i
		}
	}

	return 0
}

func promptProjectName(ce *clienv.CliEnv, defaultName string) (string, error) {
	for {
		name, err := runPrompt(ce, "Project name", defaultName)
		if err != nil {
			return "", err
		}

		name = strings.TrimSpace(name)
		if err := validateName(name); err != nil {
			ce.Warnln("%v", err)

			continue
		}

		return name, nil
	}
}

func pickPackageManager(ce *clienv.CliEnv, preferred string) (string, error) {
	managers := packageManagers()

	items := make([]pickerItem, len(managers))
	for i, pm := range managers {
		items[i] = pickerItem{Label: pm, Desc: ""}
	}

	idx, err := runPicker(ce, "Package manager", items, indexOfPackageManager(preferred))
	if err != nil {
		return "", err
	}

	return managers[idx], nil
}

// indexOfPackageManager locates the flag-provided manager so that pressing
// enter accepts it. An unknown name falls back to the first entry.
func indexOfPackageManager(preferred string) int {
	for i, pm := range packageManagers() {
		if pm == preferred {
			return i
		}
	}

	return 0
}

func validateChoices(resolved choices) (choices, error) {
	name := strings.TrimSpace(resolved.name)
	if name == "" {
		return choices{}, errNameRequired
	}

	if err := validateName(name); err != nil {
		return choices{}, err
	}

	resolved.name = name

	if _, ok := lookupTemplate(resolved.template); !ok {
		return choices{}, fmt.Errorf( //nolint:err113
			"unknown template %q; available templates: %s",
			resolved.template,
			strings.Join(templateNames(), ", "),
		)
	}

	if err := validatePackageManager(resolved.packageManager); err != nil {
		return choices{}, err
	}

	if resolved.startNow && !resolved.installNow {
		return choices{}, errStartNeedsInstall
	}

	return resolved, nil
}
