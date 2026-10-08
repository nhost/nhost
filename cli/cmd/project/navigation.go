package project

import (
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
)

const (
	flagNavigation = "navigation"

	// defaultNavigation is the one the template already is, the same way the
	// default UI system is. A file-based router is what the other templates
	// here do too, so it is the answer that makes this template look like the
	// rest rather than the answer that makes it look like its framework's
	// older convention.
	defaultNavigation = "router"

	// navDirPath holds a template's alternative navigation systems, one
	// directory each. It sits beside frontend/ for the same reason ui/ does:
	// it is how the template is built, not part of what a project receives.
	navDirPath = "navigation"

	// navRootPath is what a navigation system is laid over. Unlike a UI
	// system, which replaces modules behind one directory, this one also
	// brings the entry point and a package.json naming a different library,
	// so the whole frontend is the target.
	navRootPath = "frontend"
)

var (
	errUnknownNav   = errors.New("unknown navigation system")
	errNavNeedsTmpl = errors.New(
		"--navigation selects what a template scaffolds, so it needs --template",
	)
	errNavUnsupported = errors.New("does not offer a choice of navigation system")
)

// navigationSystem is one of the navigation libraries a template can be
// scaffolded with.
//
// Only a template whose framework leaves the choice open has more than one.
// The web templates have none: a Next.js app routes with Next's router and a
// SvelteKit app with SvelteKit's, and there is no second answer to offer.
type navigationSystem struct {
	name  string
	label string
	// overlay is the directory under the template's navigation/ whose files
	// are laid over frontend/. Empty for the default, which frontend/ already
	// is.
	overlay string
	// dropFiles are files the scaffold leaves out because this system
	// replaces what they were for. The lockfile goes for the same reason a UI
	// system drops it: the package.json this writes names different packages,
	// and a lockfile that disagrees fails `pnpm install --frozen-lockfile`.
	dropFiles []string
}

// expoNavigationSystems is what an Expo template is scaffolded with. Both run
// on Expo and bundle the same way; what differs is which library the seam at
// src/lib/navigation.tsx is written against, and whether the screens under
// src/app are read by the framework or by a navigator the app builds itself.
func expoNavigationSystems() []navigationSystem {
	return []navigationSystem{
		{
			name:      "router",
			label:     "Expo Router",
			overlay:   "",
			dropFiles: nil,
		},
		{
			name:    "navigation",
			label:   "React Navigation",
			overlay: "navigation",
			dropFiles: []string{
				// Expo Router's shell. This system has an app of its own.
				"frontend/src/app/_layout.tsx",
				"frontend/pnpm-lock.yaml",
			},
		},
	}
}

func navNames(systems []navigationSystem) []string {
	names := make([]string, 0, len(systems))

	for _, n := range systems {
		names = append(names, n.name)
	}

	return names
}

// allNavNames is every navigation system any template offers, in catalogue
// order and without repeats. As with --ui, the flag's help is built before a
// template is known, so it names the union.
func allNavNames() []string {
	var names []string

	seen := make(map[string]bool)

	for _, t := range catalogue() {
		for _, n := range t.navSystems {
			if seen[n.name] {
				continue
			}

			seen[n.name] = true

			names = append(names, n.name)
		}
	}

	return names
}

// navUsage is the flag's help line. The backticks are urfave's placeholder
// syntax, as on --ui.
func navUsage() string {
	return "Navigation system the template scaffolds, where it offers a choice. " +
		"`NAME` is one of: " + strings.Join(allNavNames(), ", ")
}

func lookupNav(systems []navigationSystem, name string) (navigationSystem, bool) {
	for _, n := range systems {
		if n.name == name {
			return n, true
		}
	}

	return navigationSystem{}, false //nolint:exhaustruct // zero value on the not-found path
}

// resolveNavigationSystem returns the navigation system to scaffold with,
// asking when the template itself was chosen by answering a question.
//
// A template that offers no choice is not an error to scaffold; it is only an
// error to pass --navigation to one, which is the difference between a default
// nobody asked about and a request that cannot be honoured.
func resolveNavigationSystem(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	asked bool,
) (navigationSystem, error) {
	if template == "" {
		if cmd.IsSet(flagNavigation) {
			return navigationSystem{}, errNavNeedsTmpl //nolint:exhaustruct
		}

		return navigationSystem{}, nil //nolint:exhaustruct // the no-template answer
	}

	tmpl, ok := lookupTemplate(template)
	if !ok {
		return navigationSystem{}, fmt.Errorf(
			"%w %q",
			errUnknownTemplate,
			template,
		) //nolint:exhaustruct
	}

	if len(tmpl.navSystems) == 0 {
		if cmd.IsSet(flagNavigation) {
			return navigationSystem{}, fmt.Errorf( //nolint:exhaustruct
				"%s %w", template, errNavUnsupported,
			)
		}

		return navigationSystem{}, nil //nolint:exhaustruct // nothing to lay down
	}

	name := strings.TrimSpace(cmd.String(flagNavigation))

	nav, ok := lookupNav(tmpl.navSystems, name)
	if !ok {
		return navigationSystem{}, fmt.Errorf( //nolint:exhaustruct
			"%w %q; available: %s",
			errUnknownNav, name, strings.Join(navNames(tmpl.navSystems), ", "),
		)
	}

	if asked && !cmd.IsSet(flagNavigation) {
		return pickNavigationSystem(ce, tmpl.navSystems, nav)
	}

	return nav, nil
}

// pickNavigationSystem asks which navigation system to use, opening on the
// given default. Where stdin cannot be read key by key there is no prompt and
// the default stands, as with the UI system.
func pickNavigationSystem(
	ce *clienv.CliEnv,
	all []navigationSystem,
	fallback navigationSystem,
) (navigationSystem, error) {
	items := make([]pickerItem, 0, len(all))
	cursor := 0

	for i, n := range all {
		items = append(items, pickerItem{Label: n.label})

		if n.name == fallback.name {
			cursor = i
		}
	}

	idx, err := pickWithKeys(ce, "Navigation", items, cursor)

	switch {
	case errors.Is(err, errNoRawTerminal):
		return fallback, nil
	case err != nil:
		return navigationSystem{}, err //nolint:exhaustruct
	}

	return all[idx], nil
}

// writeNavigationSystem lays the chosen system's files over the scaffolded
// frontend. The default has nothing to write, because it is what frontend/
// already holds.
func writeNavigationSystem(
	ps *clienv.PathStructure,
	tmpl starterTemplate,
	nav navigationSystem,
) error {
	if nav.overlay == "" {
		return nil
	}

	src := path.Join(tmpl.name, navDirPath, nav.overlay)
	dst := filepath.Join(ps.Root(), navRootPath)

	if err := writeFS(templates.FS, src, dst); err != nil {
		return fmt.Errorf("writing the %s navigation system: %w", nav.name, err)
	}

	return nil
}
