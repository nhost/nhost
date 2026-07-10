// Package runservice helps write Nhost Run services in Go. It wires the
// health-check endpoint the Nhost Run platform probes -- GET /healthz, which
// must return 200 within 5 seconds -- and runs an HTTP server that drains
// in-flight requests when the platform sends SIGTERM.
//
// It deliberately depends only on the standard library: bring your own client
// (e.g. github.com/nhost/nhost/packages/nhost-go) and your own router; this
// package only takes care of the Run service's HTTP lifecycle.
package runservice

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	readHeaderTimeout = 10 * time.Second
	shutdownTimeout   = 10 * time.Second
)

// HealthFunc reports whether the service is healthy. Returning nil serves
// GET /healthz as 200; a non-nil error serves 503 so the Nhost Run platform
// restarts the container. It must return well within the platform's 5-second
// probe timeout, so it should check liveness cheaply (e.g. read a cached flag)
// rather than making slow downstream calls.
type HealthFunc func(context.Context) error

// Healthz returns the http.Handler for the GET /healthz probe. Use it to mount
// the endpoint on your own router; Serve wires it for you. A nil health treats
// the service as always healthy.
func Healthz(health HealthFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if health != nil {
			if err := health(r.Context()); err != nil {
				http.Error(w, err.Error(), http.StatusServiceUnavailable)

				return
			}
		}

		w.WriteHeader(http.StatusOK)
	})
}

// Serve runs an HTTP server on addr that answers GET /healthz via health and
// delegates every other request to handler. It blocks until ctx is cancelled
// or the process receives SIGINT/SIGTERM, then drains in-flight requests within
// a short grace period. A nil handler serves only /healthz; a nil health treats
// the service as always healthy.
func Serve(ctx context.Context, addr string, handler http.Handler, health HealthFunc) error {
	mux := http.NewServeMux()
	mux.Handle("/healthz", Healthz(health))

	if handler != nil {
		mux.Handle("/", handler)
	}

	srv := &http.Server{ //nolint:exhaustruct
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: readHeaderTimeout,
	}

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)

	go func() {
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err

			return
		}

		errc <- nil
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	// A fresh context on purpose: ctx is already cancelled by the time we get
	// here, so the drain deadline must not inherit its cancellation.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil { //nolint:contextcheck
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	return nil
}
