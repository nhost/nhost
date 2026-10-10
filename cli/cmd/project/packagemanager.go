package project

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const (
	flagPackageManager = "package-manager"

	// defaultPackageManager is what the template's own frontend is developed
	// and locked with, so the default scaffold is the one CI installs.
	defaultPackageManager = "pnpm"
)

var (
	errUnknownPackageManager = errors.New("unknown package manager")

	errPackageManagerNeedsTmpl = errors.New(
		"--package-manager selects what a template scaffolds, so it needs --template",
	)
)

// packageManagerScripts are the package.json scripts the shipped documentation
// tells people to run. Rewriting a command means knowing it is a script rather
// than a subcommand, because npm needs `run` in front of one and not the other.
//
//nolint:gochecknoglobals // a fixed list, read-only, keyed off package.json
var packageManagerScripts = []string{"install", "dev", "build", "lint", "format", "test"}

// packageManager is one of the managers a template can be scaffolded for.
type packageManager struct {
	name  string
	label string
	// installCmd is how this manager is told to install dependencies, which is
	// the one command that is not a script.
	installCmd string
	// runPrefix goes in front of a script name. npm is the odd one: it needs
	// `run`, where the others take the script directly.
	runPrefix string
	// drops are files only another manager understands, which this one's
	// scaffold leaves out.
	drops []string
}

// packageManagers lists the managers in the order the picker offers them.
func packageManagers() []packageManager {
	// Every manager but pnpm leaves pnpm's own files behind: a lockfile for a
	// manager you are not using is worse than none, because it looks current.
	pnpmFiles := []string{
		"frontend/pnpm-lock.yaml",
		"frontend/pnpm-workspace.yaml",
	}

	return []packageManager{
		{
			name:       "pnpm",
			label:      "pnpm",
			installCmd: "pnpm install",
			runPrefix:  "pnpm",
			drops:      nil,
		},
		{
			name:       "bun",
			label:      "bun",
			installCmd: "bun install",
			runPrefix:  "bun",
			drops:      pnpmFiles,
		},
		{
			name:       "yarn",
			label:      "yarn",
			installCmd: "yarn",
			runPrefix:  "yarn",
			drops:      pnpmFiles,
		},
		{
			name:       "npm",
			label:      "npm",
			installCmd: "npm install",
			runPrefix:  "npm run",
			drops:      pnpmFiles,
		},
	}
}

// command is how this manager is asked to do one of the things the template's
// documentation names.
func (p packageManager) command(script string) string {
	if script == "install" {
		return p.installCmd
	}

	return p.runPrefix + " " + script
}

func packageManagerNames() []string {
	all := packageManagers()
	names := make([]string, 0, len(all))

	for _, p := range all {
		names = append(names, p.name)
	}

	return names
}

// packageManagerUsage is the flag's help line. The backticks are urfave's
// placeholder syntax, as on the other template flags.
func packageManagerUsage() string {
	return "Package manager the template is set up for. `NAME` is one of: " +
		strings.Join(packageManagerNames(), ", ")
}

func lookupPackageManager(name string) (packageManager, bool) {
	for _, p := range packageManagers() {
		if p.name == name {
			return p, true
		}
	}

	return packageManager{}, false //nolint:exhaustruct // zero value on the not-found path
}

// resolvePackageManager returns the manager to set the template up for, asking
// when the template itself was chosen by answering a question.
func resolvePackageManager(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	asked bool,
) (packageManager, error) {
	if template == "" {
		if cmd.IsSet(flagPackageManager) {
			return packageManager{}, errPackageManagerNeedsTmpl
		}

		// No template, so nothing to set up for. The zero value is the answer
		// here rather than a half-built one.
		return packageManager{}, nil //nolint:exhaustruct // the no-template answer
	}

	name := strings.TrimSpace(cmd.String(flagPackageManager))

	pm, ok := lookupPackageManager(name)
	if !ok {
		return packageManager{}, fmt.Errorf(
			"%w %q; available: %s",
			errUnknownPackageManager, name, strings.Join(packageManagerNames(), ", "),
		)
	}

	if asked && !cmd.IsSet(flagPackageManager) {
		return pickPackageManager(ce, pm)
	}

	return pm, nil
}

// pickPackageManager asks which manager to use, opening on the given default.
// As with the other questions, no terminal means no prompt and the default
// stands, so one line of piped input still scaffolds.
func pickPackageManager(ce *clienv.CliEnv, fallback packageManager) (packageManager, error) {
	all := packageManagers()

	items := make([]pickerItem, 0, len(all))
	cursor := 0

	for i, p := range all {
		items = append(items, pickerItem{Label: p.label})

		if p.name == fallback.name {
			cursor = i
		}
	}

	idx, err := pickWithKeys(ce, "Package manager", items, cursor)

	switch {
	case errors.Is(err, errNoRawTerminal):
		return fallback, nil
	case err != nil:
		return packageManager{}, err
	}

	return all[idx], nil
}

// retargetDocs rewrites the commands in a shipped Markdown file for this
// manager. The scripts are replaced before the bare name, so that the prose
// mention of the manager is all that is left to catch by the time it runs.
func retargetDocs(data []byte, pm packageManager) []byte {
	if pm.name == defaultPackageManager {
		return data
	}

	for _, script := range packageManagerScripts {
		data = bytes.ReplaceAll(
			data,
			[]byte(defaultPackageManager+" "+script),
			[]byte(pm.command(script)),
		)
	}

	// What is left is prose naming the manager rather than a command, as in
	// the line listing what a developer needs installed.
	return bytes.ReplaceAll(data, []byte(defaultPackageManager), []byte(pm.name))
}
