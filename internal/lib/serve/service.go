package serve

import (
	"context"
	"net/http"
)

// Service is a constructed, ready-to-serve service, decoupled from the HTTP
// server and process lifecycle. Splitting a service into these parts lets it
// run standalone (wrapped in its own *http.Server) or be composed with other
// services behind a single shared listener by the engine binary.
type Service struct {
	// Handler serves the service's HTTP routes. When composed under a shared
	// listener it is mounted beneath the service's path prefix.
	Handler http.Handler

	// Background runs the service's long-lived background work (controller
	// loops, worker pools). When ctx is cancelled, it must return without
	// depending on Close because lifecycle callers may wait for Background
	// before invoking Close. It is nil for services with no background work.
	Background func(ctx context.Context) error

	// Close releases resources acquired while building the service (database
	// pools, JWT key sets, image transformers). It must not be required to
	// unblock Background. It is nil when there is nothing to release.
	Close func()
}

// RunBackground delegates to Background when defined; that hook may return
// before ctx is cancelled, and an early nil return reports successful completion
// to the caller. Without a hook, it blocks until ctx is cancelled and returns nil.
func (s *Service) RunBackground(ctx context.Context) error {
	if s.Background == nil {
		<-ctx.Done()

		return nil
	}

	return s.Background(ctx)
}

// Shutdown releases the service's resources if it defined a Close hook.
func (s *Service) Shutdown() {
	if s.Close != nil {
		s.Close()
	}
}
