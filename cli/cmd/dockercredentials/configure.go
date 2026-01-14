package dockercredentials

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const (
	flagDockerConfig  = "docker-config"
	flagNoInteractive = "no-interactive"
)

const (
	credentialsPath   = "/usr/local/bin/docker-credential-nhost-login" //nolint:gosec
	credentialsHelper = "nhost-login"
)

func CommandConfigure() *cli.Command {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "/root"
	}

	return &cli.Command{ //nolint:exhaustruct
		Name:    "configure",
		Aliases: []string{},
		Usage:   "Install credentials helper and configure docker so it can authenticate with Nhost's registry",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagDockerConfig,
				Usage:   "Path to docker config file",
				Sources: cli.EnvVars("DOCKER_CONFIG"),
				Value:   home + "/.docker/config.json",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagNoInteractive,
				Usage:   "Do not prompt for confirmation",
				Sources: cli.EnvVars("NO_INTERACTIVE"),
				Value:   false,
			},
		},
		Action: actionConfigure,
	}
}

const script = `#!/bin/sh
%s docker-credentials $@
`

func canSudo(ctx context.Context) bool {
	if err := exec.CommandContext(ctx, "sudo", "-n", "true").Run(); err != nil {
		return false
	}

	return true
}

func writeScript(ctx context.Context, ce *clienv.CliEnv) error {
	ce.Println("Installing credentials helper for docker in %s", credentialsPath)

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not get executable path: %w", err)
	}

	script := fmt.Sprintf(script, executable)

	tmpfile, err := os.CreateTemp("", "nhost-docker-credentials")
	if err != nil {
		return fmt.Errorf("could not create temporary file: %w", err)
	}
	defer tmpfile.Close()

	if _, err := tmpfile.WriteString(script); err != nil {
		return fmt.Errorf("could not write to temporary file: %w", err)
	}

	if err := tmpfile.Chmod(0o755); err != nil { //nolint:mnd
		return fmt.Errorf("could not chmod temporary file: %w", err)
	}

	if !canSudo(ctx) {
		ce.Println("I need root privileges to install the file. Please, enter your password.")
	}

	if err := exec.CommandContext( //nolint:gosec
		ctx, "sudo", "mv", tmpfile.Name(), credentialsPath,
	).Run(); err != nil {
		return fmt.Errorf("could not move temporary file: %w", err)
	}

	return nil
}

func configureDocker(dockerConfig string) error {
	f, err := os.OpenFile(dockerConfig, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0o644) //nolint:mnd
	if err != nil {
		return fmt.Errorf("could not open docker config file: %w", err)
	}
	defer f.Close()

	var config map[string]any
	if err := json.NewDecoder(f).Decode(&config); err != nil {
		config = make(map[string]any)
	}

	credHelpers, ok := config["credHelpers"].(map[string]any)
	if !ok {
		credHelpers = make(map[string]any)
	}

	credHelpers["registry.ap-south-1.nhost.run"] = credentialsHelper
	credHelpers["registry.ap-southeast-1.nhost.run"] = credentialsHelper
	credHelpers["registry.eu-central-1.nhost.run"] = credentialsHelper
	credHelpers["registry.eu-west-2.nhost.run"] = credentialsHelper
	credHelpers["registry.us-east-1.nhost.run"] = credentialsHelper
	credHelpers["registry.sa-east-1.nhost.run"] = credentialsHelper
	credHelpers["registry.us-west-2.nhost.run"] = credentialsHelper

	config["credHelpers"] = credHelpers

	if err := f.Truncate(0); err != nil {
		return fmt.Errorf("could not truncate docker config file: %w", err)
	}

	if _, err := f.Seek(0, 0); err != nil {
		return fmt.Errorf("could not seek docker config file: %w", err)
	}

	if err := json.NewEncoder(f).Encode(config); err != nil {
		return fmt.Errorf("could not encode docker config file: %w", err)
	}

	return nil
}

func actionConfigure(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if err := writeScript(ctx, ce); err != nil {
		return err
	}

	if cmd.Bool(flagNoInteractive) {
		return configureDocker(cmd.String(flagDockerConfig))
	}

	//nolint:lll
	ce.PromptMessage(
		"I am about to configure docker to authenticate with Nhost's registry. This will modify your docker config file on %s. Should I continue? [y/N] ",
		cmd.String(flagDockerConfig),
	)

	v, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("could not read input: %w", err)
	}

	if v == "y" || v == "Y" {
		return configureDocker(cmd.String(flagDockerConfig))
	}

	return nil
}
