package dockercompose

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/creack/pty"
)

type Docker struct{}

func NewDocker() *Docker {
	return &Docker{}
}

func (d *Docker) HasuraWrapper(
	ctx context.Context,
	subdomain,
	nhostfolder,
	hasuraVersion string,
	exrtaArgs ...string,
) error {
	absPath, err := filepath.Abs(nhostfolder)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	args := []string{
		"run",
		"-v", absPath + ":/app",
		"-e", "HASURA_GRAPHQL_ENABLE_TELEMETRY=false",
		"-w", "/app",
		"-it", "--rm",
		"--entrypoint", "hasura-cli",
	}

	for _, host := range extraHosts(subdomain) {
		args = append(args, "--add-host", host)
	}

	args = append(
		args,
		fmt.Sprintf("nhost/graphql-engine:%s.cli-migrations-v3", hasuraVersion),
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

	if n, err := io.Copy(os.Stdout, f); err != nil {
		var pathError *fs.PathError
		switch {
		case errors.As(err, &pathError) && n > 0 && pathError.Op == op:
			// linux pty returns an error when the process exits
			return nil
		default:
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	return nil
}
