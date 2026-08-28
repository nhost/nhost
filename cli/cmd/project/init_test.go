package project_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	cmdproject "github.com/nhost/nhost/cli/cmd/project"
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

	if err := os.MkdirAll(ps.NhostFolder(), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	if err := cmdproject.InitProject(ps); err != nil {
		t.Fatalf("InitProject: %v", err)
	}

	for _, path := range []string{
		ps.HasuraConfig(),
		filepath.Join(ps.NhostFolder(), "metadata"),
		filepath.Join(ps.NhostFolder(), "emails"),
		filepath.Join(root, "functions"),
	} {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected %s to exist: %v", path, err)
		}
	}
}
