package project

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"gopkg.in/yaml.v3"
)

// initProject starts from a directory with no nhost folder in it, which is
// why it creates the folders before writing into them.
func TestInitProject(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	if err := initProject(ps); err != nil {
		t.Fatalf("initProject: %v", err)
	}

	nhostFolder := ps.NhostFolder()

	for _, path := range []string{
		filepath.Join(nhostFolder, "metadata"),
		filepath.Join(nhostFolder, "migrations", "default"),
		filepath.Join(root, ".gitignore"),
		filepath.Join(root, "functions", "package.json"),
		filepath.Join(nhostFolder, "emails", "en", "signin-otp", "body.html"),
	} {
		if _, err := os.Stat(path); err != nil {
			t.Errorf("expected %s to exist: %v", path, err)
		}
	}

	var hasuraConf struct {
		Version int `yaml:"version"`
	}

	if err := clienv.UnmarshalFile(
		ps.HasuraConfig(), &hasuraConf, yaml.Unmarshal,
	); err != nil {
		t.Fatalf("failed to read hasura config: %v", err)
	}

	if hasuraConf.Version != 3 {
		t.Errorf("hasura config version: got %d, want 3", hasuraConf.Version)
	}
}

// init writes the selected methods' settings only into a config it generated,
// which is also what decides whether the next steps check the config instead.
func TestWritesAuthConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		hasBackend bool
		remote     bool
		want       bool
	}{
		{name: "fresh", hasBackend: false, remote: false, want: true},
		{name: "--remote", hasBackend: false, remote: true, want: false},
		{name: "existing", hasBackend: true, remote: false, want: false},
		{name: "both", hasBackend: true, remote: true, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := writesAuthConfig(tt.hasBackend, tt.remote)
			if got != tt.want {
				t.Errorf(
					"writesAuthConfig(%v, %v) = %v, want %v",
					tt.hasBackend, tt.remote, got, tt.want,
				)
			}
		})
	}
}
