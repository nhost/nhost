package gen

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestNewPluginRejectsInvalidGoPackageNames(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		packageName string
	}{
		{name: "empty"},
		{name: "blank identifier", packageName: "_"},
		{name: "invalid identifier", packageName: "my-pkg 3"},
		{name: "keyword", packageName: "package"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := newPlugin("go", test.packageName)
			if err == nil {
				t.Fatal("newPlugin() error = nil, want invalid --package error")
			}

			if !strings.Contains(err.Error(), "invalid --package") {
				t.Fatalf("newPlugin() error = %q, want invalid --package error", err)
			}
		})
	}
}

func TestNewPluginPackageForOtherPlugins(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		plugin      string
		packageName string
		wantErr     bool
	}{
		{name: "typescript without package", plugin: "typescript"},
		{
			name:        "typescript with package",
			plugin:      "typescript",
			packageName: "client",
			wantErr:     true,
		},
		{name: "rust without package", plugin: "rust"},
		{name: "rust with package", plugin: "rust", packageName: "client", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := newPlugin(test.plugin, test.packageName)
			if test.wantErr {
				if err == nil {
					t.Fatal("newPlugin() error = nil, want unsupported --package error")
				}

				if !strings.Contains(err.Error(), "--package is only supported by the go plugin") {
					t.Fatalf("newPlugin() error = %q, want unsupported --package error", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("newPlugin() error = %v, want nil", err)
			}
		})
	}
}

func TestCommandPackageEnvironment(t *testing.T) {
	t.Setenv("PACKAGE", "ambient")

	tests := []struct {
		name       string
		plugin     string
		extension  string
		wantErr    bool
		wantErrMsg string
	}{
		{name: "typescript ignores ambient package", plugin: "typescript", extension: "ts"},
		{name: "rust ignores ambient package", plugin: "rust", extension: "rs"},
		{
			name:       "go requires explicit package",
			plugin:     "go",
			extension:  "go",
			wantErr:    true,
			wantErrMsg: `invalid --package: invalid Go package name ""`,
		},
	}

	for _, test := range tests { //nolint:paralleltest // Subtests share the process-wide PACKAGE environment.
		t.Run(test.name, func(t *testing.T) {
			outputFile := filepath.Join(t.TempDir(), "client."+test.extension)
			command := Command()
			command.ExitErrHandler = func(context.Context, *cli.Command, error) {}

			err := command.Run(context.Background(), []string{
				"gen",
				"--openapi-file", "../../processor/testdata/types.yaml",
				"--output-file", outputFile,
				"--plugin", test.plugin,
			})
			if test.wantErr {
				if err == nil {
					t.Fatal("Command().Run() error = nil, want package error")
				}

				if !strings.Contains(err.Error(), test.wantErrMsg) {
					t.Fatalf("Command().Run() error = %q, want %q", err, test.wantErrMsg)
				}

				return
			}

			if err != nil {
				t.Fatalf("Command().Run() error = %v, want nil", err)
			}
		})
	}
}
