package serve

import (
	"context"
	"os"
	"os/signal"
	"syscall"
)

// SignalContext returns a context cancelled on SIGINT or SIGTERM, giving the
// process lifecycle the single cancellation source that Run and Supervise both
// consume. It names the termination signals once for every binary in this
// repository, so a new service cannot silently ship without graceful shutdown.
//
// Call it from main. Installing it there covers the whole process lifetime,
// including configuration parsing and service construction, rather than only
// the serving phase. The handler stays registered for the rest of the process,
// so repeated termination signals cannot interrupt an in-flight graceful
// shutdown; Supervise's bounded teardown tiers handle services that ignore
// cancellation instead.
//
// It deliberately does not return signal.NotifyContext's stop. Cancellation on
// a signal comes from NotifyContext's own watcher goroutine, never from stop,
// so shutdown does not depend on it. main exits as soon as this context's work
// is done, which makes stop's three effects — deregistering the handler,
// releasing that goroutine, and cancelling the context — unobservable. Handing
// it back would only force every caller into a main/realMain split, because a
// deferred stop never runs when main exits through log.Fatal's os.Exit.
//
// Library code must not call it: registering a handler changes process-global
// signal disposition, which is main's decision to make, and doing it from a
// reusable code path would install handlers inside test binaries.
func SignalContext(ctx context.Context) context.Context {
	sigCtx, _ := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)

	return sigCtx
}
