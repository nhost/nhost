package create

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

//nolint:paralleltest // t.Chdir fixes the directory the target resolves against
func TestResolveChoices(t *testing.T) {
	workspace := filepath.Join(t.TempDir(), "workspace")
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	t.Chdir(workspace)

	tests := []struct {
		name            string
		args            []string
		interactive     bool
		want            choices
		wantAnswered    answered
		wantInteractive bool
		wantErr         error
	}{
		// Without a directory to name it after, the project is the starter's
		// own name rather than whatever the user happens to be standing in.
		{
			name:        "no argument takes the default name",
			args:        []string{"--yes"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           defaultProjectName,
				rel:            "",
				packageManager: defaultPackageManager,
				installNow:     true,
			},
			wantAnswered: answered{
				template:       false,
				name:           false,
				packageManager: false,
			},
			wantInteractive: false,
			wantErr:         nil,
		},
		// A directory argument names the project, so one with nothing
		// name-shaped in it leaves it nameless, and without a prompt to fall
		// back on that has to stop.
		{
			name:            "non-interactive needs a usable name",
			args:            []string{"./___"},
			interactive:     false,
			want:            choices{},
			wantAnswered:    answered{},
			wantInteractive: false,
			wantErr:         errNameRequired,
		},
		{
			name:        "--name overrides the directory",
			args:        []string{"--yes", "--name", "billing", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "billing",
				rel:            "demo",
				packageManager: defaultPackageManager,
				installNow:     true,
			},
			wantAnswered: answered{
				template:       false,
				name:           true,
				dir:            true,
				packageManager: false,
			},
			wantInteractive: false,
			wantErr:         nil,
		},
		{
			name:        "yes bypasses prompts",
			args:        []string{"--yes", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "demo",
				rel:            "demo",
				packageManager: defaultPackageManager,
				installNow:     true,
			},
			wantAnswered: answered{
				template:       false,
				name:           false,
				dir:            true,
				packageManager: false,
			},
			wantInteractive: false,
			wantErr:         nil,
		},
		{
			name: "flags pre-seed interactive choices",
			args: []string{
				"--template", "nextjs-shadcn",
				"--package-manager", "bun",
				"--no-install",
				"demo",
			},
			interactive: true,
			want: choices{
				template:       "nextjs-shadcn",
				name:           "demo",
				rel:            "demo",
				packageManager: "bun",
				installNow:     false,
			},
			wantAnswered: answered{
				template:       true,
				name:           false,
				dir:            true,
				packageManager: true,
			},
			wantInteractive: true,
			wantErr:         nil,
		},
		// An interactive run still asks for what the command line left out,
		// which here is the template.
		{
			name:        "flags and an argument answer what they name",
			args:        []string{"--package-manager", "npm", "--name", "demo", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "demo",
				rel:            "demo",
				packageManager: "npm",
				installNow:     true,
			},
			wantAnswered: answered{
				template:       false,
				name:           true,
				dir:            true,
				packageManager: true,
			},
			wantInteractive: true,
			wantErr:         nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// dir is whatever the temp workspace happens to be, so the table
			// carries the relative path and the absolute one is filled in here.
			if tt.wantErr == nil {
				tt.want.dir = filepath.Join(workspace, tt.want.rel)
			}

			got, err := resolveChoicesForTest(t, tt.args, tt.interactive)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolveChoices() error = %v, want %v", err, tt.wantErr)
			}

			if got.choices != tt.want {
				t.Errorf("resolveChoices() choices = %#v, want %#v", got.choices, tt.want)
			}

			if got.answered != tt.wantAnswered {
				t.Errorf(
					"resolveChoices() answered = %#v, want %#v",
					got.answered, tt.wantAnswered,
				)
			}

			if got.prompt != tt.wantInteractive {
				t.Errorf(
					"resolveChoices() prompt = %v, want %v",
					got.prompt, tt.wantInteractive,
				)
			}
		})
	}
}

// The directory a project lands in names it, and directory names are freer
// than project names: spaces, leading underscores and trailing punctuation all
// have to come out the other side as something validateName accepts.
func TestNameFromDir(t *testing.T) {
	t.Parallel()

	tests := []struct {
		dir  string
		want string
	}{
		{dir: "/tmp/my-app", want: "my-app"},
		{dir: "/tmp/My_App.v2", want: "My_App.v2"},
		{dir: "/tmp/my project", want: "my-project"},
		{dir: "/tmp/_tmp", want: "tmp"},
		{dir: "/tmp/2026-notes", want: "2026-notes"},
		{dir: "/tmp/trailing-", want: "trailing"},
		{dir: "/tmp/@scope", want: "scope"},
		// Nothing here can start a project name, so there is no name to
		// derive and the caller has to ask or give up.
		{dir: "/tmp/___", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.dir, func(t *testing.T) {
			t.Parallel()

			got := nameFromDir(tt.dir)
			if got != tt.want {
				t.Errorf("nameFromDir(%q) = %q, want %q", tt.dir, got, tt.want)
			}

			if got == "" {
				return
			}

			if err := validateName(got); err != nil {
				t.Errorf("nameFromDir(%q) = %q, which is not a valid name: %v", tt.dir, got, err)
			}
		})
	}
}

func TestResolveChoicesRejectsUnknownTemplate(t *testing.T) {
	t.Parallel()

	_, err := resolveChoicesForTest(t, []string{"--template", "nope", "demo"}, false)
	if err == nil || !strings.Contains(err.Error(), "unknown template") {
		t.Fatalf("resolveChoices() error = %v, want unknown template", err)
	}
}

// stubPrompts restores the prompt seams after a test mutates them.
func stubPrompts(t *testing.T) {
	t.Helper()

	origPicker, origPrompt := runPicker, runPrompt

	t.Cleanup(func() {
		runPicker = origPicker
		runPrompt = origPrompt
	})
}

//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractive(t *testing.T) {
	stubPrompts(t)

	runPicker = func(_ *clienv.CliEnv, title string, _ []pickerItem, _ int) (int, error) {
		switch title {
		case "Template":
			return 0, nil
		case "Package manager":
			return 1, nil
		default:
			t.Fatalf("unexpected picker %q", title)

			return -1, nil
		}
	}

	runPrompt = func(_ *clienv.CliEnv, label, _ string) (string, error) {
		if label != "Project name" {
			t.Fatalf("unexpected prompt %q", label)
		}

		return "demo", nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, answered{})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	want := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "npm",
		installNow:     true,
	}
	if got != want {
		t.Errorf("runInteractive() = %#v, want %#v", got, want)
	}
}

// An answer that came in as a flag or an argument is not asked for again.
//
//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractiveSkipsWhatTheCommandLineAnswered(t *testing.T) {
	stubPrompts(t)

	runPicker = func(_ *clienv.CliEnv, title string, _ []pickerItem, _ int) (int, error) {
		t.Errorf("unexpected picker %q", title)

		return -1, nil
	}

	runPrompt = func(_ *clienv.CliEnv, label, _ string) (string, error) {
		t.Errorf("unexpected prompt %q", label)

		return "", nil
	}

	var output bytes.Buffer

	defaults := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "bun",
		installNow:     true,
	}

	got, err := runInteractive(newTestEnv(&output), defaults, answered{
		template:       true,
		name:           true,
		packageManager: true,
	})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	if got != defaults {
		t.Errorf("runInteractive() = %#v, want %#v", got, defaults)
	}
}

//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractiveRepromptsOnInvalidName(t *testing.T) {
	stubPrompts(t)

	runPicker = func(_ *clienv.CliEnv, _ string, _ []pickerItem, _ int) (int, error) {
		return 0, nil
	}

	prompts := []string{"bad name!", "demo"}
	promptCalls := 0

	runPrompt = func(_ *clienv.CliEnv, _, _ string) (string, error) {
		value := prompts[promptCalls]
		promptCalls++

		return value, nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, answered{})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	if promptCalls != 2 {
		t.Errorf("prompt calls = %d, want 2", promptCalls)
	}

	if got.name != "demo" {
		t.Errorf("name = %q, want %q", got.name, "demo")
	}

	if !strings.Contains(output.String(), "invalid project name") {
		t.Errorf("output missing validation warning:\n%s", output.String())
	}
}

// Naming the project is the first question, because it is the answer that
// decides where the project lands and it arrives already filled in from the
// directory the command was pointed at, so the usual answer is enter.
//
//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractiveAsksNameFirst(t *testing.T) {
	stubPrompts(t)

	var asked []string

	runPrompt = func(_ *clienv.CliEnv, label, defaultValue string) (string, error) {
		asked = append(asked, label)

		return defaultValue, nil
	}

	runPicker = func(_ *clienv.CliEnv, title string, _ []pickerItem, defaultIdx int) (int, error) {
		asked = append(asked, title)

		return defaultIdx, nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "skate-app",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, answered{})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	want := "Project name > Template > Package manager"
	if got := strings.Join(asked, " > "); got != want {
		t.Errorf("asked %q, want %q", got, want)
	}

	if got.name != "skate-app" {
		t.Errorf("name = %q, want %q: enter accepts the default", got.name, "skate-app")
	}
}

var errPickerFailed = errors.New("picker failed")

//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractivePropagatesPickerError(t *testing.T) {
	stubPrompts(t)

	// The name is asked first, so it has to be answered for the run to reach a
	// picker at all.
	runPrompt = func(_ *clienv.CliEnv, _, _ string) (string, error) {
		return "demo", nil
	}

	runPicker = func(_ *clienv.CliEnv, _ string, _ []pickerItem, _ int) (int, error) {
		return -1, errPickerFailed
	}

	var output bytes.Buffer

	if _, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, answered{}); !errors.Is(err, errPickerFailed) {
		t.Fatalf("runInteractive() error = %v, want errPickerFailed", err)
	}
}

func TestIndexOfPackageManager(t *testing.T) {
	t.Parallel()

	tests := []struct {
		preferred string
		want      int
	}{
		{preferred: defaultPackageManager, want: 0},
		{preferred: "npm", want: 1},
		{preferred: "bun", want: 2},
		{preferred: "yarn", want: 3},
		{preferred: "unknown", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.preferred, func(t *testing.T) {
			t.Parallel()

			if got := indexOfPackageManager(tt.preferred); got != tt.want {
				t.Errorf("indexOfPackageManager(%q) = %d, want %d", tt.preferred, got, tt.want)
			}
		})
	}
}

// The name decides the directory when the command line did not, and the
// directory you are already standing in counts as the answer when it is
// already the project's name.
func TestRetarget(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		dir     string
		project string
		wantDir string
		wantRel string
	}{
		{
			name:    "a name of its own gets a directory of its own",
			dir:     filepath.Join("/tmp", "nhost-create-test"),
			project: "skate-app",
			wantDir: filepath.Join("/tmp", "nhost-create-test", "skate-app"),
			wantRel: "skate-app",
		},
		{
			name:    "the directory you made and entered stays the target",
			dir:     filepath.Join("/tmp", "my-app"),
			project: "my-app",
			wantDir: filepath.Join("/tmp", "my-app"),
			wantRel: "",
		},
		// nameFromDir is what the prompt offered, so accepting a default the
		// directory name cannot spell verbatim still means here.
		{
			name:    "a name the directory could not spell still matches",
			dir:     filepath.Join("/tmp", "my project"),
			project: "my-project",
			wantDir: filepath.Join("/tmp", "my project"),
			wantRel: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := retarget(choices{
				template:       defaultTemplate,
				name:           tt.project,
				dir:            tt.dir,
				rel:            "",
				packageManager: defaultPackageManager,
				installNow:     true,
			})

			if got.dir != tt.wantDir {
				t.Errorf("retarget() dir = %q, want %q", got.dir, tt.wantDir)
			}

			if got.rel != tt.wantRel {
				t.Errorf("retarget() rel = %q, want %q", got.rel, tt.wantRel)
			}
		})
	}
}

func TestIndexOfTemplate(t *testing.T) {
	t.Parallel()

	if got := indexOfTemplate(defaultTemplate); got != 0 {
		t.Errorf("indexOfTemplate(%q) = %d, want 0", defaultTemplate, got)
	}

	if got := indexOfTemplate("nope"); got != 0 {
		t.Errorf("indexOfTemplate(%q) = %d, want 0", "nope", got)
	}
}

// The flag-provided values have to reach the pickers as their pre-selected
// answer, otherwise enter would silently discard them.
//
//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractivePreselectsFlagChoices(t *testing.T) {
	stubPrompts(t)

	defaultIdx := map[string]int{}

	runPicker = func(_ *clienv.CliEnv, title string, _ []pickerItem, idx int) (int, error) {
		defaultIdx[title] = idx

		return idx, nil
	}

	runPrompt = func(_ *clienv.CliEnv, _, defaultValue string) (string, error) {
		return defaultValue, nil
	}

	var output bytes.Buffer

	defaults := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "bun",
		installNow:     false,
	}

	got, err := runInteractive(newTestEnv(&output), defaults, answered{})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	if got != defaults {
		t.Errorf("runInteractive() = %#v, want %#v", got, defaults)
	}

	if defaultIdx["Package manager"] != 2 {
		t.Errorf("package manager default index = %d, want 2", defaultIdx["Package manager"])
	}

	if defaultIdx["Template"] != 0 {
		t.Errorf("template default index = %d, want 0", defaultIdx["Template"])
	}
}

// The create ends by saying what it made and where, so the commands under it
// are read against a project that has been reported as created.
// A development build is not the `nhost` on anyone's PATH. Telling the user to
// run that one sends them to whatever release they installed, which knows
// nothing of the project name file and names the compose project after the
// directory, so the backend comes up as backend-* rather than as the project.
func TestPrintNextStepsNamesTheBuildThatScaffolded(t *testing.T) {
	t.Parallel()

	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("Executable: %v", err)
	}

	var output bytes.Buffer

	printNextSteps(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "demo",
		rel:            "demo",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, devVersion)

	if !strings.Contains(output.String(), "cd demo/backend && "+exe+" up") {
		t.Errorf("a dev build did not hand back itself:\n%s", output.String())
	}
}

func TestNhostCommand(t *testing.T) {
	t.Parallel()

	if got := nhostCommand("1.51.0"); got != "nhost" {
		t.Errorf("nhostCommand(release) = %q, want %q", got, "nhost")
	}

	if got := nhostCommand(devVersion); got == "nhost" {
		t.Error("nhostCommand(dev) = \"nhost\", want the running executable")
	}
}

func TestPrintNextStepsAnnouncesTheProject(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	printNextSteps(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "demo",
		rel:            "demo",
		packageManager: defaultPackageManager,
		installNow:     true,
	}, "1.0.0")

	if !strings.Contains(output.String(), "Created demo in ./demo") {
		t.Errorf("the project was never announced:\n%s", output.String())
	}
}

func TestPrintNextStepsUsesManagerScriptSyntax(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		packageManager string
		rel            string
		wantDev        string
	}{
		{
			name:           "pnpm",
			packageManager: "pnpm",
			rel:            "demo",
			wantDev:        "cd demo/frontend && pnpm install && pnpm dev",
		},
		{
			name:           "npm",
			packageManager: "npm",
			rel:            "demo",
			wantDev:        "cd demo/frontend && npm install && npm run dev",
		},
		{
			name:           "bun",
			packageManager: "bun",
			rel:            "demo",
			wantDev:        "cd demo/frontend && bun install && bun run dev",
		},
		// Scaffolding into the current directory is the default, and there
		// the project is not under a directory to cd into first.
		{
			name:           "current directory",
			packageManager: "pnpm",
			rel:            "",
			wantDev:        "cd frontend && pnpm install && pnpm dev",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var output bytes.Buffer

			printNextSteps(newTestEnv(&output), choices{
				template:       defaultTemplate,
				name:           "demo",
				rel:            tt.rel,
				packageManager: tt.packageManager,
				installNow:     false,
			}, "1.0.0")

			if !strings.Contains(output.String(), tt.wantDev) {
				t.Errorf("next steps missing %q:\n%s", tt.wantDev, output.String())
			}

			// Nothing is serving yet on a create that stopped short of
			// starting, so the next steps must not advertise an app URL.
			if strings.Contains(output.String(), "localhost:3000") {
				t.Errorf(
					"next steps advertise an app URL with nothing running:\n%s",
					output.String(),
				)
			}
		})
	}
}

func resolveChoicesForTest(
	t *testing.T,
	args []string,
	interactive bool,
) (resolution, error) {
	t.Helper()

	cmd := Command()

	var got resolution

	cmd.Action = func(_ context.Context, cmd *cli.Command) error {
		var err error

		got, err = resolveChoices(cmd, interactive)

		return err
	}

	err := cmd.Run(context.Background(), append([]string{"create"}, args...))
	if err != nil {
		return got, fmt.Errorf("run create command: %w", err)
	}

	return got, nil
}
