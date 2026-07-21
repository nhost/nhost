package serve

import (
	"context"
	"net/http"
)

// Service is a constructed, ready-to-serve service, decoupled from the HTTP
// server and process lifecycle. Splitting a service into these parts lets it
// run standalone (wrapped in its own *http.Server) or be composed with other
// services behind a single shared listener by the nhost-engine binary.
type Service struct {
	// Handler serves the service's HTTP routes. When composed under a shared
	// listener it is mounted beneath the service's path prefix.
	Handler http.Handler

	// Background runs the service's long-lived background work (controller
	// loops, worker pools) and blocks until ctx is cancelled. It is nil for
	// services that have no background work.
	Background func(ctx context.Context) error

	// Close releases resources acquired while building the service (database
	// pools, JWT key sets, image transformers). It is nil when there is
	// nothing to release.
	Close func()
}

// RunBackground runs the background work if the service defines any, otherwise
// it blocks until ctx is cancelled and returns nil. It never returns before
// ctx is done, so callers can treat every service uniformly.
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
