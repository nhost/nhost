package dockercredentials

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"

	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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
				EnvVars: []string{"DOCKER_CONFIG"},
				Value:   fmt.Sprintf("%s/.docker/config.json", home),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagNoInteractive,
				Usage:   "Do not prompt for confirmation",
				EnvVars: []string{"NO_INTERACTIVE"},
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

	if _, err := tmpfile.Write([]byte(script)); err != nil {
		return fmt.Errorf("could not write to temporary file: %w", err)
	}

	if err := tmpfile.Chmod(0o755); err != nil { //nolint:gomnd
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
	f, err := os.OpenFile(dockerConfig, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0o644) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("could not open docker config file: %w", err)
	}
	defer f.Close()

	var config map[string]interface{}
	if err := json.NewDecoder(f).Decode(&config); err != nil {
		config = make(map[string]interface{})
	}

	credHelpers, ok := config["credHelpers"].(map[string]interface{})
	if !ok {
		credHelpers = make(map[string]interface{})
	}
	credHelpers["registry.ap-south-1.nhost.run"] = credentialsHelper
	credHelpers["registry.ap-southeast-1.nhost.run"] = credentialsHelper
	credHelpers["registry.eu-central-1.nhost.run"] = credentialsHelper
	credHelpers["registry.eu-west-2.nhost.run"] = credentialsHelper
	credHelpers["registry.us-east-1.nhost.run"] = credentialsHelper
	credHelpers["registry.sa-east-1.nhost.run"] = credentialsHelper

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

func actionConfigure(c *cli.Context) error {
	ce := clienv.FromCLI(c)

	if err := writeScript(c.Context, ce); err != nil {
		return err
	}

	if c.Bool(flagNoInteractive) {
		return configureDocker(c.String(flagDockerConfig))
	}

	//nolint:lll
	ce.PromptMessage(
		"I am about to configure docker to authenticate with Nhost's registry. This will modify your docker config file on %s. Should I continue? [y/N] ",
		c.String(flagDockerConfig),
	)
	v, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("could not read input: %w", err)
	}
	if v == "y" || v == "Y" {
		return configureDocker(c.String(flagDockerConfig))
	}

	return nil
}
