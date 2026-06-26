package create //nolint:testpackage

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestStageProjectLocalTemplate(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)
	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "src", "app.ts"),
		"export const ok = true\n",
	)
	writeTestFile(t, filepath.Join(templateDir, "AGENTS.md"), "template guidance\n")

	t.Chdir(workdir)

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	var output bytes.Buffer

	cmd := &cli.Command{
		Name:      "nhost",
		Commands:  []*cli.Command{Command()},
		Flags:     flags,
		Writer:    &output,
		ErrWriter: &output,
	}

	if err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", templateDir, "--no-install", "my-app"},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "my-app")

	nhostToml := readTestFile(t, filepath.Join(projectDir, "backend", "nhost", "nhost.toml"))
	for _, want := range []string{
		"enabled = true",
		"clientUrl = 'http://localhost:3000'",
	} {
		if !strings.Contains(nhostToml, want) {
			t.Fatalf("nhost.toml missing %q:\n%s", want, nhostToml)
		}
	}

	if _, err := os.Stat(filepath.Join(projectDir, "backend", ".secrets")); err != nil {
		t.Fatalf("expected backend/.secrets to exist: %v", err)
	}

	if got := readTestFile(
		t,
		filepath.Join(projectDir, "frontend", "src", "app.ts"),
	); got != "export const ok = true\n" {
		t.Fatalf("frontend overlay = %q", got)
	}

	packageJSON := readTestFile(t, filepath.Join(projectDir, "frontend", "package.json"))
	if !strings.Contains(packageJSON, `"name": "my-app"`) {
		t.Fatalf("package.json name was not patched:\n%s", packageJSON)
	}
}

func TestValidateName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "myapp", wantErr: false},
		{name: "my-app", wantErr: false},
		{name: "my_app", wantErr: false},
		{name: "App123", wantErr: false},
		{name: "a.b", wantErr: false},
		{name: "", wantErr: true},
		{name: ".", wantErr: true},
		{name: "..", wantErr: true},
		{name: "my app", wantErr: true},
		{name: "my/app", wantErr: true},
		{name: "../escape", wantErr: true},
		{name: "foo*bar", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validateName(tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateName(%q) error = %v, wantErr %v", tt.name, err, tt.wantErr)
			}
		})
	}
}

func TestValidatePackageManager(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "pnpm", wantErr: false},
		{name: "npm", wantErr: false},
		{name: "bun", wantErr: false},
		{name: "yarn", wantErr: true},
		{name: "", wantErr: true},
		{name: "PNPM", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validatePackageManager(tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf(
					"validatePackageManager(%q) error = %v, wantErr %v",
					tt.name,
					err,
					tt.wantErr,
				)
			}
		})
	}
}

func TestSafeJoin(t *testing.T) {
	t.Parallel()

	base := t.TempDir()
	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "a/b.txt", wantErr: false},
		{name: "./c.txt", wantErr: false},
		{name: "frontend/package.json", wantErr: false},
		{name: "../evil", wantErr: true},
		{name: "../../evil", wantErr: true},
		{name: "/etc/passwd", wantErr: true},
		{name: "a/../../evil", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := safeJoin(base, tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf("safeJoin(%q) error = %v, wantErr %v", tt.name, err, tt.wantErr)
			}
		})
	}
}

func TestPatchPackageJSONName(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "package.json")
	original := "{\n  \"name\": \"nextjs-shadcn\",\n  \"version\": \"0.1.0\"\n}\n"

	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := patchPackageJSONName(path, "my-app"); err != nil {
		t.Fatalf("patchPackageJSONName: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	want := "{\n  \"name\": \"my-app\",\n  \"version\": \"0.1.0\"\n}\n"
	if string(got) != want {
		t.Errorf("patched package.json = %q, want %q", got, want)
	}
}

func writeTestFile(t *testing.T, path string, data string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
}

func readTestFile(t *testing.T, path string) string {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%s): %v", path, err)
	}

	return string(data)
}
