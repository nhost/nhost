package config

import (
	"os"
	"testing"
)

func TestInterpolateEnv(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		envVars  map[string]string
		expected string
	}{
		{
			name:     "simple variable substitution",
			input:    "admin_secret = \"$SECRET\"",
			envVars:  map[string]string{"SECRET": "mysecret"},
			expected: "admin_secret = \"mysecret\"",
		},
		{
			name:     "multiple variables",
			input:    "$VAR1 and $VAR2",
			envVars:  map[string]string{"VAR1": "hello", "VAR2": "world"},
			expected: "hello and world",
		},
		{
			name:     "variable with underscores",
			input:    "$MY_VAR_123",
			envVars:  map[string]string{"MY_VAR_123": "value"},
			expected: "value",
		},
		{
			name:     "escaped with $$",
			input:    "price = $$100",
			envVars:  map[string]string{},
			expected: "price = $100",
		},
		{
			name:     "escaped with backslash",
			input:    "price = \\$100",
			envVars:  map[string]string{},
			expected: "price = $100",
		},
		{
			name:     "mix of escaped and variable",
			input:    "$$SECRET is $SECRET",
			envVars:  map[string]string{"SECRET": "hidden"},
			expected: "$SECRET is hidden",
		},
		{
			name:     "undefined variable",
			input:    "value = $UNDEFINED",
			envVars:  map[string]string{},
			expected: "value = ",
		},
		{
			name:     "variable at end",
			input:    "end$VAR",
			envVars:  map[string]string{"VAR": "value"},
			expected: "endvalue",
		},
		{
			name:     "dollar sign alone at end",
			input:    "end$",
			envVars:  map[string]string{},
			expected: "end$",
		},
		{
			name:     "dollar sign with non-alphanum",
			input:    "$ hello",
			envVars:  map[string]string{},
			expected: "$ hello",
		},
		{
			name:     "no variables",
			input:    "plain text without variables",
			envVars:  map[string]string{},
			expected: "plain text without variables",
		},
		{
			name:     "empty string",
			input:    "",
			envVars:  map[string]string{},
			expected: "",
		},
		{
			name:     "multiple escapes in a row",
			input:    "$$$$",
			envVars:  map[string]string{},
			expected: "$$",
		},
		{
			name:     "variable surrounded by text",
			input:    "prefix$VAR suffix",
			envVars:  map[string]string{"VAR": "middle"},
			expected: "prefixmiddle suffix",
		},
		{
			name:     "backslash escape followed by variable",
			input:    "\\$100 costs $PRICE",
			envVars:  map[string]string{"PRICE": "$50"},
			expected: "$100 costs $50",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Create isolated getenv function
			getenv := func(key string) string {
				return tt.envVars[key]
			}

			result := interpolateEnv(tt.input, getenv)
			if result != tt.expected {
				t.Errorf("interpolateEnv() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestInterpolateEnvRealWorld(t *testing.T) {
	t.Parallel()

	envVars := map[string]string{
		"ADMIN_SECRET": "super-secret-key",
		"SUBDOMAIN":    "myapp",
	}
	getenv := func(key string) string {
		return envVars[key]
	}

	input := `[local]
admin_secret = "$ADMIN_SECRET"

[[projects]]
subdomain = "$SUBDOMAIN"
admin_secret = "$ADMIN_SECRET"
# Price is $$100
`

	expected := `[local]
admin_secret = "super-secret-key"

[[projects]]
subdomain = "myapp"
admin_secret = "super-secret-key"
# Price is $100
`

	result := interpolateEnv(input, getenv)
	if result != expected {
		t.Errorf("interpolateEnv() = %q, want %q", result, expected)
	}
}

func TestIsAlphaNumUnderscore(t *testing.T) {
	t.Parallel()

	tests := []struct {
		char     byte
		expected bool
	}{
		{'a', true},
		{'z', true},
		{'A', true},
		{'Z', true},
		{'0', true},
		{'9', true},
		{'_', true},
		{'-', false},
		{'.', false},
		{'$', false},
		{' ', false},
		{'/', false},
	}

	for _, tt := range tests {
		t.Run(string(tt.char), func(t *testing.T) {
			t.Parallel()

			result := isAlphaNumUnderscore(tt.char)
			if result != tt.expected {
				t.Errorf("isAlphaNumUnderscore(%q) = %v, want %v", tt.char, result, tt.expected)
			}
		})
	}
}

func TestLoadWithInterpolation(t *testing.T) {
	// Create a temporary config file
	content := `[local]
admin_secret = "$TEST_ADMIN_SECRET"

[[projects]]
subdomain = "myapp"
region = "us-east-1"
admin_secret = "$TEST_PROJECT_SECRET"
allow_queries = ["*"]
`

	tmpfile, err := os.CreateTemp(t.TempDir(), "config-*.toml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpfile.Name())

	if _, err := tmpfile.WriteString(content); err != nil {
		t.Fatal(err)
	}

	if err := tmpfile.Close(); err != nil {
		t.Fatal(err)
	}

	// Set environment variables
	t.Setenv("TEST_ADMIN_SECRET", "local-secret")
	t.Setenv("TEST_PROJECT_SECRET", "project-secret")

	// Load config
	config, err := Load(tmpfile.Name())
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	// Verify interpolation worked
	if config.Local == nil {
		t.Fatal("config.Local is nil")
	}

	if config.Local.AdminSecret != "local-secret" {
		t.Errorf("config.Local.AdminSecret = %q, want %q", config.Local.AdminSecret, "local-secret")
	}

	if len(config.Projects) != 1 {
		t.Fatalf("len(config.Projects) = %d, want 1", len(config.Projects))
	}

	if config.Projects[0].AdminSecret == nil {
		t.Fatal("config.Projects[0].AdminSecret is nil")
	}

	if *config.Projects[0].AdminSecret != "project-secret" {
		t.Errorf("config.Projects[0].AdminSecret = %q, want %q", *config.Projects[0].AdminSecret, "project-secret")
	}
}
