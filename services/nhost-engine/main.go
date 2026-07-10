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

	if len(invocations) == 0 {
		return handleNoService(shared)
	}

	// Engine-level help/version can be requested alongside a service selection;
	// honor it before trying to parse the shared flags or start anything.
	if hasAny(shared, "-h", "--help", "help", "-v", "--version") {
		return handleNoService(shared)
	}

	cfg, err := parseSharedFlags(ctx, shared)
	if err != nil {
		fmt.Fprint(os.Stderr, usageText(Version))

		return err
	}

	return runServices(ctx, cfg, invocations, Version)
}

// handleNoService renders help or version output when no service was selected,
// or reports an error when the user passed something other than help/version.
func handleNoService(shared []string) error {
	switch {
	case hasAny(shared, "-v", "--version"):
		fmt.Fprintln(os.Stdout, "nhost-engine v"+Version)

		return nil
	case hasAny(shared, "-h", "--help", "help"), len(shared) == 0:
		fmt.Fprint(os.Stdout, usageText(Version))

		return nil
	default:
		fmt.Fprint(os.Stderr, usageText(Version))

		return fmt.Errorf(
			"%w; expected one of %v", errNoServiceSelected, serviceNames(),
		)
	}
}

// errNoServiceSelected is returned when the arguments contain no service to run
// (and are not a help/version request).
var errNoServiceSelected = errors.New("no service selected")
