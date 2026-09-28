package serve

import (
	"context"
	"log/slog"
	"net/http"
)

// Service is a constructed service: its HTTP handler, optional background
// work, and release of the resources acquired while building it. Run owns the
// lifecycle, so the same service can run standalone or in the unified engine.
type Service struct {
	// Handler serves the service's HTTP routes. It may be nil.
	Handler http.Handler

	// Background runs long-lived work until ctx is cancelled. Run cancels it
	// only after the listener drains. It may be nil.
	Background func(ctx context.Context) error

	// Close releases resources after Background has returned, exactly once,
	// within the shared shutdown budget. If Background ignores cancellation
	// past the budget, Close may overlap the abandoned goroutine; resources
	// must tolerate concurrent use in that exceptional case. It may be nil.
	Close func(ctx context.Context) error
}

// Definition names a service, its optional mount prefix, and how to build it.
// Build receives a logger tagged with Name. A failed Build releases earlier
// services; a nil Service without an error is reported as a programming error.
type Definition struct {
	Name string
	// Prefix is passed to Compose for routing a shared listener.
	Prefix string
	Build  func(ctx context.Context, logger *slog.Logger) (*Service, error)
}

// Mounted pairs a built service with its definition's name and prefix.
// Options.Compose receives these in definition order, including services
// without an HTTP handler, so the caller can choose the routing policy.
type Mounted struct {
	Name    string
	Prefix  string
	Service *Service
}

// CloseFunc adapts a release function that neither fails nor observes a
// deadline, such as a connection pool's Close, to the Service.Close hook.
func CloseFunc(release func()) func(context.Context) error {
	return func(context.Context) error {
		release()

		return nil
	}
}
