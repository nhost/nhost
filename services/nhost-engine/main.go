// Command nhost-engine runs one or more Nhost Go services (auth, storage,
// constellation) in a single process. Services are selected on the command
// line and separated by "--"; each service is configured with its own flags
// and runs concurrently under a shared, signal-aware lifecycle.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/nhost/nhost/services/nhost-engine/internal/runner"
	_ "go.uber.org/automaxprocs" // set GOMAXPROCS from the Linux container CPU quota
)

// Version is set at build time via -ldflags "-X main.Version=...".
var Version string

func main() {
	// realMain owns the signal context so its deferred stop() runs before the
	// process exits; main only turns a returned error into a non-zero exit,
	// keeping log.Fatal out of the way of the deferred cleanup.
	if err := realMain(); err != nil {
		log.Fatal(err)
	}
}

func realMain() error {
	// A single signal-aware context drives every selected service: SIGINT or
	// SIGTERM cancels it, and Supervise propagates that into a graceful
	// shutdown of all of them together.
	ctx, stop := signal.NotifyContext(
		context.Background(), os.Interrupt, syscall.SIGTERM,
	)
	defer stop()

	return run(ctx, os.Args[1:])
}

func run(ctx context.Context, args []string) error {
	shared, invocations, err := runner.Split(args, isService)
	if err != nil {
		fmt.Fprint(os.Stderr, usageText(Version))

		return fmt.Errorf("parsing service arguments: %w", err)
	}

	// Parse the shared segment first: --help/--version are detected here from
	// arity-aware bool flags, so a shared flag *value* (e.g. "--admin-secret
	// help") can no longer short-circuit startup. An engine-level help/version
	// request wins over any service selection.
	cfg, req, err := parseSharedFlags(ctx, shared)
	if err != nil {
		fmt.Fprint(os.Stderr, usageText(Version))

		return err
	}

	switch req {
	case requestHelp:
		fmt.Fprint(os.Stdout, usageText(Version))

		return nil
	case requestVersion:
		fmt.Fprintln(os.Stdout, "nhost-engine v"+Version)

		return nil
	case requestRun:
		// Not a help/version request; proceed to service dispatch below.
	}

	if len(invocations) == 0 {
		return handleNoService(shared)
	}

	return runServices(ctx, cfg, invocations, Version)
}

// handleNoService renders top-level help when the engine was invoked with no
// arguments, or reports an error when arguments were given but named no service
// to run. Help and version requests are resolved earlier in run.
func handleNoService(shared []string) error {
	if len(shared) == 0 {
		fmt.Fprint(os.Stdout, usageText(Version))

		return nil
	}

	fmt.Fprint(os.Stderr, usageText(Version))

	return fmt.Errorf(
		"%w; expected one of %v", errNoServiceSelected, serviceNames(),
	)
}

// errNoServiceSelected is returned when the arguments contain no service to run
// (and are not a help/version request).
var errNoServiceSelected = errors.New("no service selected")
