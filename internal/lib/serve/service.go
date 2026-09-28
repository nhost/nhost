package serve

import (
	"context"
	"log/slog"
	"net/http"
)

// Service is a constructed, ready-to-serve service: its HTTP surface, its
// optional long-lived background work, and the release of the resources it
// acquired while being built.
//
// A service owns what it builds and nothing else. The Manager owns the process
// lifecycle: the listeners, the order in which the parts are stopped, and when
// Close is called. Keeping the split here lets the same service run standalone
// in its own binary or composed with others behind one shared listener.
type Service struct {
	// Handler serves the service's HTTP routes. It is nil for a service with no
	// HTTP surface.
	Handler http.Handler

	// Background runs the service's long-lived work (controller loops, worker
	// pools). The Manager cancels it only after every listener has drained, so
	// the service's own resources remain available for its whole lifetime. It
	// must return once ctx is cancelled. It is nil for a service with no
	// background work.
	Background func(ctx context.Context) error

	// Close releases the resources acquired while building the service (database
	// pools, JWT key sets, image transformers). The Manager calls it exactly
	// once, after Background has returned, with whatever remains of the shutdown
	// budget.
	//
	// The single case where it can still overlap Background is a service that
	// ignored cancellation until the budget ran out: the Manager stops waiting and
	// proceeds, leaving the abandoned goroutine running, so each released
	// resource must tolerate concurrent use. It is nil when there is nothing to
	// release.
	Close func(ctx context.Context) error
}

// Definition is one service's entry in a Manager: the name it runs under and
// how to build it.
//
// The name is the caller's to choose, so one service can run under different
// names in different binaries. It tags the logger handed to Build, names the
// service in the errors Run returns, and keys its handler in the map a
// listener's WithHandler function receives.
type Definition struct {
	Name  string
	Build BuildFunc
}

// BuildFunc constructs a service. It receives the process context, so a slow
// dial or migration can be interrupted by a termination signal, and a logger
// already tagged with the service's Definition.Name. Returning an error
// releases every service built before it; returning a nil Service without an
// error is a programming error the Manager reports rather than dereferences.
type BuildFunc func(ctx context.Context, logger *slog.Logger) (*Service, error)

// CloseFunc adapts a release function that neither fails nor observes a
// deadline, such as a connection pool's Close, to the Service.Close hook.
func CloseFunc(release func()) func(context.Context) error {
	return func(context.Context) error {
		release()

		return nil
	}
}
