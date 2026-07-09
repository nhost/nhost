package config

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/tui"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

const (
	flagYes         = "yes"
	flagCloud       = "cloud"
	flagLocal       = "local"
	flagAdminSecret = "admin-secret"
	flagProjSub     = "project-subdomain"
	flagProjRegion  = "project-region"
	flagProjSecret  = "project-admin-secret"
	flagProjPAT     = "project-pat"
)

func Command() *cli.Command { //nolint:funlen
	return &cli.Command{ //nolint:exhaustruct
		Name:  "config",
		Usage: "Generate and save configuration file",
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Usage:   "Skip confirmation prompt",
				Sources: cli.EnvVars("NHOST_YES"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagCloud,
				Usage: "Enable Nhost Cloud access",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagLocal,
				Usage: "Enable local development access",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagAdminSecret,
				Usage: "Admin secret for local project (default: nhost-admin-secret)",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagProjSub,
				Usage: "Cloud project subdomain to configure",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagProjRegion,
				Usage: "Cloud project region",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagProjSecret,
				Usage: "Cloud project admin secret",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagProjPAT,
				Usage: "Cloud project personal access token",
			},
		},
		Commands: []*cli.Command{
			{
				Name:   "dump",
				Usage:  "Dump the configuration to stdout for verification",
				Flags:  []cli.Flag{},
				Action: actionDump,
			},
		},
		Action: action,
	}
}

func action(_ context.Context, cmd *cli.Command) error {
	hasFlags := cmd.Bool(flagCloud) ||
		cmd.Bool(flagLocal) ||
		cmd.String(flagProjSub) != ""

	var (
		cfg *config.Config
		err error
	)

	if hasFlags {
		cfg = buildConfigFromFlags(cmd)
	} else {
		cfg, err = config.RunWizard()
		if err != nil {
			return fmt.Errorf("configuration: %w", err)
		}
	}

	filePath := config.GetConfigPath(cmd)

	return saveConfig(cfg, filePath, cmd.Bool(flagYes) || hasFlags)
}

func buildConfigFromFlags(cmd *cli.Command) *config.Config {
	cfg := &config.Config{
		Cloud:    nil,
		Projects: nil,
	}

	if cmd.Bool(flagCloud) {
		cfg.Cloud = &config.Cloud{EnableMutations: true}
	}

	if cmd.Bool(flagLocal) {
		secret := cmd.String(flagAdminSecret)
		if secret == "" {
			secret = "nhost-admin-secret" //nolint:gosec
		}

		cfg.Projects = append(cfg.Projects, config.Project{
			Subdomain:      "local",
			Region:         "local",
			Description:    "Local development project",
			AdminSecret:    &secret,
			PAT:            nil,
			ManageMetadata: true,
			AllowQueries:   []string{"*"},
			AllowMutations: []string{"*"},
			AuthURL:        "",
			GraphqlURL:     "",
			HasuraURL:      "",
		})
	}

	if sub := cmd.String(flagProjSub); sub != "" {
		cfg.Projects = append(cfg.Projects, buildProjectFromFlags(cmd, sub))
	}

	return cfg
}

func buildProjectFromFlags(
	cmd *cli.Command,
	subdomain string,
) config.Project {
	p := config.Project{
		Subdomain:      subdomain,
		Region:         cmd.String(flagProjRegion),
		Description:    "",
		AdminSecret:    nil,
		PAT:            nil,
		ManageMetadata: true,
		AllowQueries:   []string{"*"},
		AllowMutations: []string{"*"},
		AuthURL:        "",
		GraphqlURL:     "",
		HasuraURL:      "",
	}

	if secret := cmd.String(flagProjSecret); secret != "" {
		p.AdminSecret = &secret
	} else if pat := cmd.String(flagProjPAT); pat != "" {
		p.PAT = &pat
	}

	return p
}

func saveConfig(
	cfg *config.Config,
	filePath string,
	skipConfirm bool,
) error {
	if !skipConfirm {
		if err := confirmSave(filePath); err != nil {
			return err
		}
	}

	return writeConfig(cfg, filePath)
}

func writeConfig(cfg *config.Config, filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0o600); err != nil { //nolint:mnd
		return fmt.Errorf("failed to write config file: %w", err)
	}

	if term.IsTerminal(int(os.Stdout.Fd())) {
		fmt.Println() //nolint:forbidigo
		tui.PrintCheck("Configuration saved to " + filePath)
	} else {
		fmt.Println("Configuration saved to " + filePath) //nolint:forbidigo
	}

	return nil
}

func confirmSave(filePath string) error {
	if !term.IsTerminal(int(os.Stdout.Fd())) {
		return errors.New("use --yes to skip confirmation") //nolint:err113
	}

	confirmed, err := tui.RunConfirm(
		fmt.Sprintf("Save configuration to %s?", filePath),
	)
	if err != nil || !confirmed {
		return errors.New("operation cancelled") //nolint:err113
	}

	return nil
}
