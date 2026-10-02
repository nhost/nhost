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
