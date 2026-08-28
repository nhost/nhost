package create

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

// withStdin points os.Stdin at a file holding input for exactly one prompt
// read. Each prompt helper makes a single read, so one file per call keeps the
// buffered reader from swallowing later lines.
func withStdin(t *testing.T, input string) {
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

		f.Close()
	})
}

func newTestEnv(output *bytes.Buffer) *clienv.CliEnv {
	return clienv.New(output, output, nil, "", "", "", "", "", "", "")
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptLine(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		defaultValue string
		want         string
	}{
		{name: "answer wins", input: "demo\n", defaultValue: "fallback", want: "demo"},
		{name: "empty takes default", input: "\n", defaultValue: "fallback", want: "fallback"},
		{name: "trims spaces", input: "  demo  \n", defaultValue: "", want: "demo"},
		{name: "empty with no default", input: "\n", defaultValue: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withStdin(t, tt.input)

			var output bytes.Buffer

			got, err := promptLine(newTestEnv(&output), "Project name", tt.defaultValue)
			if err != nil {
				t.Fatalf("promptLine: %v", err)
			}

			if got != tt.want {
				t.Errorf("promptLine() = %q, want %q", got, tt.want)
			}
		})
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptLineShowsDefault(t *testing.T) {
	withStdin(t, "\n")

	var output bytes.Buffer

	if _, err := promptLine(newTestEnv(&output), "Project name", "demo"); err != nil {
		t.Fatalf("promptLine: %v", err)
	}

	if !strings.Contains(output.String(), "[demo]") {
		t.Errorf("prompt did not show the default:\n%s", output.String())
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptConfirm(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		defaultYes bool
		want       bool
	}{
		{name: "yes", input: "y\n", defaultYes: false, want: true},
		{name: "long yes", input: "YES\n", defaultYes: false, want: true},
		{name: "no", input: "n\n", defaultYes: true, want: false},
		{name: "empty keeps default true", input: "\n", defaultYes: true, want: true},
		{name: "empty keeps default false", input: "\n", defaultYes: false, want: false},
		{name: "garbage is no", input: "maybe\n", defaultYes: true, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withStdin(t, tt.input)

			var output bytes.Buffer

			got, err := promptConfirm(newTestEnv(&output), "Install now?", tt.defaultYes)
			if err != nil {
				t.Fatalf("promptConfirm: %v", err)
			}

			if got != tt.want {
				t.Errorf("promptConfirm() = %v, want %v", got, tt.want)
			}
		})
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptPick(t *testing.T) {
	items := []pickerItem{
		{Label: "first", Desc: "the first one"},
		{Label: "second", Desc: ""},
		{Label: "third", Desc: ""},
	}

	tests := []struct {
		name    string
		input   string
		want    int
		wantErr bool
	}{
		{name: "picks by number", input: "2\n", want: 1, wantErr: false},
		{name: "empty picks first", input: "\n", want: 0, wantErr: false},
		{name: "out of range", input: "4\n", want: -1, wantErr: true},
		{name: "zero", input: "0\n", want: -1, wantErr: true},
		{name: "not a number", input: "second\n", want: -1, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withStdin(t, tt.input)

			var output bytes.Buffer

			got, err := promptPick(newTestEnv(&output), "Template", items, 0)
			if (err != nil) != tt.wantErr {
				t.Fatalf("promptPick() error = %v, wantErr %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Errorf("promptPick() = %d, want %d", got, tt.want)
			}
		})
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptPickSkipsSingleOption(t *testing.T) {
	var output bytes.Buffer

	// No stdin fixture: a single-option list must not read input at all.
	got, err := promptPick(newTestEnv(&output), "Template", []pickerItem{{Label: "only"}}, 0)
	if err != nil {
		t.Fatalf("promptPick: %v", err)
	}

	if got != 0 {
		t.Errorf("promptPick() = %d, want 0", got)
	}

	if output.Len() != 0 {
		t.Errorf("promptPick() printed a menu for one option:\n%s", output.String())
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptPickListsDescriptions(t *testing.T) {
	withStdin(t, "\n")

	var output bytes.Buffer

	items := []pickerItem{
		{Label: "Next.js", Desc: "App Router"},
		{Label: "React", Desc: ""},
	}

	if _, err := promptPick(newTestEnv(&output), "Template", items, 0); err != nil {
		t.Fatalf("promptPick: %v", err)
	}

	for _, want := range []string{"1. Next.js - App Router", "2. React"} {
		if !strings.Contains(output.String(), want) {
			t.Errorf("menu missing %q:\n%s", want, output.String())
		}
	}
}

//nolint:paralleltest // swaps os.Stdin
func TestPromptPickDefaultIndex(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		defaultIdx int
		want       int
		wantHint   int
	}{
		{name: "empty takes default", input: "\n", defaultIdx: 1, want: 1, wantHint: 2},
		{name: "answer beats default", input: "3\n", defaultIdx: 1, want: 2, wantHint: 2},
		{name: "out of range default", input: "\n", defaultIdx: 9, want: 0, wantHint: 1},
		{name: "negative default", input: "\n", defaultIdx: -1, want: 0, wantHint: 1},
	}

	items := []pickerItem{{Label: "first"}, {Label: "second"}, {Label: "third"}}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withStdin(t, tt.input)

			var output bytes.Buffer

			got, err := promptPick(newTestEnv(&output), "Template", items, tt.defaultIdx)
			if err != nil {
				t.Fatalf("promptPick: %v", err)
			}

			if got != tt.want {
				t.Errorf("promptPick() = %d, want %d", got, tt.want)
			}

			want := fmt.Sprintf("Select # [%d]", tt.wantHint)
			if !strings.Contains(output.String(), want) {
				t.Errorf("prompt missing %q:\n%s", want, output.String())
			}
		})
	}
}

func TestPromptPickEmpty(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	if _, err := promptPick(newTestEnv(&output), "Template", nil, 0); err == nil {
		t.Error("promptPick() with no items = nil error, want error")
	}
}
