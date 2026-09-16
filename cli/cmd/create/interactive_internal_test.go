package create

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func TestResolveChoices(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		args            []string
		interactive     bool
		want            choices
		wantAnswered    answered
		wantInteractive bool
		wantErr         error
	}{
		{
			name:            "non-interactive requires name",
			args:            nil,
			interactive:     false,
			want:            choices{},
			wantAnswered:    answered{},
			wantInteractive: false,
			wantErr:         errNameRequired,
		},
		{
			name:        "yes bypasses prompts",
			args:        []string{"--yes", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "demo",
				packageManager: defaultPackageManager,
				installNow:     true,
				startNow:       false,
			},
			wantAnswered: answered{
				template:       false,
				name:           true,
				packageManager: false,
				startNow:       false,
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
				packageManager: "bun",
				installNow:     false,
				startNow:       false,
			},
			wantAnswered: answered{
				template:       true,
				name:           true,
				packageManager: true,
				startNow:       false,
			},
			wantInteractive: true,
			wantErr:         nil,
		},
		{
			name:        "start is opt-in when prompts are skipped",
			args:        []string{"--yes", "--start", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "demo",
				packageManager: defaultPackageManager,
				installNow:     true,
				startNow:       true,
			},
			wantAnswered: answered{
				template:       false,
				name:           true,
				packageManager: false,
				startNow:       true,
			},
			wantInteractive: false,
			wantErr:         nil,
		},
		{
			name:            "start cannot run without the dependencies",
			args:            []string{"--yes", "--start", "--no-install", "demo"},
			interactive:     true,
			want:            choices{},
			wantAnswered:    answered{},
			wantInteractive: false,
			wantErr:         errStartNeedsInstall,
		},
		// --start is an answer to the only question left after the install, so
		// an interactive run that passes it has nothing to ask.
		{
			name:        "every answer on the command line leaves nothing to ask",
			args:        []string{"--package-manager", "npm", "--start", "demo"},
			interactive: true,
			want: choices{
				template:       defaultTemplate,
				name:           "demo",
				packageManager: "npm",
				installNow:     true,
				startNow:       true,
			},
			wantAnswered: answered{
				template:       false,
				name:           true,
				packageManager: true,
				startNow:       true,
			},
			wantInteractive: true,
			wantErr:         nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

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

	origPicker, origPrompt, origConfirm := runPicker, runPrompt, runConfirm

	t.Cleanup(func() {
		runPicker = origPicker
		runPrompt = origPrompt
		runConfirm = origConfirm
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

	// Whether to start is asked after the install, so runInteractive has no
	// confirm left to run.
	runConfirm = func(_ *clienv.CliEnv, message string, _ bool) (bool, error) {
		t.Fatalf("unexpected confirm %q", message)

		return false, nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
		startNow:       false,
	}, answered{})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	want := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "npm",
		installNow:     true,
		startNow:       false,
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

	runConfirm = func(_ *clienv.CliEnv, message string, _ bool) (bool, error) {
		t.Errorf("unexpected confirm %q", message)

		return false, nil
	}

	var output bytes.Buffer

	defaults := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "bun",
		installNow:     true,
		startNow:       false,
	}

	got, err := runInteractive(newTestEnv(&output), defaults, answered{
		template:       true,
		name:           true,
		packageManager: true,
		startNow:       true,
	})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	if got != defaults {
		t.Errorf("runInteractive() = %#v, want %#v", got, defaults)
	}
}

//nolint:paralleltest // mutates package-level prompt seams
func TestConfirmStart(t *testing.T) {
	tests := []struct {
		name       string
		resolved   choices
		ask        bool
		confirm    bool
		wantAsked  bool
		wantResult bool
	}{
		{
			name:       "enter starts the servers",
			resolved:   choices{installNow: true},
			ask:        true,
			confirm:    true,
			wantAsked:  true,
			wantResult: true,
		},
		{
			name:       "declining leaves the servers alone",
			resolved:   choices{installNow: true},
			ask:        true,
			confirm:    false,
			wantAsked:  true,
			wantResult: false,
		},
		{
			name:       "--start answers the question up front",
			resolved:   choices{installNow: true, startNow: true},
			ask:        false,
			confirm:    false,
			wantAsked:  false,
			wantResult: true,
		},
		// Nothing to start without the dependencies, so the question is not
		// worth asking: a failed install lands here too.
		{
			name:       "no dependencies, no question",
			resolved:   choices{installNow: false},
			ask:        true,
			confirm:    true,
			wantAsked:  false,
			wantResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stubPrompts(t)

			asked := false

			runConfirm = func(_ *clienv.CliEnv, _ string, _ bool) (bool, error) {
				asked = true

				return tt.confirm, nil
			}

			var output bytes.Buffer

			got, err := confirmStart(newTestEnv(&output), tt.resolved, tt.ask)
			if err != nil {
				t.Fatalf("confirmStart: %v", err)
			}

			if got != tt.wantResult {
				t.Errorf("confirmStart() = %v, want %v", got, tt.wantResult)
			}

			if asked != tt.wantAsked {
				t.Errorf("asked = %v, want %v", asked, tt.wantAsked)
			}
		})
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

	runConfirm = func(_ *clienv.CliEnv, _ string, _ bool) (bool, error) {
		return true, nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
		startNow:       false,
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

var errPickerFailed = errors.New("picker failed")

//nolint:paralleltest // mutates package-level prompt seams
func TestRunInteractivePropagatesPickerError(t *testing.T) {
	stubPrompts(t)

	runPicker = func(_ *clienv.CliEnv, _ string, _ []pickerItem, _ int) (int, error) {
		return -1, errPickerFailed
	}

	var output bytes.Buffer

	if _, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
		startNow:       false,
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

	runConfirm = func(_ *clienv.CliEnv, _ string, defaultYes bool) (bool, error) {
		return defaultYes, nil
	}

	var output bytes.Buffer

	defaults := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "bun",
		installNow:     false,
		startNow:       false,
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

func TestPrintNextStepsUsesManagerScriptSyntax(t *testing.T) {
	t.Parallel()

	tests := []struct {
		packageManager string
		wantDev        string
	}{
		{
			packageManager: "pnpm",
			wantDev:        "cd demo/frontend && pnpm install && pnpm dev",
		},
		{
			packageManager: "npm",
			wantDev:        "cd demo/frontend && npm install && npm run dev",
		},
		{
			packageManager: "bun",
			wantDev:        "cd demo/frontend && bun install && bun run dev",
		},
	}

	for _, tt := range tests {
		t.Run(tt.packageManager, func(t *testing.T) {
			t.Parallel()

			var output bytes.Buffer

			printNextSteps(newTestEnv(&output), choices{
				template:       defaultTemplate,
				name:           "demo",
				packageManager: tt.packageManager,
				installNow:     false,
				startNow:       false,
			})

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
