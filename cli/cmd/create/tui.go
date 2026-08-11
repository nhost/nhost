package create

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
)

//nolint:gochecknoglobals // Test seams for Bubble Tea prompts.
var (
	runPrompt  = tui.RunPrompt
	runConfirm = tui.RunConfirm
	runPicker  = tui.RunPicker
)

type choices struct {
	template       string
	name           string
	packageManager string
	installNow     bool
}

func resolveChoices(cmd *cli.Command, interactive bool) (choices, bool, error) {
	resolved := choices{
		template:       cmd.String(flagTemplate),
		name:           cmd.Args().First(),
		packageManager: cmd.String(flagPackageManager),
		installNow:     !cmd.Bool(flagNoInstall),
	}

	runTUI := interactive && !cmd.Bool(flagYes)
	if runTUI {
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

	template, err := pickTemplate()
	if err != nil {
		return choices{}, err
	}

	resolved.template = template

	name, err := promptProjectName(ce, defaults.name)
	if err != nil {
		return choices{}, err
	}

	resolved.name = name

	packageManager, err := pickPackageManager()
	if err != nil {
		return choices{}, err
	}

	resolved.packageManager = packageManager

	installNow, err := runConfirm("Install frontend dependencies now?")
	if err != nil {
		return choices{}, err
	}

	resolved.installNow = installNow

	return resolved, nil
}

func pickTemplate() (string, error) {
	items := make([]tui.PickerItem, len(templates))
	for i, tmpl := range templates {
		items[i] = tui.PickerItem{
			Label:    tmpl.Display,
			Desc:     tmpl.Description,
			Value:    tmpl.Name,
			Selected: false,
		}
	}

	idx, err := runPicker("Template", items)
	if err != nil {
		return "", err
	}

	return templates[idx].Name, nil
}

func promptProjectName(ce *clienv.CliEnv, defaultName string) (string, error) {
	for {
		name, err := runPrompt("Project name", defaultName)
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

func pickPackageManager() (string, error) {
	packageManagers := []string{defaultPackageManager, "npm", "bun"}

	items := make([]tui.PickerItem, len(packageManagers))
	for i, pm := range packageManagers {
		items[i] = tui.PickerItem{
			Label:    pm,
			Desc:     "",
			Value:    pm,
			Selected: false,
		}
	}

	idx, err := runPicker("Package manager", items)
	if err != nil {
		return "", err
	}

	return packageManagers[idx], nil
}

func validateChoices(resolved choices) (choices, error) {
	name, err := resolveName(resolved.name)
	if err != nil {
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

	return resolved, nil
}
