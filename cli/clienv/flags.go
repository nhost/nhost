package clienv

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-git/go-git/v5"
	"github.com/urfave/cli/v3"
)

const (
	flagAuthURL        = "auth-url"
	flagGraphqlURL     = "graphql-url"
	flagOAuth2ClientID = "oauth2-client-id"
	flagPAT            = "pat"
	flagBranch         = "branch"
	flagProjectName    = "project-name"
	flagRootFolder     = "root-folder"
	flagNhostFolder    = "nhost-folder"
	flagDotNhostFolder = "dot-nhost-folder"
	flagLocalSubdomain = "local-subdomain"
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

func Flags() ([]cli.Flag, error) { //nolint:funlen
	fullWorkingDir, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get working directory: %w", err)
	}

	branch := getGitBranchName()

	workingDir := "."
	dotNhostFolder := filepath.Join(workingDir, ".nhost")
	nhostFolder := filepath.Join(workingDir, "nhost")

	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagAuthURL,
			Usage:   "Nhost auth URL",
			Sources: cli.EnvVars("NHOST_CLI_AUTH_URL"),
			Value:   "https://otsispdzcwxyqzbfntmj.auth.eu-central-1.nhost.run/v1",
			Hidden:  true,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagGraphqlURL,
			Usage:   "Nhost GraphQL URL",
			Sources: cli.EnvVars("NHOST_CLI_GRAPHQL_URL"),
			Value:   "https://otsispdzcwxyqzbfntmj.graphql.eu-central-1.nhost.run/v1",
			Hidden:  true,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagOAuth2ClientID,
			Usage:   "OAuth2 client ID for PKCE login",
			Sources: cli.EnvVars("NHOST_OAUTH2_CLIENT_ID"),
			Value:   "NhostCLI",
			Hidden:  true,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagPAT,
			Usage:   "Personal Access Token for authentication",
			Sources: cli.EnvVars("NHOST_PAT"),
			Hidden:  true,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:        flagBranch,
			Usage:       "Branch name used to namespace this project's docker volumes (detected from git by default)",
			Sources:     cli.EnvVars("BRANCH"),
			Value:       branch,
			DefaultText: "<current-git-branch>",
			Hidden:      false,
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagRootFolder,
			Usage:    "Root folder of project",
			Sources:  cli.EnvVars("NHOST_ROOT_FOLDER"),
			Value:    workingDir,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagDotNhostFolder,
			Usage:    "Path to .nhost folder",
			Sources:  cli.EnvVars("NHOST_DOT_NHOST_FOLDER"),
			Value:    dotNhostFolder,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagNhostFolder,
			Usage:    "Path to nhost folder",
			Sources:  cli.EnvVars("NHOST_NHOST_FOLDER"),
			Value:    nhostFolder,
			Category: "Project structure",
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:        flagProjectName,
			Usage:       "Project name",
			Value:       filepath.Base(fullWorkingDir),
			DefaultText: "<nhost/project-name or directory name>",
			Sources:     cli.EnvVars("NHOST_PROJECT_NAME"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagLocalSubdomain,
			Usage:   "Local subdomain to reach the development environment",
			Value:   "local",
			Sources: cli.EnvVars("NHOST_LOCAL_SUBDOMAIN"),
		},
	}, nil
}
