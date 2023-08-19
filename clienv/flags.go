package clienv

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-git/go-git/v5"
	"github.com/urfave/cli/v2"
)

const (
	flagDomain         = "domain"
	flagProjectName    = "project-name"
	flagRootFolder     = "root-folder"
	flagDataFolder     = "data-folder"
	flagNhostFolder    = "nhost-folder"
	flagDotNhostFolder = "dot-nhost-folder"
)

func getGitBranchName() string {
	repo, err := git.PlainOpenWithOptions(".", &git.PlainOpenOptions{
		DetectDotGit:          true,
		EnableDotGitCommonDir: false,
	})
	if err != nil {
		return "nogit"
	}

	head, err := repo.Head()
	if err != nil {
		return "nogit"
	}

	return head.Name().Short()
}

func Flags() ([]cli.Flag, error) {
	fullWorkingDir, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get working directory: %w", err)
	}

	workingDir := "."
	dotNhostFolder := filepath.Join(workingDir, ".nhost")
	dataFolder := filepath.Join(dotNhostFolder, "data", getGitBranchName())
	nhostFolder := filepath.Join(workingDir, "nhost")

	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagDomain,
			Usage:   "Nhost domain",
			EnvVars: []string{"NHOST_DOMAIN"},
			Value:   "nhost.run",
			Hidden:  true,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagRootFolder,
			Usage:    "Root folder of project\n\t",
			EnvVars:  []string{"NHOST_ROOT_FOLDER"},
			Value:    workingDir,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagDotNhostFolder,
			Usage:    "Path to .nhost folder\n\t",
			EnvVars:  []string{"NHOST_DOT_NHOST_FOLDER"},
			Value:    dotNhostFolder,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagDataFolder,
			Usage:    "Data folder to persist data\n\t",
			EnvVars:  []string{"NHOST_DATA_FOLDER"},
			Value:    dataFolder,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagNhostFolder,
			Usage:    "Path to nhost folder\n\t",
			EnvVars:  []string{"NHOST_NHOST_FOLDER"},
			Value:    nhostFolder,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagProjectName,
			Usage:   "Project name",
			Value:   filepath.Base(fullWorkingDir),
			EnvVars: []string{"NHOST_PROJECT_NAME"},
		},
	}, nil
}
