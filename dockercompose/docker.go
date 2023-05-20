package dockercompose

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

type Docker struct{}

func NewDocker() *Docker {
	return &Docker{}
}

func (d *Docker) HasuraWrapper(
	ctx context.Context,
	nhostfolder,
	hasuraVersion string,
	exrtaArgs ...string,
) error {
	args := []string{
		"run",
		"-v", fmt.Sprintf("%s:/app", nhostfolder),
		"-e", "HASURA_GRAPHQL_ENABLE_TELEMETRY=false",
		"-w", "/app",
		"-it", "--rm",
		"--entrypoint", "hasura-cli",
	}

	for _, host := range extraHosts() {
		args = append(args, "--add-host", host)
	}

	args = append(
		args,
		fmt.Sprintf("hasura/graphql-engine:%s.cli-migrations-v3", hasuraVersion),
	)

	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker",
		append(args, exrtaArgs...)...,
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(os.Stdout, f); err != nil {
		return fmt.Errorf("failed to copy output: %w", err)
	}

	return nil
}
