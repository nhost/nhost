package gen

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestNewPluginInfersGoPackageFromOutputPath(t *testing.T) {
	t.Parallel()

	absoluteOutputFile := filepath.Join(t.TempDir(), "storage", "client.go")
	trailingSeparator := "auth" + string(filepath.Separator)

	tests := []struct {
		name        string
		outputFile  string
		wantErrText string
	}{
		{name: "auth directory", outputFile: filepath.Join("nhost-go", "auth", "client.go")},
		{name: "absolute path", outputFile: absoluteOutputFile},
		{
			name:        "no directory",
			outputFile:  "client.go",
			wantErrText: invalidInferredPackageError("client.go", "."),
		},
		{
			name:       "explicit current directory",
			outputFile: "." + string(filepath.Separator) + "client.go",
			wantErrText: invalidInferredPackageError(
				"."+string(filepath.Separator)+"client.go",
				".",
			),
		},
		{
			name:       "hyphenated directory",
			outputFile: filepath.Join("nhost-go", "client.go"),
			wantErrText: invalidInferredPackageError(
				filepath.Join("nhost-go", "client.go"),
				"nhost-go",
			),
		},
		{
			name:        "keyword directory",
			outputFile:  filepath.Join("type", "client.go"),
			wantErrText: invalidInferredPackageError(filepath.Join("type", "client.go"), "type"),
		},
		{
			name:        "blank identifier directory",
			outputFile:  filepath.Join("_", "client.go"),
			wantErrText: invalidInferredPackageError(filepath.Join("_", "client.go"), "_"),
		},
		{
			name:       "trailing separator",
			outputFile: trailingSeparator,
			wantErrText: fmt.Sprintf(
				"cannot infer Go package from output path %q: output path ends with a separator and does not name an output file; put the output file in a directory named after the package",
				trailingSeparator,
			),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := newPlugin("go", test.outputFile)
			if test.wantErrText == "" {
				if err != nil {
					t.Fatalf("newPlugin() error = %v, want nil", err)
				}

				return
			}

			if err == nil {
				t.Fatalf("newPlugin() error = nil, want %q", test.wantErrText)
			}

			if err.Error() != test.wantErrText {
				t.Fatalf("newPlugin() error = %q, want %q", err, test.wantErrText)
			}
		})
	}
}

func TestNewPluginOtherPluginsDoNotInferPackage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		plugin string
	}{
		{name: "typescript", plugin: "typescript"},
		{name: "rust", plugin: "rust"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := newPlugin(test.plugin, filepath.Join("nhost-go", "client.go"))
			if err != nil {
				t.Fatalf("newPlugin() error = %v, want nil", err)
			}
		})
	}
}

func TestCommandInfersGoPackageFromOutputDirectory(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		packageName string
	}{
		{name: "auth", packageName: "auth"},
		{name: "storage", packageName: "storage"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			outputDirectory := filepath.Join(t.TempDir(), test.packageName)
			if err := os.MkdirAll(outputDirectory, 0o755); err != nil {
				t.Fatalf("os.MkdirAll() error = %v", err)
			}

			outputFile := filepath.Join(outputDirectory, "client.go")
			command := Command()
			command.ExitErrHandler = func(context.Context, *cli.Command, error) {}

			err := command.Run(context.Background(), []string{
				"gen",
				"--openapi-file", "../../processor/testdata/types.yaml",
				"--output-file", outputFile,
				"--plugin", "go",
			})
			if err != nil {
				t.Fatalf("Command().Run() error = %v, want nil", err)
			}

			generated, err := os.ReadFile(outputFile)
			if err != nil {
				t.Fatalf("os.ReadFile() error = %v", err)
			}

			wantPackageDeclaration := "\npackage " + test.packageName + "\n"
			if !strings.Contains(string(generated), wantPackageDeclaration) {
				t.Fatalf("generated output does not contain %q", wantPackageDeclaration)
			}
		})
	}
}

// TestCommandRejectsPackageFlag pins the decision that the package name is inferred and never
// configurable. The flag was removed rather than kept as an override because a flag named
// "package" is one cli.EnvVars away from inheriting the PACKAGE variable that
// services/constellation/Makefile exports, which would silently rename the generated package.
func TestCommandRejectsPackageFlag(t *testing.T) {
	t.Parallel()

	outputDirectory := filepath.Join(t.TempDir(), "auth")
	if err := os.MkdirAll(outputDirectory, 0o755); err != nil {
		t.Fatalf("os.MkdirAll() error = %v", err)
	}

	command := Command()
	command.ExitErrHandler = func(context.Context, *cli.Command, error) {}

	err := command.Run(context.Background(), []string{
		"gen",
		"--openapi-file", "../../processor/testdata/types.yaml",
		"--output-file", filepath.Join(outputDirectory, "client.go"),
		"--plugin", "go",
		"--package", "somethingelse",
	})
	if err == nil {
		t.Fatal("Command().Run() error = nil, want an unknown-flag error")
	}

	if !strings.Contains(err.Error(), "flag provided but not defined") {
		t.Fatalf("Command().Run() error = %v, want an unknown-flag error", err)
	}
}

// TestCommandDoesNotTruncateOutputOnInferenceFailure pins the ordering of package inference
// against os.OpenFile's O_TRUNC: a rejected output path must not destroy an existing file.
func TestCommandDoesNotTruncateOutputOnInferenceFailure(t *testing.T) {
	t.Parallel()

	outputDirectory := filepath.Join(t.TempDir(), "nhost-go")
	if err := os.MkdirAll(outputDirectory, 0o755); err != nil {
		t.Fatalf("os.MkdirAll() error = %v", err)
	}

	outputFile := filepath.Join(outputDirectory, "client.go")

	const existing = "package nhostgo // pre-existing content\n"
	if err := os.WriteFile(outputFile, []byte(existing), 0o600); err != nil {
		t.Fatalf("os.WriteFile() error = %v", err)
	}

	command := Command()
	command.ExitErrHandler = func(context.Context, *cli.Command, error) {}

	err := command.Run(context.Background(), []string{
		"gen",
		"--openapi-file", "../../processor/testdata/types.yaml",
		"--output-file", outputFile,
		"--plugin", "go",
	})
	if err == nil {
		t.Fatal("Command().Run() error = nil, want an inference error")
	}

	preserved, readErr := os.ReadFile(outputFile)
	if readErr != nil {
		t.Fatalf("os.ReadFile() error = %v", readErr)
	}

	if string(preserved) != existing {
		t.Fatalf("output file was modified: got %q, want %q", preserved, existing)
	}
}

func TestCommandIgnoresPackageEnvironment(t *testing.T) {
	t.Setenv("PACKAGE", "ambient")

	tests := []struct {
		name      string
		plugin    string
		extension string
	}{
		{name: "typescript", plugin: "typescript", extension: "ts"},
		{name: "rust", plugin: "rust", extension: "rs"},
		{name: "go", plugin: "go", extension: "go"},
	}

	for _, test := range tests { //nolint:paralleltest // Subtests share the process-wide PACKAGE environment.
		t.Run(test.name, func(t *testing.T) {
			outputDirectory := filepath.Join(t.TempDir(), "client")
			if err := os.MkdirAll(outputDirectory, 0o755); err != nil {
				t.Fatalf("os.MkdirAll() error = %v", err)
			}

			outputFile := filepath.Join(outputDirectory, "client."+test.extension)
			command := Command()
			command.ExitErrHandler = func(context.Context, *cli.Command, error) {}

			err := command.Run(context.Background(), []string{
				"gen",
				"--openapi-file", "../../processor/testdata/types.yaml",
				"--output-file", outputFile,
				"--plugin", test.plugin,
			})
			if err != nil {
				t.Fatalf("Command().Run() error = %v, want nil", err)
			}

			if test.plugin != "go" {
				return
			}

			generated, err := os.ReadFile(outputFile)
			if err != nil {
				t.Fatalf("os.ReadFile() error = %v", err)
			}

			if !strings.Contains(string(generated), "\npackage client\n") {
				t.Fatal(
					"generated output does not use the package inferred from the output directory",
				)
			}

			if strings.Contains(string(generated), "\npackage ambient\n") {
				t.Fatal("generated output uses the ambient PACKAGE environment variable")
			}
		})
	}
}

func invalidInferredPackageError(outputFile, packageName string) string {
	return fmt.Sprintf(
		"cannot infer Go package from output path %q: directory component %q is not a valid Go package name; "+
			"put the output file in a directory named after the package: invalid Go package name %q",
		outputFile,
		packageName,
		packageName,
	)
}
