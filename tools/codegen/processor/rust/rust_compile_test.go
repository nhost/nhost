package rust_test

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/rust"
)

func TestRustGeneratedOutputCompiles(t *testing.T) {
	t.Parallel()

	cargo, err := exec.LookPath("cargo")
	if err != nil {
		t.Skip("cargo is not available; skipping generated Rust compile check")
	}

	const fixtureDir = "testdata/compile-fixture"

	if _, err := os.Stat(fixtureDir); err != nil {
		if os.IsNotExist(err) {
			t.Fatalf(
				"Rust compile fixture %q is missing; ensure tools/codegen/project.nix includes "+
					"./processor/rust/testdata in the Nix source fileset",
				fixtureDir,
			)
		}

		t.Fatalf("failed to inspect Rust compile fixture %q: %v", fixtureDir, err)
	}

	crateDir := filepath.Join(t.TempDir(), "compile-fixture")
	if err := os.CopyFS(crateDir, os.DirFS(fixtureDir)); err != nil {
		t.Fatalf("failed to copy Rust compile fixture from %q: %v", fixtureDir, err)
	}

	fixtures, err := filepath.Glob("../testdata/*.yaml")
	if err != nil {
		t.Fatalf("failed to find OpenAPI fixtures: %v", err)
	}

	if len(fixtures) == 0 {
		t.Fatal("no OpenAPI fixtures found")
	}

	modules := make([]string, 0, len(fixtures))
	for _, fixture := range fixtures {
		module := rustModuleName(filepath.Base(fixture))
		modules = append(modules, "pub mod "+module+";")

		output, renderErr := renderRustFixture(fixture)
		if renderErr != nil {
			t.Fatalf("failed to render %s: %v", filepath.Base(fixture), renderErr)
		}

		generatedPath := filepath.Join(crateDir, "src", "generated", module+".rs")
		if err := os.WriteFile(generatedPath, output, 0o600); err != nil {
			t.Fatalf(
				"failed to write generated Rust module for %s: %v",
				filepath.Base(fixture),
				err,
			)
		}
	}

	modules = append(modules, "")

	generatedModules := filepath.Join(crateDir, "src", "generated", "mod.rs")
	if err := os.WriteFile(
		generatedModules,
		[]byte(strings.Join(modules, "\n")),
		0o600,
	); err != nil {
		t.Fatalf("failed to write generated Rust module index: %v", err)
	}

	runCargo(t, cargo, crateDir, "check", "--locked")

	if _, err := exec.LookPath("cargo-clippy"); err != nil {
		t.Log("cargo-clippy is not available; generated Rust compiled but lint check was skipped")
		return
	}

	runCargo(
		t,
		cargo,
		crateDir,
		"clippy",
		"--locked",
		"--all-targets",
		"--",
		"-D",
		"warnings",
		"-W",
		"clippy::nursery",
	)
}

func renderRustFixture(path string) ([]byte, error) {
	doc, err := getModel(path)
	if err != nil {
		return nil, fmt.Errorf("building OpenAPI model: %w", err)
	}

	ir, err := processor.NewInterMediateRepresentation(doc, &rust.Rust{})
	if err != nil {
		return nil, fmt.Errorf("creating intermediate representation: %w", err)
	}

	var output bytes.Buffer
	if err := ir.Render(&output); err != nil {
		return nil, fmt.Errorf("rendering intermediate representation: %w", err)
	}

	return output.Bytes(), nil
}

func rustModuleName(filename string) string {
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	return strings.NewReplacer("-", "_", ".", "_").Replace(name)
}

func runCargo(t *testing.T, cargo, crateDir string, args ...string) {
	t.Helper()

	cmd := exec.CommandContext(t.Context(), cargo, args...)
	cmd.Dir = crateDir

	cmd.Env = append(os.Environ(), "CARGO_TERM_COLOR=never")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("cargo %s failed: %v\n%s", strings.Join(args, " "), err, output)
	}

	t.Logf("cargo %s succeeded:\n%s", strings.Join(args, " "), output)
}
