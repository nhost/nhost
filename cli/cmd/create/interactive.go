package create

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

type choices struct {
	template       string
	name           string
	packageManager string
	installNow     bool
	startNow       bool
}

// resolveChoices seeds the choices from flags and reports whether the
// interactive flow should run. Without a terminal, or with --yes, every value
// has to come from flags and arguments.
func resolveChoices(cmd *cli.Command, interactive bool) (choices, bool, error) {
	resolved := choices{
		template:       cmd.String(flagTemplate),
		name:           cmd.Args().First(),
		packageManager: cmd.String(flagPackageManager),
		installNow:     !cmd.Bool(flagNoInstall),
		startNow:       cmd.Bool(flagStart),
	}

	if interactive && !cmd.Bool(flagYes) {
		return resolved, true, nil
	}

	resolved, err := validateChoices(resolved)
	if err != nil {
		return choices{}, false, err
	}

	return resolved, false, nil
}

func runInteractive(ce *clienv.CliEnv, defaults choices) (choices, error) {
	resolved := defaults

	template, err := pickTemplate(ce, defaults.template)
	if err != nil {
		return choices{}, err
	}

	resolved.template = template

	name, err := promptProjectName(ce, defaults.name)
	if err != nil {
		return choices{}, err
	}

	resolved.name = name

	packageManager, err := pickPackageManager(ce, defaults.packageManager)
	if err != nil {
		return choices{}, err
	}

	resolved.packageManager = packageManager

	// Nothing to start without the dependencies, so --no-install skips the
	// question rather than offering an answer validateChoices would reject.
	if !resolved.installNow {
		return resolved, nil
	}

	// Defaulted to yes rather than seeded from --start, which exists for
	// non-interactive runs and has to stay off there. Starting is what you were
	// about to do next anyway, and this prompt is how you say otherwise.
	startNow, err := runConfirm(ce, "Start the backend and the frontend now?", true)
	if err != nil {
		return choices{}, err
	}

	resolved.startNow = startNow

	return resolved, nil
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
