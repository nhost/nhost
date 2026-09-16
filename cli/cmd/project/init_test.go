package project_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	cmdproject "github.com/nhost/nhost/cli/cmd/project"
	"gopkg.in/yaml.v3"
)

func TestInitProject(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	if err := cmdproject.InitProject(ps); err != nil {
		t.Fatalf("InitProject: %v", err)
	}

	for _, path := range []string{
		filepath.Join(ps.NhostFolder(), "metadata"),
		filepath.Join(ps.NhostFolder(), "migrations", "default"),
		filepath.Join(root, ".gitignore"),
		filepath.Join(root, "functions", "package.json"),
		filepath.Join(ps.NhostFolder(), "emails", "en", "signin-otp", "body.html"),
	} {
		if _, err := os.Stat(path); err != nil {
			t.Errorf("expected %s to exist: %v", path, err)
		}
	}

	var hasuraConf struct {
		Version int `yaml:"version"`
	}

	if err := clienv.UnmarshalFile(ps.HasuraConfig(), &hasuraConf, yaml.Unmarshal); err != nil {
		t.Fatalf("failed to read hasura config: %v", err)
	}

	if hasuraConf.Version != 3 {
		t.Errorf("hasura config version: got %d, want 3", hasuraConf.Version)
	}
}
