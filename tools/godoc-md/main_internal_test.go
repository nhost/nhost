package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestRenderPackageDocumentsOnlyExportedAPIAndTypedValues(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	mustWriteTestFile(
		t,
		filepath.Join(dir, "fixture.go"),
		`// Package fixture exercises API rendering.
package fixture

const PackageConstant = "package"

var PackageVariable = "package"

type ServiceType string

const (
	ServiceAuth ServiceType = "auth"
	serviceHidden ServiceType = "hidden"
)

var ServiceDefault ServiceType = ServiceAuth

func Exported() {}
func hidden() {}

type Client struct {
	ExportedField string
	hiddenField string
}

func (Client) ExportedMethod() {}
func (Client) hiddenMethod() {}
`,
	)

	got, err := renderPackage(dir, "Fixture")
	if err != nil {
		t.Fatalf("renderPackage() error = %v", err)
	}

	tests := []struct {
		name    string
		value   string
		present bool
	}{
		{name: "package constant", value: "PackageConstant", present: true},
		{name: "package variable", value: "PackageVariable", present: true},
		{name: "typed constant", value: "ServiceAuth", present: true},
		{name: "typed variable", value: "ServiceDefault", present: true},
		{name: "exported function", value: "### `Exported`", present: true},
		{name: "exported method", value: "#### `ExportedMethod`", present: true},
		{name: "exported field", value: "ExportedField string", present: true},
		{name: "unexported constant", value: "serviceHidden", present: false},
		{name: "unexported function", value: "hidden()", present: false},
		{name: "unexported method", value: "hiddenMethod", present: false},
		{name: "unexported field", value: "hiddenField", present: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			present := strings.Contains(got, test.value)
			if present != test.present {
				t.Errorf(
					"rendered output contains %q = %t, want %t\n%s",
					test.value,
					present,
					test.present,
					got,
				)
			}
		})
	}
}

func TestDiscoverPagesIncludesEveryPackage(t *testing.T) {
	t.Parallel()

	pkgDir := t.TempDir()
	mustWriteTestFile(t, filepath.Join(pkgDir, "root.go"), "package root\n")
	mustWriteTestFile(t, filepath.Join(pkgDir, "auth", "auth.go"), "package auth\n")
	mustWriteTestFile(t, filepath.Join(pkgDir, "newpackage", "new.go"), "package newpackage\n")
	mustWriteTestFile(t, filepath.Join(pkgDir, "testonly", "only_test.go"), "package testonly\n")
	mustWriteTestFile(
		t,
		filepath.Join(pkgDir, "examples", "nested", "example.go"),
		"package main\n",
	)

	got, err := discoverPages(pkgDir)
	if err != nil {
		t.Fatalf("discoverPages() error = %v", err)
	}

	want := []page{
		{dir: "", file: "main", title: "Main"},
		{dir: "auth", file: "auth", title: "Auth"},
		{dir: "newpackage", file: "newpackage", title: "Newpackage"},
	}
	if !slices.Equal(got, want) {
		t.Errorf("discoverPages() = %#v, want %#v", got, want)
	}
}

func TestRemoveStalePages(t *testing.T) {
	t.Parallel()

	outDir := t.TempDir()
	mustWriteTestFile(t, filepath.Join(outDir, "main.md"), "current")
	mustWriteTestFile(t, filepath.Join(outDir, "removed.md"), "stale")
	mustWriteTestFile(t, filepath.Join(outDir, "README.txt"), "unmanaged")

	if err := removeStalePages(outDir, []page{{dir: "", file: "main", title: "Main"}}); err != nil {
		t.Fatalf("removeStalePages() error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(outDir, "removed.md")); !os.IsNotExist(err) {
		t.Errorf("os.Stat(removed.md) error = %v, want file not to exist", err)
	}

	if _, err := os.Stat(filepath.Join(outDir, "README.txt")); err != nil {
		t.Errorf("os.Stat(README.txt) error = %v", err)
	}
}

func mustWriteTestFile(t *testing.T, path, contents string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("os.MkdirAll(%q) error = %v", filepath.Dir(path), err)
	}

	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("os.WriteFile(%q) error = %v", path, err)
	}
}
