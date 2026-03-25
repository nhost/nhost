package dockercompose

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/creack/pty"
	"golang.org/x/term"
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

	if term.IsTerminal(int(os.Stdin.Fd())) {
		// Set the initial PTY size to match the user's terminal.
		_ = pty.InheritSize(os.Stdin, f)

		// Handle terminal resize events (SIGWINCH) by propagating the
		// new size to the PTY so interactive menus render correctly.
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGWINCH)
		defer signal.Stop(ch)

		go func() {
			for range ch {
				_ = pty.InheritSize(os.Stdin, f)
			}
		}()

		// Set stdin to raw mode so arrow keys and other escape sequences
		// are forwarded to the PTY without interpretation.
		oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
		if err != nil {
			return fmt.Errorf("failed to set terminal to raw mode: %w", err)
		}
		defer term.Restore(int(os.Stdin.Fd()), oldState) //nolint:errcheck
	}

	// Forward stdin to the PTY so the interactive Hasura CLI receives user input.
	go func() {
		_, _ = io.Copy(f, os.Stdin)
	}()

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
