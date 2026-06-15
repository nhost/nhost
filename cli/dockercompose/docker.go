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
	"runtime"
	"syscall"

	"github.com/creack/pty"
	"golang.org/x/term"
)

type Docker struct{}

func NewDocker() *Docker {
	return &Docker{}
}

// setupInteractiveTerminal configures the terminal for interactive PTY usage:
// raw mode for escape sequences, initial size inheritance, and resize handling.
func setupInteractiveTerminal(ptmx *os.File) func() {
	stdinFd := int(os.Stdin.Fd())

	if !term.IsTerminal(stdinFd) {
		return func() {}
	}

	_ = pty.InheritSize(os.Stdin, ptmx)

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGWINCH)

	go func() {
		for range ch {
			_ = pty.InheritSize(os.Stdin, ptmx)
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

	// On Linux, run hasura-cli as the host user so files written into
	// the bind-mounted nhost folder (metadata export, migration squash,
	// etc.) end up owned by the caller rather than root. HOME=/tmp
	// gives hasura-cli a writable path for its global config since the
	// image's default HOME=/ is only writable by root.
	if runtime.GOOS == osLinux {
		args = append(args,
			"--user", fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
			"-e", "HOME=/tmp",
		)
	}

	for _, host := range hostGatewayHosts(subdomain) {
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

	cleanup := setupInteractiveTerminal(f)
	defer cleanup()

	go func() {
		_, _ = io.Copy(f, os.Stdin)
	}()

	if n, err := io.Copy(os.Stdout, f); err != nil {
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
