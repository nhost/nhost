package create

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/nhost/nhost/cli/clienv"
)

//nolint:gochecknoglobals // Test seams for the processes `--start` runs.
var (
	runBackend  = startBackend
	runFrontend = startFrontend
)

// startServers runs the two commands printNextSteps would have told the user to
// run, in the order the project needs them: the backend first, because the
// frontend renders against its GraphQL API, then the frontend dev server in the
// foreground, which is where the terminal stays until Ctrl-C.
func startServers(
	ctx context.Context,
	ce *clienv.CliEnv,
	resolved choices,
	target string,
) error {
	ce.Println("")
	ce.Infoln("Created %s", resolved.name)
	printProjectNotes(ce, resolved)

	ce.Println("")
	ce.Infoln("Starting the backend with `nhost up`...")

	if err := runBackend(ctx, filepath.Join(target, "backend")); err != nil {
		ce.Warnln("Could not start the backend (%v).", err)
		ce.Println("Start it yourself with `cd %s/backend && nhost up`.", resolved.name)

		return nil
	}

	devCommand := packageManagerScript(resolved.packageManager, "dev")

	ce.Println("")
	ce.Infoln("Starting the frontend with `%s`...", devCommand)
	ce.Println(
		"Ctrl-C stops the frontend. The backend keeps running until `cd %s/backend && nhost down`.",
		resolved.name,
	)

	return runFrontend(ctx, resolved.packageManager, filepath.Join(target, "frontend"))
}

// startBackend runs `nhost up` in the scaffolded backend, using the running
// binary rather than whatever `nhost` is on PATH: the project was scaffolded
// from this build's template, so this build is the one that matches it.
func startBackend(ctx context.Context, dir string) error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to locate the nhost executable: %w", err)
	}

	if err := runForeground(ctx, exe, []string{"up"}, dir); err != nil {
		return fmt.Errorf("`nhost up` failed: %w", err)
	}

	return nil
}

func startFrontend(ctx context.Context, pm, dir string) error {
	err := runForeground(ctx, pm, packageManagerArgs(pm, "dev"), dir)

	// Ctrl-C reaches every process in the terminal's foreground group, so a dev
	// server that died from a signal is the user stopping it, not a failure.
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) && exitErr.ExitCode() == -1 {
		return nil
	}

	if err != nil {
		return fmt.Errorf("`%s` failed: %w", packageManagerScript(pm, "dev"), err)
	}

	return nil
}

// runForeground hands the terminal to a child process. The error is returned
// bare because every caller names the command it ran.
func runForeground(ctx context.Context, name string, args []string, dir string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	return cmd.Run() //nolint:wrapcheck
}
