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
// A service owns what it builds and nothing else. Run owns the process
// lifecycle: the listener, the order in which the parts are cancelled, and when
// Close is called. Keeping the split here lets the same service run standalone
// in its own binary or composed with others behind one shared listener.
type Service struct {
	// Handler serves the service's HTTP routes. When composed with other
	// services it is mounted beneath the service's path prefix, so it keeps
	// serving the paths it expects. It is nil for a service with no HTTP
	// surface.
	Handler http.Handler

	// Background runs the service's long-lived work (controller loops, worker
	// pools). Run cancels it only after the listener has drained, so the
	// service's own resources remain available for its whole lifetime. It must
	// return once ctx is cancelled. It is nil for a service with no background
	// work.
	Background func(ctx context.Context) error

	// Close releases the resources acquired while building the service (database
	// pools, JWT key sets, image transformers). Run calls it once, after
	// Background has returned, with a context bounded by Options.ShutdownTimeout.
	//
	// The single case where Close can still overlap Background is a service that
	// ignored cancellation for longer than the shutdown budget allows: Run stops
	// waiting and proceeds, leaving the abandoned goroutine running. Close must
	// therefore stay idempotent and safe to call concurrently with Background.
	// Cleanups provides both properties. It is nil when there is nothing to
	// release.
	Close func(ctx context.Context) error
}

// Definition is one service's entry in a Run call: what it is called, where it
// is mounted, and how to build it.
//
// Build is the service's constructor. It receives the process context, so a
// slow dial or migration can be interrupted by a termination signal, and a
// logger already tagged with Name. Run calls it once, in definition order, and
// takes ownership of the returned Service: if a later Build fails, Run releases
// everything already built, in reverse.
type Definition struct {
	// Name identifies the service in log records, in the errors Run returns, and
	// in the logger handed to Build.
	Name string

	// Prefix is the path namespace the service is mounted under when its handler
	// is composed with others, e.g. "/auth". It must be empty or start with "/".
	// A single service mounted at the empty prefix is served directly, without a
	// router in front of it.
	Prefix string

	// Build constructs the service. Returning an error releases every service
	// built before it; returning a nil Service without an error is a programming
	// error that Run reports rather than dereferences.
	Build func(ctx context.Context, logger *slog.Logger) (*Service, error)
}

// Mounted pairs a built service with the name and prefix its Definition gave
// it. Options.Compose receives one per service, in definition order.
type Mounted struct {
	Name    string
	Prefix  string
	Service *Service
}

// CloseFunc adapts a release function that neither fails nor observes a
// deadline, such as Cleanups.Close, to the Service.Close hook.
func CloseFunc(release func()) func(context.Context) error {
	return func(context.Context) error {
		release()

		return nil
	}
}
