package project

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
)

const flagTemplate = "template"

var (
	errInitTakesNoArgs = errors.New("init takes no arguments")
	errUnknownTemplate = errors.New("unknown template")
	errEntryExists     = errors.New(
		"already exists; move it aside to lay the template over this project",
	)
)

// starterTemplate is one entry of the catalogue: a directory under templates/
// whose top-level entries are laid over the project root, next to the nhost
// folder init itself writes.
//
// The paths below are where this template keeps the things the scaffold edits,
// relative to the template's own directory. They are fields rather than
// package constants because a framework decides its own layout: an App Router
// app keeps its routes under frontend/src/app, and nothing says the next
// template will. All of them are paths inside the embedded filesystem, so they
// are slash-separated regardless of host.
type starterTemplate struct {
	// name is the directory under templates/ and what --template takes.
	name string
	// label is what the picker shows, and it is the framework and nothing
	// else. What the template scaffolds is the two questions after this one,
	// so a gloss here would both answer them early and crowd the line.
	label string
	// authDir holds one directory per sign-in method, named for the method, so
	// a selection maps to files without a second table to keep in step.
	authDir string
	// methodsFile is the list of methods the sign-in page offers, which the
	// scaffold generates from the selection.
	methodsFile string
	// componentsUI is the seam: everything in the app imports these modules and
	// nothing imports past them, so swapping what is behind the path is the
	// whole of changing UI system.
	componentsUI string
	// uiSystems are the component layers this template can be scaffolded with,
	// in the order the picker offers them. They belong to the template because
	// a component library is written for one framework: shadcn/ui is React, and
	// its Vue and Svelte ports are different packages.
	uiSystems []uiSystem
}

// catalogue lists the templates the binary ships, in the order the picker
// offers them. Adding one is an entry here and a directory under templates/.
func catalogue() []starterTemplate {
	return []starterTemplate{
		{
			name:         "nextjs",
			label:        "Next.js",
			authDir:      "frontend/src/app/auth",
			methodsFile:  "frontend/src/app/signin/methods.ts",
			componentsUI: "frontend/src/components/ui",
			uiSystems:    reactUISystems(),
		},
	}
}

func lookupTemplate(name string) (starterTemplate, bool) {
	for _, t := range catalogue() {
		if t.name == name {
			return t, true
		}
	}

	return starterTemplate{}, false //nolint:exhaustruct // zero value on the not-found path
}

func templateNames() []string {
	cat := catalogue()
	names := make([]string, 0, len(cat))

	for _, t := range cat {
		names = append(names, t.name)
	}

	return names
}

// templateValue is the --template flag. It reports itself as a bool flag so
// urfave/cli accepts it without a value; a name typed after it as a separate
// word then arrives as a positional argument, which resolveTemplate absorbs.
// `--template=NAME` reaches Set directly.
type templateValue struct {
	set  bool
	name string
}

// Set records that the flag was given. "true" is what the parser passes for a
// bare flag; anything else is a template name.
func (v *templateValue) Set(s string) error {
	v.set = true

	if s == "true" {
		v.name = ""
	} else {
		v.name = s
	}

	return nil
}

func (v *templateValue) String() string { return v.name }

func (v *templateValue) Get() any { return v.name }

// IsBoolFlag is what makes the value optional on the command line.
func (v *templateValue) IsBoolFlag() bool { return true }

// resolveTemplate returns the template to lay down, or "" when --template was
// not given. A bare --template asks with the picker; a name may follow the
// flag either as --template=NAME or as the next word.
//
// The second return says the answer came from the picker, which is what tells
// the caller there is a user here to ask the next question of.
func resolveTemplate(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	tv *templateValue,
) (string, bool, error) {
	args := cmd.Args().Slice()

	if !tv.set {
		if len(args) > 0 {
			return "", false, fmt.Errorf(
				"%w, got %q", errInitTakesNoArgs, strings.Join(args, " "),
			)
		}

		return "", false, nil
	}

	name := tv.name
	if name == "" && len(args) == 1 {
		name, args = args[0], nil
	}

	if len(args) > 0 {
		return "", false, fmt.Errorf("%w, got %q", errInitTakesNoArgs, strings.Join(args, " "))
	}

	if name == "" {
		picked, err := pickTemplate(ce)

		return picked, err == nil, err
	}

	if _, ok := lookupTemplate(name); !ok {
		return "", false, fmt.Errorf(
			"%w %q; available: %s", errUnknownTemplate, name, strings.Join(templateNames(), ", "),
		)
	}

	return name, false, nil
}

// pickTemplate asks which template to use. In a terminal that is the arrow-key
// picker; with piped input it is a numbered list, so `printf '1\n' | nhost
// init --template` works in a script.
func pickTemplate(ce *clienv.CliEnv) (string, error) {
	cat := catalogue()
	items := make([]pickerItem, 0, len(cat))

	for _, t := range cat {
		items = append(items, pickerItem{Label: t.label})
	}

	idx, err := promptPick(ce, "Template", items, 0)
	if err != nil {
		return "", err
	}

	return cat[idx].name, nil
}

// templateEntries are the top-level entries a template lays over the project
// root, which is also everything that can collide with what is already there.
// The ui directory is not among them: it holds the template's alternative UI
// systems, which are scaffolded into frontend/ rather than handed over whole.
func templateEntries(name string) ([]string, error) {
	entries, err := fs.ReadDir(templates.FS, name)
	if err != nil {
		return nil, fmt.Errorf("reading template %s: %w", name, err)
	}

	names := make([]string, 0, len(entries))

	for _, e := range entries {
		if e.Name() == uiDirPath {
			continue
		}

		names = append(names, e.Name())
	}

	return names, nil
}

// isAgentContext says whether a top-level entry is guidance for coding agents
// rather than part of the app. A project often has its own already, and it is
// not in the frontend's way, so it is kept where any other entry would refuse.
func isAgentContext(entry string) bool {
	switch entry {
	case ".claude", "AGENTS.md", "CLAUDE.md", "SKILLS.md":
		return true
	default:
		return false
	}
}

// templateLayout is what laying a template over the project root does with
// each of its top-level entries.
type templateLayout struct {
	// write are the entries the project does not have yet.
	write []string
	// keep are the agent-context entries the project already has, which stay
	// as they are while the template's copies are skipped.
	keep []string
}

// planTemplate refuses to lay a template over anything already in the project
// root, except agent context, which it keeps. It runs before anything is
// written, so a refusal leaves the directory as it was.
//
// A symlink counts as present whether or not it resolves: a dangling one would
// otherwise pass as absent and then be written through, outside the project.
func planTemplate(
	ps *clienv.PathStructure,
	name string,
) (templateLayout, error) {
	entries, err := templateEntries(name)
	if err != nil {
		return templateLayout{}, err
	}

	var layout templateLayout

	for _, e := range entries {
		dst := filepath.Join(ps.Root(), e)

		_, err := os.Lstat(dst)

		switch {
		case errors.Is(err, fs.ErrNotExist):
			layout.write = append(layout.write, e)
		case err != nil:
			return templateLayout{}, fmt.Errorf("checking %s: %w", dst, err)
		case isAgentContext(e):
			layout.keep = append(layout.keep, e)
		default:
			return templateLayout{}, fmt.Errorf("%s %w", dst, errEntryExists)
		}
	}

	return layout, nil
}

// writeTemplate lays the template over the project root. If any step fails it
// removes what it wrote, which planTemplate showed was not there before, so a
// retry is not refused by a half-written frontend.
func writeTemplate(
	ps *clienv.PathStructure,
	name string,
	layout templateLayout,
	methods []signInMethod,
	ui uiSystem,
	pm packageManager,
) error {
	tmpl, ok := lookupTemplate(name)
	if !ok {
		return fmt.Errorf("%w %q", errUnknownTemplate, name)
	}

	err := layTemplate(ps, tmpl, layout, methods, ui, pm)
	if err == nil {
		return nil
	}

	for _, e := range layout.write {
		dst := filepath.Join(ps.Root(), e)
		if rmErr := os.RemoveAll(dst); rmErr != nil {
			err = errors.Join(err, fmt.Errorf("removing %s: %w", dst, rmErr))
		}
	}

	return err
}

// layTemplate writes the entries the layout leaves to write, without the
// sign-in methods that were not selected. A method is a directory under
// authDirPath plus an entry in methods.ts and nothing else, so skipping the
// directory and rewriting that one file is the whole of it - the same two steps
// the template documents for removing a method by hand afterwards.
func layTemplate(
	ps *clienv.PathStructure,
	tmpl starterTemplate,
	layout templateLayout,
	methods []signInMethod,
	ui uiSystem,
	pm packageManager,
) error {
	name := tmpl.name

	skip := unselectedAuthDirs(tmpl, methods)
	skip[path.Join(name, uiDirPath)] = true

	for _, e := range layout.keep {
		skip[path.Join(name, e)] = true
	}

	// A file belonging to a manager that was not chosen is never written,
	// rather than written and removed. The same for one the UI system
	// invalidates by changing the dependencies.
	for _, d := range pm.drops {
		skip[path.Join(name, d)] = true
	}

	for _, d := range ui.dropFiles {
		skip[path.Join(name, d)] = true
	}

	if err := writeFSExcept(templates.FS, name, ps.Root(), skip); err != nil {
		return fmt.Errorf("writing template %s: %w", name, err)
	}

	dst := filepath.Join(ps.Root(), filepath.FromSlash(tmpl.methodsFile))
	if err := os.WriteFile(dst, renderSignInMethods(methods), 0o600); err != nil { //nolint:mnd
		return fmt.Errorf("writing %s: %w", dst, err)
	}

	if err := writeUISystem(ps, tmpl, ui); err != nil {
		return err
	}

	return retargetTemplateDocs(ps, name, pm, skip)
}

// retargetTemplateDocs rewrites the commands in every Markdown file the
// template wrote, so a project scaffolded for one manager is never told to
// run another. The files are found in the template rather than by walking the
// project, and skip is what layTemplate left out, which keeps the rewrite to
// what this command just wrote.
func retargetTemplateDocs(
	ps *clienv.PathStructure,
	name string,
	pm packageManager,
	skip map[string]bool,
) error {
	if pm.name == defaultPackageManager {
		return nil
	}

	return fs.WalkDir( //nolint:wrapcheck
		templates.FS,
		name,
		func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return fmt.Errorf("walking %s: %w", p, err)
			}

			if skip[p] {
				if d.IsDir() {
					return fs.SkipDir
				}

				return nil
			}

			if d.IsDir() || path.Ext(p) != ".md" {
				return nil
			}

			rel, err := filepath.Rel(name, p)
			if err != nil {
				return fmt.Errorf("relative path for %s: %w", p, err)
			}

			// Built from the embedded filesystem's own walk, so every element of
			// it is template content fixed at compile time rather than anything
			// the caller supplies.
			doc := filepath.Join(ps.Root(), rel)

			data, err := os.ReadFile(doc)
			if err != nil {
				return fmt.Errorf("reading %s: %w", doc, err)
			}

			//nolint:mnd,gosec // 0o600 as everywhere here; doc is from the embedded FS
			if err := os.WriteFile(doc, retargetDocs(data, pm), 0o600); err != nil {
				return fmt.Errorf("writing %s: %w", doc, err)
			}

			return nil
		},
	)
}

// writeUISystem lays the chosen UI system's modules over the seam and takes the
// dependencies it does not use out of the scaffolded package.json. The default
// has neither an overlay nor anything to drop, because it is what frontend/
// already holds.
func writeUISystem(ps *clienv.PathStructure, tmpl starterTemplate, ui uiSystem) error {
	if ui.overlay != "" {
		src := path.Join(tmpl.name, uiDirPath, ui.overlay)
		dst := filepath.Join(ps.Root(), filepath.FromSlash(tmpl.componentsUI))

		if err := writeFS(templates.FS, src, dst); err != nil {
			return fmt.Errorf("writing the %s UI system: %w", ui.name, err)
		}
	}

	if len(ui.drops) == 0 {
		return nil
	}

	pkg := filepath.Join(ps.Root(), "frontend", "package.json")

	data, err := os.ReadFile(pkg)
	if err != nil {
		return fmt.Errorf("reading %s: %w", pkg, err)
	}

	trimmed, err := dropDependencies(data, ui.drops)
	if err != nil {
		return fmt.Errorf("adjusting %s for the %s UI system: %w", pkg, ui.name, err)
	}

	if err := os.WriteFile(pkg, trimmed, 0o600); err != nil { //nolint:mnd
		return fmt.Errorf("writing %s: %w", pkg, err)
	}

	return nil
}

// unselectedAuthDirs are the method directories inside the embedded filesystem
// that this selection leaves behind, as the paths writeFSExcept skips.
func unselectedAuthDirs(tmpl starterTemplate, methods []signInMethod) map[string]bool {
	selected := make(map[string]bool, len(methods))
	for _, m := range methods {
		selected[m.name] = true
	}

	skip := make(map[string]bool)

	for _, m := range signInMethods() {
		if !selected[m.name] {
			skip[path.Join(tmpl.name, tmpl.authDir, m.name)] = true
		}
	}

	return skip
}

// signInMethodsHeader is everything in methods.ts above the entries. The file
// is generated rather than filtered because it is pure data with no imports by
// design, so rendering it is exact where editing checked-in TypeScript from Go
// would not be. TestRenderSignInMethodsMatchesTemplate holds this in step with
// the copy the template ships.
const signInMethodsHeader = `/**
 * The sign-in methods this app offers, one line each.
 *
 * Every method is its own directory under ` + "`app/auth/`" + `, and nothing outside that
 * directory imports from it. To drop a method: delete its directory, then
 * delete its line here. That is the whole procedure - see README.md.
 *
 * This file has no imports on purpose: it is what lets the sign-in page list
 * the methods without depending on any of them.
 */
export type SignInMethod = {
  href: string;
  title: string;
  description: string;
};

export const methods: SignInMethod[] = [
`

// renderSignInMethods writes methods.ts for a selection, in catalogue order.
func renderSignInMethods(methods []signInMethod) []byte {
	var b strings.Builder

	b.WriteString(signInMethodsHeader)

	for _, m := range methods {
		fmt.Fprintf(
			&b,
			"  {\n    href: '%s',\n    title: '%s',\n    description: '%s',\n  },\n",
			tsQuote(m.href), tsQuote(m.title), tsQuote(m.description),
		)
	}

	b.WriteString("];\n")

	return []byte(b.String())
}

// tsQuote escapes what would otherwise end a single-quoted TypeScript string.
// No catalogue entry needs it today; it is here so that one day adding a method
// whose description carries an apostrophe does not emit a file that fails to
// parse in the user's project rather than in CI.
func tsQuote(s string) string {
	return strings.NewReplacer(`\`, `\\`, `'`, `\'`).Replace(s)
}

// printKeptEntries names the agent-context entries the project already had,
// whose copies in the template were skipped.
func printKeptEntries(ce *clienv.CliEnv, layout templateLayout) {
	if len(layout.keep) == 0 {
		return
	}

	ce.Infoln(
		"Kept this project's own %s; the template's copies were skipped",
		strings.Join(layout.keep, ", "),
	)
}

// printTemplateNextSteps says what to run now that the frontend is in place.
// The CLI installs nothing itself: init has never run a package manager, and
// that was the slowest and most failure-prone step of the command this
// replaces. toEnable are the selected sign-in methods the config leaves off,
// which is possible only when init did not write it, and the line naming them
// is skipped when there are none.
func printTemplateNextSteps(
	ce *clienv.CliEnv,
	name string,
	toEnable []string,
	pm packageManager,
) {
	// A blank line between what just happened and what to do about it, so the
	// next steps read as their own block rather than more progress output.
	ce.Println("")
	ce.Infoln("Added the %s template. Next:", name)
	ce.Println("")

	if len(toEnable) > 0 {
		ce.Println(
			"  Enable %s in nhost/nhost.toml.", strings.Join(toEnable, " and "),
		)
		ce.Println("  frontend/README.md says which setting each one needs.")
		ce.Println("")
	}

	// Split across two terminals because `nhost up` holds the first one, which
	// is the step people are most often caught out by.
	ce.Println("  Start the backend:")
	ce.Println("    nhost up")
	ce.Println("")
	ce.Println("  Then, in another terminal, the frontend:")
	ce.Println("    cd frontend")
	ce.Println("    %s", pm.command("install"))
	ce.Println("    %s", pm.command("dev"))
}
