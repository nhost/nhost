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
	flagUI = "ui"

	// defaultUI is the smallest thing that works: the components are the
	// project's own plain Tailwind from the first commit, with no component
	// library to adopt or remove. shadcn/ui is a choice rather than a thing to
	// opt out of, matching the sign-in methods.
	defaultUI = "none"

	// uiDirPath holds a template's alternative UI systems, one directory each.
	// It sits beside frontend/ rather than inside it: it is how the template is
	// built, not part of what a project receives, so it is kept out of both the
	// collision check and the copy.
	//
	// Unlike the seam it overlays onto, this one is the same for every template:
	// it is where the CLI looks, not where the framework puts its components.
	uiDirPath = "ui"
)

var (
	errUnknownUI     = errors.New("unknown UI system")
	errUINeedsTmpl   = errors.New("--ui selects what a template scaffolds, so it needs --template")
	errDepNotDropped = errors.New("dependency not found in package.json")
)

// uiSystem is one of the component layers a template can be scaffolded with.
type uiSystem struct {
	name  string
	label string
	// overlay is the directory under the template's ui/ whose modules replace
	// the default ones. Empty for the default, which frontend/ already is.
	overlay string
	// drops are the dependencies the scaffolded package.json loses, because
	// nothing in this UI system imports them.
	drops []string
	// dropFiles are files the scaffold leaves out because changing the
	// dependencies makes them wrong. A lockfile that disagrees with
	// package.json is worse than no lockfile: `pnpm install` quietly fixes it
	// but `pnpm install --frozen-lockfile`, which is what CI runs, fails. The
	// first install writes a correct one.
	dropFiles []string
}

// reactUISystems is what a template whose components are React is scaffolded
// with: the plain Tailwind set the template already holds, or shadcn/ui. One
// function shared by those templates rather than a copy per catalogue entry,
// since the set is the same wherever the components are React and sit behind
// the same seam. A Vue or Svelte template needs its own, because the shadcn
// ports for those frameworks are different packages.
func reactUISystems() []uiSystem {
	return []uiSystem{
		{
			name:      "none",
			label:     "None",
			overlay:   "none",
			dropFiles: []string{"frontend/pnpm-lock.yaml"},
			drops: []string{
				"@radix-ui/react-label",
				"@radix-ui/react-slot",
				"class-variance-authority",
			},
		},
		{
			name:      "shadcn",
			label:     "shadcn/ui",
			overlay:   "",
			drops:     nil,
			dropFiles: nil,
		},
	}
}

// vueUISystems is the same choice for a template whose components are Vue.
// It is its own function rather than a parameter to the one above because the
// dependencies differ: shadcn-vue is built on reka-ui, and its Input and Label
// reach for @vueuse/core, none of which the React set has.
func vueUISystems() []uiSystem {
	return []uiSystem{
		{
			name:      "none",
			label:     "None",
			overlay:   "none",
			dropFiles: []string{"frontend/pnpm-lock.yaml"},
			drops: []string{
				"@vueuse/core",
				"class-variance-authority",
				"reka-ui",
			},
		},
		{
			name:      "shadcn",
			label:     "shadcn-vue",
			overlay:   "",
			drops:     nil,
			dropFiles: nil,
		},
	}
}

func uiNames(systems []uiSystem) []string {
	names := make([]string, 0, len(systems))

	for _, u := range systems {
		names = append(names, u.name)
	}

	return names
}

// allUINames is every UI system any template offers, in catalogue order and
// without repeats. The flag's help is built before a template is known, so it
// names the union; asking for one the chosen template does not offer is
// refused by resolveUISystem with that template's own list.
func allUINames() []string {
	var names []string

	seen := make(map[string]bool)

	for _, t := range catalogue() {
		for _, u := range t.uiSystems {
			if seen[u.name] {
				continue
			}

			seen[u.name] = true

			names = append(names, u.name)
		}
	}

	return names
}

// uiUsage is the flag's help line, naming the options from the catalogue so
// one added there is offered without a second edit.
//
// The backticks are urfave's placeholder syntax, as on --auth-methods.
func uiUsage() string {
	return "UI system the template scaffolds. `NAME` is one of: " +
		strings.Join(allUINames(), ", ")
}

func lookupUI(systems []uiSystem, name string) (uiSystem, bool) {
	for _, u := range systems {
		if u.name == name {
			return u, true
		}
	}

	return uiSystem{}, false //nolint:exhaustruct // zero value on the not-found path
}

// resolveUISystem returns the UI system to scaffold with, asking when the
// template itself was chosen by answering a question.
func resolveUISystem(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	asked bool,
) (uiSystem, error) {
	if template == "" {
		if cmd.IsSet(flagUI) {
			return uiSystem{}, errUINeedsTmpl
		}

		// No template, so nothing to scaffold and no UI system to scaffold it
		// with. The zero value is the answer here rather than a half-built one.
		return uiSystem{}, nil //nolint:exhaustruct // the no-template answer
	}

	tmpl, ok := lookupTemplate(template)
	if !ok {
		return uiSystem{}, fmt.Errorf("%w %q", errUnknownTemplate, template)
	}

	name := strings.TrimSpace(cmd.String(flagUI))

	ui, ok := lookupUI(tmpl.uiSystems, name)
	if !ok {
		return uiSystem{}, fmt.Errorf(
			"%w %q; available: %s",
			errUnknownUI, name, strings.Join(uiNames(tmpl.uiSystems), ", "),
		)
	}

	if asked && !cmd.IsSet(flagUI) {
		return pickUISystem(ce, tmpl.uiSystems, ui)
	}

	return ui, nil
}

// pickUISystem asks which UI system to use, opening on the given default.
//
// Where stdin cannot be read key by key there is no prompt and the default
// stands, as with the sign-in methods. Falling back to the numbered list here
// would spend a second line of piped input, and `printf '1\n' | nhost init
// --template` is documented to scaffold on one.
func pickUISystem(
	ce *clienv.CliEnv,
	all []uiSystem,
	fallback uiSystem,
) (uiSystem, error) {
	items := make([]pickerItem, 0, len(all))
	cursor := 0

	for i, u := range all {
		items = append(items, pickerItem{Label: u.label})

		if u.name == fallback.name {
			cursor = i
		}
	}

	idx, err := pickWithKeys(ce, "UI system", items, cursor)

	switch {
	case errors.Is(err, errNoRawTerminal):
		return fallback, nil
	case err != nil:
		return uiSystem{}, err
	}

	return all[idx], nil
}

// dropDependencies removes the named dependencies from a package.json,
// editing the text rather than re-encoding it so that key order, indentation
// and every untouched line survive exactly as the template wrote them.
//
// Removing the last entry of an object would leave the comma on the line above
// dangling, so that comma goes too.
func dropDependencies(data []byte, names []string) ([]byte, error) {
	drop := make(map[string]bool, len(names))
	for _, n := range names {
		drop[n] = false
	}

	lines := bytes.Split(data, []byte("\n"))
	kept := make([][]byte, 0, len(lines))

	for _, line := range lines {
		name, ok := dependencyLineName(line)
		if ok {
			if _, wanted := drop[name]; wanted {
				drop[name] = true

				continue
			}
		}

		// A line that closes an object right after a removal leaves the kept
		// line above it ending in a comma that now has nothing to separate.
		if closesObject(line) && len(kept) > 0 {
			last := len(kept) - 1
			kept[last] = bytes.TrimRight(kept[last], ",")
		}

		kept = append(kept, line)
	}

	for name, found := range drop {
		if !found {
			return nil, fmt.Errorf("%w: %s", errDepNotDropped, name)
		}
	}

	return bytes.Join(kept, []byte("\n")), nil
}

// dependencyLineName reads the key off a `"name": "version",` line.
func dependencyLineName(line []byte) (string, bool) {
	trimmed := bytes.TrimSpace(line)
	if !bytes.HasPrefix(trimmed, []byte(`"`)) {
		return "", false
	}

	name, after, ok := bytes.Cut(trimmed[1:], []byte(`"`))
	if !ok {
		return "", false
	}

	if !bytes.HasPrefix(bytes.TrimSpace(after), []byte(":")) {
		return "", false
	}

	return string(name), true
}

func closesObject(line []byte) bool {
	trimmed := bytes.TrimSpace(line)

	return bytes.Equal(trimmed, []byte("}")) || bytes.Equal(trimmed, []byte("},"))
}
