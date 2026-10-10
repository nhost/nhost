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
type starterTemplate struct {
	// name is the directory under templates/ and what --template takes.
	name  string
	label string
	desc  string
}

// catalogue lists the templates the binary ships, in the order the picker
// offers them. Adding one is an entry here and a directory under templates/.
func catalogue() []starterTemplate {
	return []starterTemplate{
		{
			name:  "nextjs",
			label: "Next.js + shadcn/ui",
			desc:  "App Router, Tailwind v4, every Nhost sign-in method side by side",
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
func resolveTemplate(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	tv *templateValue,
) (string, error) {
	args := cmd.Args().Slice()

	if !tv.set {
		if len(args) > 0 {
			return "", fmt.Errorf("%w, got %q", errInitTakesNoArgs, strings.Join(args, " "))
		}

		return "", nil
	}

	name := tv.name
	if name == "" && len(args) == 1 {
		name, args = args[0], nil
	}

	if len(args) > 0 {
		return "", fmt.Errorf("%w, got %q", errInitTakesNoArgs, strings.Join(args, " "))
	}

	if name == "" {
		return pickTemplate(ce)
	}

	if _, ok := lookupTemplate(name); !ok {
		return "", fmt.Errorf(
			"%w %q; available: %s", errUnknownTemplate, name, strings.Join(templateNames(), ", "),
		)
	}

	return name, nil
}

// pickTemplate asks which template to use. In a terminal that is the arrow-key
// picker; with piped input it is a numbered list, so `printf '1\n' | nhost
// init --template` works in a script.
func pickTemplate(ce *clienv.CliEnv) (string, error) {
	cat := catalogue()
	items := make([]pickerItem, 0, len(cat))

	for _, t := range cat {
		items = append(items, pickerItem{Label: t.label, Desc: t.desc})
	}

	idx, err := promptPick(ce, "Template", items, 0)
	if err != nil {
		return "", err
	}

	return cat[idx].name, nil
}

// templateEntries are the top-level entries a template lays over the project
// root, which is also everything that can collide with what is already there.
func templateEntries(name string) ([]string, error) {
	entries, err := fs.ReadDir(templates.FS, name)
	if err != nil {
		return nil, fmt.Errorf("reading template %s: %w", name, err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
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

// writeTemplate lays the entries the layout leaves to write over the project
// root. If one fails it removes what it wrote, which planTemplate showed was
// not there before, so a retry is not refused by a half-written frontend.
func writeTemplate(
	ps *clienv.PathStructure,
	name string,
	layout templateLayout,
) error {
	for _, e := range layout.write {
		err := writeFS(
			templates.FS, path.Join(name, e), filepath.Join(ps.Root(), e),
		)
		if err == nil {
			continue
		}

		err = fmt.Errorf("writing template %s: %w", name, err)

		for _, w := range layout.write {
			dst := filepath.Join(ps.Root(), w)
			if rmErr := os.RemoveAll(dst); rmErr != nil {
				err = errors.Join(
					err, fmt.Errorf("removing %s: %w", dst, rmErr),
				)
			}
		}

		return err
	}

	return nil
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
// replaces. Every sign-in method is scaffolded, and a stock backend ships
// magic link and the emailed code disabled, so their settings come first.
func printTemplateNextSteps(ce *clienv.CliEnv, name string) {
	ce.Infoln("Added the %s template. Next:", name)
	ce.Println("  For magic link and email code, set in nhost/nhost.toml:")
	ce.Println("    auth.method.emailPasswordless.enabled = true")
	ce.Println("    auth.method.otp.email.enabled = true")
	ce.Println("  nhost up")
	ce.Println("  cd frontend && pnpm install && pnpm dev")
}
