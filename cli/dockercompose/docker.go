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

type Docker struct {
	stdout io.Writer
	stderr io.Writer
	stdin  io.Reader
}

func NewDocker() *Docker {
	return &Docker{
		stdout: os.Stdout,
		stderr: os.Stderr,
		stdin:  os.Stdin,
	}
}

func NewDockerWithWriters(stdout, stderr io.Writer, stdin io.Reader) *Docker {
	return &Docker{
		stdout: stdout,
		stderr: stderr,
		stdin:  stdin,
	}
}

// setupInteractiveTerminal configures the terminal for interactive PTY usage:
// raw mode for escape sequences, initial size inheritance, and resize handling.
func setupInteractiveTerminal(stdin io.Reader, ptmx *os.File) func() {
	stdinFile, ok := stdin.(*os.File)
	if !ok {
		return func() {}
	}

	stdinFd := int(stdinFile.Fd())

	if !term.IsTerminal(stdinFd) {
		return func() {}
	}

	_ = pty.InheritSize(stdinFile, ptmx)

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGWINCH)

	go func() {
		for range ch {
			_ = pty.InheritSize(stdinFile, ptmx)
		}
	}()

	oldState, err := term.MakeRaw(stdinFd)
	if err != nil {
		signal.Stop(ch)

		return func() {}
	}

	return func() {
		term.Restore(stdinFd, oldState) //nolint:errcheck
		signal.Stop(ch)
	}
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

	cleanup := setupInteractiveTerminal(d.stdin, f)
	defer cleanup()

	go func() {
		_, _ = io.Copy(f, d.stdin)
	}()

	if n, err := io.Copy(d.stdout, f); err != nil {
		var pathError *fs.PathError
		switch {
		case errors.As(err, &pathError) && n > 0 && pathError.Op == op:
			return nil
		default:
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	return nil
}
