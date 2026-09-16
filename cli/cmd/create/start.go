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
	runBackend   = startBackend
	runFrontend  = startFrontend
	runPreflight = startBlockers
)

// startServers runs the two commands printStartCommands would have told the
// user to run, in the order the project needs them: the backend first, because
// the frontend renders against its GraphQL API, then the frontend dev server
// in the foreground, which is where the terminal stays until Ctrl-C.
//
// Nothing here fails the create. The project is on disk whatever the machine
// makes of it, so a backend that cannot start hands the commands back instead.
func startServers(
	ctx context.Context,
	ce *clienv.CliEnv,
	version string,
	resolved choices,
	target string,
) error {
	ce.Println("")
	ce.Infoln("Created %s", resolved.name)
	printProjectNotes(ce, resolved)

	ce.Println("")
	ce.Infoln("Checking this machine can run the backend...")

	if blockers := runPreflight(ctx, version); len(blockers) > 0 {
		reportBlockers(ce, resolved, blockers)

		return nil
	}

	ce.Infoln("Starting the backend with `nhost up`...")

	if err := runBackend(ctx, filepath.Join(target, "backend")); err != nil {
		ce.Println("")
		ce.Warnln("Could not start the backend (%v).", err)
		printManualStart(ce, resolved)

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

// reportBlockers explains why the servers were not started and hands back the
// commands to run once the machine is ready for them.
func reportBlockers(ce *clienv.CliEnv, resolved choices, blockers []blocker) {
	ce.Println("")
	ce.Warnln("Not starting the servers:")

	for _, b := range blockers {
		ce.Println("  - %s", b.problem)
		ce.Println("    %s", b.fix)
	}

	printManualStart(ce, resolved)
}

func printManualStart(ce *clienv.CliEnv, resolved choices) {
	ce.Println("")
	ce.Println("Start the servers yourself:")
	printStartCommands(ce, resolved)
}

// startBackend runs `nhost up` in the scaffolded backend, using the running
// binary rather than whatever `nhost` is on PATH: the project was scaffolded
// from this build's template, so this build is the one that matches it.
//
// --down-on-error keeps a failed start from asking its own question in the
// middle of a create; the environment is torn back down and the commands to
// retry are printed instead.
func startBackend(ctx context.Context, dir string) error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to locate the nhost executable: %w", err)
	}

	if err := runForeground(ctx, exe, []string{"up", "--down-on-error"}, dir); err != nil {
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
