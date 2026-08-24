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
		wantInteractive bool
		wantErr         error
	}{
		{
			name:            "non-interactive requires name",
			args:            nil,
			interactive:     false,
			want:            choices{},
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
			},
			wantInteractive: true,
			wantErr:         nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, interactive, err := resolveChoicesForTest(t, tt.args, tt.interactive)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolveChoices() error = %v, want %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Errorf("resolveChoices() choices = %#v, want %#v", got, tt.want)
			}

			if interactive != tt.wantInteractive {
				t.Errorf(
					"resolveChoices() interactive = %v, want %v",
					interactive, tt.wantInteractive,
				)
			}
		})
	}
}

func TestResolveChoicesRejectsUnknownTemplate(t *testing.T) {
	t.Parallel()

	_, _, err := resolveChoicesForTest(t, []string{"--template", "nope", "demo"}, false)
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

	runConfirm = func(_ *clienv.CliEnv, message string, _ bool) (bool, error) {
		if message != "Install frontend dependencies now?" {
			t.Fatalf("unexpected confirm %q", message)
		}

		return false, nil
	}

	var output bytes.Buffer

	got, err := runInteractive(newTestEnv(&output), choices{
		template:       defaultTemplate,
		name:           "",
		packageManager: defaultPackageManager,
		installNow:     true,
	})
	if err != nil {
		t.Fatalf("runInteractive: %v", err)
	}

	want := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "npm",
		installNow:     false,
	}
	if got != want {
		t.Errorf("runInteractive() = %#v, want %#v", got, want)
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
	})
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
	}); !errors.Is(err, errPickerFailed) {
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
	}

	got, err := runInteractive(newTestEnv(&output), defaults)
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
		wantCodegen    string
	}{
		{
			packageManager: "pnpm",
			wantDev:        "cd demo/frontend && pnpm install && pnpm dev",
			wantCodegen:    "After you change the schema, run `pnpm codegen`",
		},
		{
			packageManager: "npm",
			wantDev:        "cd demo/frontend && npm install && npm run dev",
			wantCodegen:    "After you change the schema, run `npm run codegen`",
		},
		{
			packageManager: "bun",
			wantDev:        "cd demo/frontend && bun install && bun run dev",
			wantCodegen:    "After you change the schema, run `bun run codegen`",
		},
	}

	for _, tt := range tests {
		t.Run(tt.packageManager, func(t *testing.T) {
			t.Parallel()

			var output bytes.Buffer

			printNextSteps(newTestEnv(&output), "demo", tt.packageManager, true)

			if !strings.Contains(output.String(), tt.wantDev) {
				t.Errorf("next steps missing %q:\n%s", tt.wantDev, output.String())
			}

			if !strings.Contains(output.String(), tt.wantCodegen) {
				t.Errorf("next steps missing %q:\n%s", tt.wantCodegen, output.String())
			}
		})
	}
}

func resolveChoicesForTest(
	t *testing.T,
	args []string,
	interactive bool,
) (choices, bool, error) {
	t.Helper()

	cmd := Command()

	var (
		got              choices
		runInteractively bool
	)

	cmd.Action = func(_ context.Context, cmd *cli.Command) error {
		var err error

		got, runInteractively, err = resolveChoices(cmd, interactive)

		return err
	}

	err := cmd.Run(context.Background(), append([]string{"create"}, args...))
	if err != nil {
		return got, runInteractively, fmt.Errorf("run create command: %w", err)
	}

	return got, runInteractively, nil
}
