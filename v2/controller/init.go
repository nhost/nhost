package controller

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/hashicorp/go-getter"
	"github.com/nhost/cli/v2/project"
	"github.com/nhost/cli/v2/project/env"
	"github.com/nhost/cli/v2/system"
	"github.com/pelletier/go-toml/v2"
	"gopkg.in/yaml.v2"
)

const hasuraVersion = 3

func initFolders() error {
	folders := []string{
		system.PathDotNhost(),
		filepath.Join(system.PathNhost(), "migrations"),
		filepath.Join(system.PathNhost(), "metadata"),
		filepath.Join(system.PathNhost(), "seeds"),
		filepath.Join(system.PathNhost(), "emails"),
	}
	for _, f := range folders {
		if err := os.MkdirAll(f, 0o755); err != nil { //nolint:gomnd
			return fmt.Errorf("failed to create folder %s: %w", f, err)
		}
	}

	return nil
}

func initInit(
	ctx context.Context,
) error {
	hasuraConf := map[string]any{"version": hasuraVersion}
	if err := MarshalFile(hasuraConf, system.PathHasura(), yaml.Marshal); err != nil {
		return fmt.Errorf("failed to save hasura config: %w", err)
	}

	if err := initFolders(); err != nil {
		return err
	}

	gitingoref, err := os.OpenFile(".gitignore", os.O_RDWR|os.O_CREATE, 0o600) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("failed to open .gitignore file: %w", err)
	}
	defer gitingoref.Close()

	if err := system.AddToGitignore(system.PathSecrets()); err != nil {
		return fmt.Errorf("failed to add secrets to .gitignore: %w", err)
	}

	getclient := &getter.Client{ //nolint:exhaustruct
		Ctx:  ctx,
		Src:  "github.com/nhost/hasura-auth/email-templates",
		Dst:  "nhost/emails",
		Mode: getter.ClientModeAny,
		Detectors: []getter.Detector{
			&getter.GitHubDetector{},
		},
	}

	if err := getclient.Get(); err != nil {
		return fmt.Errorf("failed to download email templates: %w", err)
	}

	return nil
}

func Init(ctx context.Context) error {
	config, err := project.DefaultConfig()
	if err != nil {
		return fmt.Errorf("failed to create default config: %w", err)
	}
	if err := MarshalFile(config, system.PathConfig(), toml.Marshal); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	secrets := project.DefaultSecrets()
	if err := MarshalFile(secrets, system.PathSecrets(), env.Marshal); err != nil {
		return fmt.Errorf("failed to save secrets: %w", err)
	}

	return initInit(ctx)
}
