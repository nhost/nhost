package dev //nolint:testpackage

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
)

func TestParseRunServiceOverride(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []struct {
		name        string
		input       string
		expectName  string
		expectValue string
		expectErr   bool
	}{
		{
			name:        "simple",
			input:       "my-service=nodemon src/index.ts",
			expectName:  "my-service",
			expectValue: "nodemon src/index.ts",
			expectErr:   false,
		},
		{
			name:        "with equals in value",
			input:       "my-service=KEY=VALUE",
			expectName:  "my-service",
			expectValue: "KEY=VALUE",
			expectErr:   false,
		},
		{
			name:        "no equals",
			input:       "invalid-format",
			expectName:  "",
			expectValue: "",
			expectErr:   true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			name, value, err := parseRunServiceOverride(tc.input)
			if tc.expectErr {
				if err == nil {
					t.Error("expected error but got nil")
				}

				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)

				return
			}

			if name != tc.expectName {
				t.Errorf("expected name %q, got %q", tc.expectName, name)
			}

			if value != tc.expectValue {
				t.Errorf("expected value %q, got %q", tc.expectValue, value)
			}
		})
	}
}

func TestParseRunServiceVolumes(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		input  []string
		hasErr bool
	}{
		{
			name:   "valid volume",
			input:  []string{"my-service=./src:/app/src"},
			hasErr: false,
		},
		{
			name:   "invalid format no equals",
			input:  []string{"no-equals"},
			hasErr: true,
		},
		{
			name:   "invalid volume no colon",
			input:  []string{"my-service=/local/path"},
			hasErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := parseRunServiceVolumes(tc.input)
			if tc.hasErr {
				if err == nil {
					t.Error("expected error but got nil")
				}

				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)

				return
			}

			assertValidVolume(t, result)
		})
	}
}

func assertValidVolume(t *testing.T, result map[string][]dockercompose.Volume) {
	t.Helper()

	if result == nil {
		t.Error("expected non-nil result")

		return
	}

	vols, ok := result["my-service"]
	if !ok {
		t.Error("expected my-service key in result")

		return
	}

	if len(vols) != 1 {
		t.Errorf("expected 1 volume, got %d", len(vols))

		return
	}

	if vols[0].Type != "bind" {
		t.Errorf("expected bind type, got %s", vols[0].Type)
	}

	if vols[0].Target != "/app/src" {
		t.Errorf("expected target /app/src, got %s", vols[0].Target)
	}

	if *vols[0].ReadOnly != false {
		t.Error("expected ReadOnly to be false")
	}
}

func TestParseRunServiceConfigFlag(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []struct {
		name            string
		input           string
		expectedPath    string
		expectedOverlay string
		hasErr          bool
	}{
		{
			name:            "path only",
			input:           "./config.toml",
			expectedPath:    "./config.toml",
			expectedOverlay: "",
			hasErr:          false,
		},
		{
			name:            "path with overlay",
			input:           "./config.toml:dev",
			expectedPath:    "./config.toml",
			expectedOverlay: "dev",
			hasErr:          false,
		},
		{
			name:            "too many colons",
			input:           "a:b:c",
			expectedPath:    "",
			expectedOverlay: "",
			hasErr:          true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			path, overlay, err := parseRunServiceConfigFlag(tc.input)
			if tc.hasErr {
				if err == nil {
					t.Error("expected error but got nil")
				}

				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)

				return
			}

			if path != tc.expectedPath {
				t.Errorf("expected path %q, got %q", tc.expectedPath, path)
			}

			if overlay != tc.expectedOverlay {
				t.Errorf("expected overlay %q, got %q", tc.expectedOverlay, overlay)
			}
		})
	}
}

// Verify that RunService struct supports overrides.
func TestRunServiceOverrideFields(t *testing.T) {
	t.Parallel()

	svc := &dockercompose.RunService{
		Path:   "/path/to/config.toml",
		Config: nil,
		BindMounts: []dockercompose.Volume{
			{
				Type:     "bind",
				Source:   "/local/src",
				Target:   "/app/src",
				ReadOnly: new(false),
			},
		},
	}

	if len(svc.BindMounts) != 1 {
		t.Errorf("expected 1 bind mount, got %d", len(svc.BindMounts))
	}
}

// withStdin points os.Stdin at a file holding the answer to one prompt.
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

var errUpFailed = errors.New("failed to start docker compose")

// Declining the teardown, or not being able to ask about it, says nothing about
// whether the environment came up, so `nhost up` has to keep reporting the
// failure. A script that chains onto a running backend only has the exit code
// to go on.
//
//nolint:paralleltest // swaps os.Stdin
func TestUpErrReportsTheFailureWhateverTheAnswer(t *testing.T) {
	tests := []struct {
		name  string
		stdin string
	}{
		{name: "declines the teardown", stdin: "n\n"},
		{name: "cannot read an answer", stdin: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withStdin(t, tt.stdin)

			var output bytes.Buffer

			ce := clienv.New(&output, &output, nil, "", "", "", "", "", "", "")

			err := upErr(ce, nil, false, errUpFailed)
			if !errors.Is(err, errUpFailed) {
				t.Errorf("upErr() = %v, want errUpFailed", err)
			}
		})
	}
}
