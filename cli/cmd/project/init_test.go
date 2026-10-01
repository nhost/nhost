package project_test

import (
	"bytes"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	cmdproject "github.com/nhost/nhost/cli/cmd/project"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

// runInit runs `nhost init` with the given arguments in dir, through the same
// root flags the real binary has, and returns what it printed.
func runInit(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("clienv.Flags: %v", err)
	}

	var output bytes.Buffer

	root := &cli.Command{
		Name:      "nhost",
		Flags:     flags,
		Commands:  []*cli.Command{cmdproject.CommandInit()},
		Writer:    &output,
		ErrWriter: &output,
	}

	t.Chdir(dir)

	err = root.Run(t.Context(), append([]string{"nhost", "init"}, args...))

	return output.String(), err
}

// entries lists what a directory contains, so a refused init can be shown to
// have written nothing.
func entries(t *testing.T, dir string) []string {
	t.Helper()

	found, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading %s: %v", dir, err)
	}

	names := make([]string, 0, len(found))
	for _, f := range found {
		names = append(names, f.Name())
	}

	return names
}

//nolint:paralleltest // changes the working directory
func TestInitWithTemplate(t *testing.T) {
	tests := []struct {
		name string
		args []string
		// wantPaths must exist afterwards, relative to the project directory.
		wantPaths []string
		// wantErr is a fragment of the error; the directory must then be empty.
		wantErr string
	}{
		{
			name: "backend only",
			args: nil,
			wantPaths: []string{
				"nhost/nhost.toml",
				"functions/package.json",
			},
		},
		{
			name: "template as the next word",
			args: []string{"--template", "nextjs"},
			wantPaths: []string{
				"nhost/nhost.toml",
				"frontend/package.json",
				"frontend/src/app/signin/methods.ts",
				"AGENTS.md",
				"CLAUDE.md",
			},
		},
		{
			name: "template with equals",
			args: []string{"--template=nextjs"},
			wantPaths: []string{
				"frontend/package.json",
			},
		},
		{
			name:    "unknown template writes nothing",
			args:    []string{"--template", "nope"},
			wantErr: "unknown template",
		},
		{
			name:    "stray argument writes nothing",
			args:    []string{"extra"},
			wantErr: "takes no arguments",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			output, err := runInit(t, dir, tt.args...)

			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("init %q error = %v, want one mentioning %q", tt.args, err, tt.wantErr)
				}

				if got := entries(t, dir); len(got) != 0 {
					t.Errorf("a refused init wrote %q", got)
				}

				return
			}

			if err != nil {
				t.Fatalf("init %q: %v\n%s", tt.args, err, output)
			}

			for _, p := range tt.wantPaths {
				if _, err := os.Stat(filepath.Join(dir, p)); err != nil {
					t.Errorf("expected %s to exist: %v", p, err)
				}
			}
		})
	}
}

// withPipedStdin points os.Stdin at a file for the length of a test, which is
// what makes the command take the numbered path rather than the raw-mode
// picker. The package's own tests have their own copy of this; this one is
// here because init_test.go is an external test package.
func withPipedStdin(t *testing.T, input string) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "stdin")
	if err := os.WriteFile(path, []byte(input), 0o600); err != nil {
		t.Fatalf("write stdin fixture: %v", err)
	}

	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("open stdin fixture: %v", err)
	}

	orig := os.Stdin
	os.Stdin = f

	t.Cleanup(func() {
		os.Stdin = orig

		_ = f.Close()
	})
}

// readConfig parses the nhost.toml a run left behind.
func readConfig(t *testing.T, dir string) *model.ConfigConfig {
	t.Helper()

	var cfg model.ConfigConfig
	if err := clienv.UnmarshalFile(
		filepath.Join(dir, "nhost", "nhost.toml"), &cfg, toml.Unmarshal,
	); err != nil {
		t.Fatalf("reading nhost.toml: %v", err)
	}

	return &cfg
}

// Configuration is written only for the methods that were asked for. The
// default selection is password, which a stock backend already enables, so the
// common path leaves nhost.toml exactly as a plain init wrote it.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateEnablesOnlySelectedMethods(t *testing.T) {
	enabled := func(b *bool) bool { return b != nil && *b }

	plain := t.TempDir()
	if _, err := runInit(t, plain); err != nil {
		t.Fatalf("init: %v", err)
	}

	plainToml, err := os.ReadFile(filepath.Join(plain, "nhost", "nhost.toml"))
	if err != nil {
		t.Fatal(err)
	}

	cfg := readConfig(t, plain)
	if enabled(cfg.Auth.Method.EmailPasswordless.Enabled) ||
		enabled(cfg.Auth.Method.Otp.Email.Enabled) {
		t.Fatal("a plain init enabled email methods; the default must stay the backend's")
	}

	defaulted := t.TempDir()
	if _, err := runInit(t, defaulted, "--template", "nextjs"); err != nil {
		t.Fatalf("init --template: %v", err)
	}

	defaultedToml, err := os.ReadFile(filepath.Join(defaulted, "nhost", "nhost.toml"))
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(plainToml, defaultedToml) {
		t.Error("the default selection wrote configuration; password needs none")
	}

	asked := t.TempDir()
	if _, err := runInit(
		t, asked, "--template", "nextjs", "--auth-methods", "password,magic-link,otp",
	); err != nil {
		t.Fatalf("init --template --auth-methods: %v", err)
	}

	cfg = readConfig(t, asked)
	if !enabled(cfg.Auth.Method.EmailPasswordless.Enabled) {
		t.Error("asking for magic-link left emailPasswordless disabled")
	}

	if !enabled(cfg.Auth.Method.Otp.Email.Enabled) {
		t.Error("asking for otp left otp.email disabled")
	}
}

// A method that was not asked for is not on disk, and methods.ts lists exactly
// what was. Those two together are the whole of a selection.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateScaffoldsOnlySelectedMethods(t *testing.T) {
	dir := t.TempDir()

	if _, err := runInit(
		t, dir, "--template", "nextjs", "--auth-methods", "password,oauth",
	); err != nil {
		t.Fatalf("init --template --auth-methods: %v", err)
	}

	authDir := filepath.Join(dir, "frontend", "src", "app", "auth")

	for _, kept := range []string{"password", "oauth"} {
		if _, err := os.Stat(filepath.Join(authDir, kept)); err != nil {
			t.Errorf("%s was asked for but is not there: %v", kept, err)
		}
	}

	for _, dropped := range []string{"magic-link", "otp"} {
		if _, err := os.Stat(filepath.Join(authDir, dropped)); !os.IsNotExist(err) {
			t.Errorf("%s was not asked for but is on disk", dropped)
		}
	}

	methods, err := os.ReadFile(
		filepath.Join(dir, "frontend", "src", "app", "signin", "methods.ts"),
	)
	if err != nil {
		t.Fatalf("reading methods.ts: %v", err)
	}

	for _, kept := range []string{"/auth/password", "/auth/oauth"} {
		if !bytes.Contains(methods, []byte(kept)) {
			t.Errorf("methods.ts does not list %s:\n%s", kept, methods)
		}
	}

	for _, dropped := range []string{"/auth/magic-link", "/auth/otp"} {
		if bytes.Contains(methods, []byte(dropped)) {
			t.Errorf("methods.ts still lists %s, whose directory is gone:\n%s", dropped, methods)
		}
	}
}

// --auth-methods only means something next to a template, and a name no
// template ships is refused before anything is written.
//
//nolint:paralleltest // changes the working directory
func TestInitAuthMethodsRefusals(t *testing.T) {
	tests := []struct {
		name      string
		args      []string
		wantInErr string
	}{
		{
			name:      "without a template",
			args:      []string{"--auth-methods", "otp"},
			wantInErr: "needs --template",
		},
		{
			name:      "unknown method",
			args:      []string{"--template", "nextjs", "--auth-methods", "sms"},
			wantInErr: "magic-link",
		},
		{
			name:      "empty selection",
			args:      []string{"--template", "nextjs", "--auth-methods", ""},
			wantInErr: "no sign-in methods",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			_, err := runInit(t, dir, tt.args...)
			if err == nil || !strings.Contains(err.Error(), tt.wantInErr) {
				t.Fatalf("init %q error = %v, want one mentioning %q", tt.args, err, tt.wantInErr)
			}

			entries, err := os.ReadDir(dir)
			if err != nil {
				t.Fatal(err)
			}

			if len(entries) != 0 {
				t.Errorf(
					"a refusal wrote %d entries; it must leave the directory alone",
					len(entries),
				)
			}
		})
	}
}

// Running init --template where a backend already exists adds the template
// and nothing else: the backend's config is byte for byte what it was.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateAddsToExistingBackend(t *testing.T) {
	dir := t.TempDir()

	if _, err := runInit(t, dir); err != nil {
		t.Fatalf("first init: %v", err)
	}

	tomlPath := filepath.Join(dir, "nhost", "nhost.toml")

	before, err := os.ReadFile(tomlPath)
	if err != nil {
		t.Fatal(err)
	}

	// Without a template the second init still refuses, as it always has.
	if _, err := runInit(t, dir); err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("second plain init error = %v, want the existing refusal", err)
	}

	output, err := runInit(t, dir, "--template", "nextjs")
	if err != nil {
		t.Fatalf("init --template over a backend: %v\n%s", err, output)
	}

	if _, err := os.Stat(filepath.Join(dir, "frontend", "package.json")); err != nil {
		t.Errorf("frontend was not added: %v", err)
	}

	after, err := os.ReadFile(tomlPath)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(before, after) {
		t.Error("nhost.toml changed; an existing backend must be left as it is")
	}

	// The default selection needs no configuration, so there is nothing to
	// tell the user to switch on.
	if strings.Contains(output, "nhost/nhost.toml") {
		t.Errorf("next steps asked for config the default selection does not need:\n%s", output)
	}

	// A third run finds the frontend there and refuses before writing.
	if _, err := runInit(t, dir, "--template", "nextjs"); err == nil ||
		!strings.Contains(err.Error(), "already exists") {
		t.Fatalf("init --template over an existing frontend error = %v, want a refusal", err)
	}
}

// `printf '1\n' | nhost init --template` is the documented way to scaffold from
// a script, and it carries one line. Every question after the template has to
// settle for its default when there is no terminal, or that line runs out and
// the command fails having written nothing.
//
//nolint:paralleltest // swaps os.Stdin and changes the working directory
func TestInitTemplateScaffoldsFromOneLineOfPipedInput(t *testing.T) {
	withPipedStdin(t, "1\n")

	dir := t.TempDir()

	output, err := runInit(t, dir, "--template")
	if err != nil {
		t.Fatalf("init --template with piped input: %v\n%s", err, output)
	}

	if _, err := os.Stat(filepath.Join(dir, "frontend", "package.json")); err != nil {
		t.Fatalf("nothing was scaffolded: %v\n%s", err, output)
	}

	// The defaults the unasked questions fall back to.
	authDir := filepath.Join(dir, "frontend", "src", "app", "auth")

	entries, err := os.ReadDir(authDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(entries) != 1 || entries[0].Name() != "password" {
		t.Errorf("sign-in methods = %v, want just password", entries)
	}

	pkg, err := os.ReadFile(filepath.Join(dir, "frontend", "package.json"))
	if err != nil {
		t.Fatal(err)
	}

	if bytes.Contains(pkg, []byte("@radix-ui/react-slot")) {
		t.Error("the UI system is not the default, which brings no component library")
	}

	// The default drops dependencies, so the lockfile that ships with the
	// template no longer describes this project and is left out.
	if _, err := os.Stat(
		filepath.Join(dir, "frontend", "pnpm-lock.yaml"),
	); !os.IsNotExist(err) {
		t.Error("a lockfile that disagrees with package.json was shipped")
	}
}

// An existing backend is never rewritten, so asking for a method it ships
// disabled has to leave the user something to act on rather than a frontend
// whose sign-in page quietly fails.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateNamesMethodsToEnableOnExistingBackend(t *testing.T) {
	dir := t.TempDir()

	if _, err := runInit(t, dir); err != nil {
		t.Fatalf("first init: %v", err)
	}

	output, err := runInit(
		t, dir, "--template", "nextjs", "--auth-methods", "password,otp",
	)
	if err != nil {
		t.Fatalf("init --template over a backend: %v\n%s", err, output)
	}

	for _, want := range []string{"nhost/nhost.toml", "otp"} {
		if !strings.Contains(output, want) {
			t.Errorf("next steps do not mention %q:\n%s", want, output)
		}
	}

	// password needs no configuration, so naming it would send the user after
	// a setting that is already on.
	if strings.Contains(output, "password") {
		t.Errorf("next steps named password, which a stock backend already enables:\n%s", output)
	}
}

// The next steps are read off the existing config, so a method it already has
// on is not named: telling the user to enable it would send them to edit a
// setup that works.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateSkipsMethodsAlreadyOnInExistingBackend(t *testing.T) {
	dir := t.TempDir()

	if _, err := runInit(t, dir); err != nil {
		t.Fatalf("first init: %v", err)
	}

	cfg := readConfig(t, dir)

	on := true
	cfg.Auth.Method.Otp.Email.Enabled = &on

	if err := clienv.MarshalFile(
		cfg, filepath.Join(dir, "nhost", "nhost.toml"), toml.Marshal,
	); err != nil {
		t.Fatal(err)
	}

	output, err := runInit(
		t, dir, "--template", "nextjs", "--auth-methods", "magic-link,otp",
	)
	if err != nil {
		t.Fatalf("init --template over a backend: %v\n%s", err, output)
	}

	if !strings.Contains(output, "Enable magic-link in nhost/nhost.toml") {
		t.Errorf("next steps do not name magic-link alone:\n%s", output)
	}

	if strings.Contains(output, "otp") {
		t.Errorf("next steps named otp, already on in nhost.toml:\n%s", output)
	}
}

//nolint:paralleltest // changes the working directory
func TestInitTemplateRefusesToOverwrite(t *testing.T) {
	tests := []struct {
		name string
		// place puts something where the template's frontend would go.
		place func(t *testing.T, dir, outside string)
	}{
		{
			name: "a file",
			place: func(t *testing.T, dir, _ string) {
				t.Helper()

				err := os.WriteFile(
					filepath.Join(dir, "frontend"), []byte("mine"), 0o600,
				)
				if err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			// A link that resolves to nothing is still something there, and
			// writing through it would land outside the project.
			name: "a dangling symlink",
			place: func(t *testing.T, dir, outside string) {
				t.Helper()

				err := os.Symlink(
					filepath.Join(outside, "frontend"),
					filepath.Join(dir, "frontend"),
				)
				if err != nil {
					t.Fatal(err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir, outside := t.TempDir(), t.TempDir()
			tt.place(t, dir, outside)

			_, err := runInit(t, dir, "--template", "nextjs")
			if err == nil || !strings.Contains(err.Error(), "already exists") {
				t.Fatalf(
					"init over an existing frontend error = %v, "+
						"want one saying it already exists",
					err,
				)
			}

			// Refused before anything was written: the nhost folder is not
			// there either.
			if got := entries(t, dir); len(got) != 1 || got[0] != "frontend" {
				t.Errorf("a refused init changed the directory: %q", got)
			}

			if got := entries(t, outside); len(got) != 0 {
				t.Errorf("init wrote outside the project: %q", got)
			}
		})
	}
}

// A project's own agent context is not in the way of the frontend, so it is
// kept rather than refused, the template's copy is not written, and the output
// names what was skipped. A symlink counts as there whether or not it
// resolves, so a dangling one is never written through.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateKeepsExistingAgentContext(t *testing.T) {
	tests := []struct {
		name string
		args []string
		// backend runs a plain init first, for the additive path.
		backend bool
		// links are top-level entries made dangling symlinks into outside.
		links []string
		// files are top-level files, and dirs top-level directories each
		// holding one file, all with mine as their content.
		files []string
		dirs  []string
	}{
		{
			name:  "a dangling AGENTS.md symlink",
			links: []string{"AGENTS.md"},
		},
		{
			name:  "CLAUDE.md and .claude on a fresh project",
			files: []string{"CLAUDE.md"},
			dirs:  []string{".claude"},
		},
		{
			name:    "CLAUDE.md and .claude next to an existing backend",
			backend: true,
			files:   []string{"CLAUDE.md"},
			dirs:    []string{".claude"},
		},
		{
			// Retargeting rewrites the commands in the template's Markdown,
			// which must not reach a file the template did not write.
			name:  "another package manager leaves a kept doc alone",
			args:  []string{"--package-manager", "npm"},
			files: []string{"AGENTS.md", "SKILLS.md"},
			links: []string{"CLAUDE.md"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir, outside := t.TempDir(), t.TempDir()

			if tt.backend {
				if _, err := runInit(t, dir); err != nil {
					t.Fatalf("first init: %v", err)
				}
			}

			kept := placeAgentContext(
				t, dir, outside, tt.links, tt.files, tt.dirs,
			)

			args := append([]string{"--template", "nextjs"}, tt.args...)

			output, err := runInit(t, dir, args...)
			if err != nil {
				t.Fatalf("init %q: %v\n%s", args, err, output)
			}

			if _, err := os.Stat(
				filepath.Join(dir, "frontend", "package.json"),
			); err != nil {
				t.Errorf("frontend was not written: %v", err)
			}

			assertUntouched(t, dir, outside, kept)

			for _, e := range slices.Concat(tt.links, tt.files, tt.dirs) {
				if !strings.Contains(output, e) {
					t.Errorf("output does not name skipped %s:\n%s", e, output)
				}
			}
		})
	}
}

// placeAgentContext lays out a project's own agent context and returns every
// path it made, relative to dir, with what readEntry reads there.
func placeAgentContext(
	t *testing.T,
	dir, outside string,
	links, files, dirs []string,
) map[string]string {
	t.Helper()

	mine := "# Mine\n\ncd frontend && pnpm install && pnpm dev\n"
	kept := make(map[string]string)

	for _, l := range links {
		if err := os.Symlink(
			filepath.Join(outside, l), filepath.Join(dir, l),
		); err != nil {
			t.Fatal(err)
		}

		kept[l] = "-> " + filepath.Join(outside, l)
	}

	for _, f := range files {
		if err := os.WriteFile(
			filepath.Join(dir, f), []byte(mine), 0o600,
		); err != nil {
			t.Fatal(err)
		}

		kept[f] = mine
	}

	for _, d := range dirs {
		if err := os.Mkdir(filepath.Join(dir, d), 0o755); err != nil {
			t.Fatal(err)
		}

		p := filepath.Join(d, "mine.md")
		if err := os.WriteFile(
			filepath.Join(dir, p), []byte(mine), 0o600,
		); err != nil {
			t.Fatal(err)
		}

		kept[d] = "dir mine.md"
		kept[p] = mine
	}

	return kept
}

// assertUntouched checks every kept entry reads as it did before init ran,
// and that nothing was written through a link into outside.
func assertUntouched(
	t *testing.T,
	dir, outside string,
	kept map[string]string,
) {
	t.Helper()

	for p, want := range kept {
		if got := readEntry(t, filepath.Join(dir, p)); got != want {
			t.Errorf("%s changed: got %q, want %q", p, got, want)
		}
	}

	if got := entries(t, outside); len(got) != 0 {
		t.Errorf("init wrote outside the project: %q", got)
	}
}

// readEntry describes what is at p without following a symlink: a link as its
// target, a directory as its listing, a file as its content.
func readEntry(t *testing.T, p string) string {
	t.Helper()

	info, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}

	switch {
	case info.Mode()&os.ModeSymlink != 0:
		target, err := os.Readlink(p)
		if err != nil {
			t.Fatal(err)
		}

		return "-> " + target
	case info.IsDir():
		return "dir " + strings.Join(entries(t, p), " ")
	default:
		data, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}

		return string(data)
	}
}
