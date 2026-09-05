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
	"strings"
	"syscall"

	"github.com/creack/pty"
	"github.com/nhost/nhost/cli/clienv"
	"golang.org/x/term"
)

type Docker struct{}

func NewDocker() *Docker {
	return &Docker{}
}

// tailBufferMax caps how many trailing bytes of hasura-cli output we retain
// for post-run inspection. It keeps long interactive sessions (e.g. the
// Hasura console) from growing memory without bound while still capturing
// the terminal error messages we want to translate for the user.
const tailBufferMax = 64 * 1024

// tailBuffer is an io.Writer that keeps only the last tailBufferMax bytes
// written to it.
type tailBuffer struct {
	buf []byte
}

func (b *tailBuffer) Write(p []byte) (int, error) {
	b.buf = append(b.buf, p...)
	if len(b.buf) > tailBufferMax {
		b.buf = b.buf[len(b.buf)-tailBufferMax:]
	}

	return len(p), nil
}

func (b *tailBuffer) String() string {
	return string(b.buf)
}

// pgDumpVersionMismatch inspects hasura-cli output for the error Hasura
// returns when its bundled pg_dump is older than the remote PostgreSQL
// server (e.g. dumping a PG 18 database with pg_dump 17 during
// `nhost init --remote`). The raw error is opaque, so translate it into
// actionable guidance while leaving the original output visible above.
func pgDumpVersionMismatch(output string) error {
	if !strings.Contains(output, "pg_dump") ||
		!strings.Contains(output, "server version mismatch") {
		return nil
	}

	return errors.New( //nolint:err113
		"hasura could not dump the remote database: its bundled pg_dump is " +
			"older than the server's PostgreSQL version (see the error above); " +
			"upgrade your project's Hasura version (config.hasura.version, e.g. " +
			"v2.48.10-ce or newer) so pg_dump matches the database, then retry",
	)
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

func (d *Docker) HasuraWrapper( //nolint:funlen
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
		args = append(
			args,
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

	tail := new(tailBuffer)

	n, err := io.Copy(io.MultiWriter(os.Stdout, tail), f)
	if err != nil {
		var pathError *fs.PathError
		// A PTY signals the child's exit by returning an EIO read error on
		// the master side; that is expected, not a real copy failure.
		if !errors.As(err, &pathError) || n == 0 || pathError.Op != op {
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	if err := pgDumpVersionMismatch(tail.String()); err != nil {
		return err
	}

	return nil
}

// SanitizeMigrations strips psql meta-commands from SQL migrations so they
// can be applied through Hasura.
//
// pg_dump 17.6+/18 emits `\restrict <token>` and `\unrestrict <token>` lines
// to harden restores done through psql. Hasura applies migrations by sending
// the raw SQL to Postgres over its query API rather than piping it through
// psql, so those backslash meta-commands are seen as SQL and fail with
// `syntax error at or near "\"`. Dropping them keeps the dump valid for Hasura
// while leaving the actual DDL untouched.
//
// It runs only on the `init --remote` generation path, so the initial
// migration reaches disk already clean. Migrations applied by `nhost up` are
// left untouched and applied as-is.
func SanitizeMigrations(migrationsDir string) error {
	if !clienv.PathExists(migrationsDir) {
		return nil
	}

	return filepath.WalkDir( //nolint:wrapcheck
		migrationsDir,
		func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return fmt.Errorf("failed to walk %s: %w", path, err)
			}

			if d.IsDir() || filepath.Ext(path) != ".sql" {
				return nil
			}

			return sanitizeSQLFile(path)
		},
	)
}

func sanitizeSQLFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read migration %s: %w", path, err)
	}

	lines := strings.Split(string(data), "\n")
	kept := lines[:0]
	changed := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `\restrict`) ||
			strings.HasPrefix(trimmed, `\unrestrict`) {
			changed = true
			continue
		}

		kept = append(kept, line)
	}

	if !changed {
		return nil
	}

	if err := os.WriteFile(
		path, []byte(strings.Join(kept, "\n")), 0o600, //nolint:mnd
	); err != nil {
		return fmt.Errorf("failed to write migration %s: %w", path, err)
	}

	return nil
}
