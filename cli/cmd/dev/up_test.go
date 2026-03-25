package dev

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/dockercompose"
)

func TestParseRunServiceOverride(t *testing.T) {
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
		},
		{
			name:        "with equals in value",
			input:       "my-service=KEY=VALUE",
			expectName:  "my-service",
			expectValue: "KEY=VALUE",
		},
		{
			name:      "no equals",
			input:     "invalid-format",
			expectErr: true,
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

func TestParseRunServiceCommands(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    []string
		expected map[string][]string
		hasErr   bool
	}{
		{
			name:     "empty",
			input:    []string{},
			expected: map[string][]string{},
		},
		{
			name:  "single command",
			input: []string{"my-service=nodemon src/index.ts"},
			expected: map[string][]string{
				"my-service": {"nodemon", "src/index.ts"},
			},
		},
		{
			name: "multiple services",
			input: []string{
				"svc1=npm run dev",
				"svc2=python manage.py runserver",
			},
			expected: map[string][]string{
				"svc1": {"npm", "run", "dev"},
				"svc2": {"python", "manage.py", "runserver"},
			},
		},
		{
			name:   "invalid format",
			input:  []string{"no-equals-sign"},
			hasErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := parseRunServiceCommands(tc.input)
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

			if diff := cmp.Diff(tc.expected, result); diff != "" {
				t.Errorf("mismatch (-want +got):\n%s", diff)
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
			name:  "valid volume",
			input: []string{"my-service=./src:/app/src"},
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
		})
	}
}

func TestParseRunServiceConfigFlag(t *testing.T) {
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
		},
		{
			name:            "path with overlay",
			input:           "./config.toml:dev",
			expectedPath:    "./config.toml",
			expectedOverlay: "dev",
		},
		{
			name:   "too many colons",
			input:  "a:b:c",
			hasErr: true,
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
		Path:            "/path/to/config.toml",
		Config:          nil,
		CommandOverride: []string{"nodemon", "src/index.ts"},
		BindMounts: []dockercompose.Volume{
			{
				Type:     "bind",
				Source:   "/local/src",
				Target:   "/app/src",
				ReadOnly: new(false),
			},
		},
	}

	if len(svc.CommandOverride) != 2 { //nolint:mnd
		t.Errorf("expected 2 command args, got %d", len(svc.CommandOverride))
	}

	if len(svc.BindMounts) != 1 {
		t.Errorf("expected 1 bind mount, got %d", len(svc.BindMounts))
	}
}
