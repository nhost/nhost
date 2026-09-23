package serve

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// newHTTPServer builds the shared listener. Every deadline other than
// ReadHeaderTimeout is left as configured, including off, so a deployment that
// streams large uploads or long-lived responses can let its load balancer own
// those limits instead.
func newHTTPServer(opts Options, handler http.Handler) *http.Server {
	return &http.Server{ //nolint:exhaustruct // net/http type; unset fields keep their documented defaults
		Addr:              opts.Addr,
		Handler:           handler,
		ReadHeaderTimeout: opts.HTTP.ReadHeader,
		ReadTimeout:       opts.HTTP.Read,
		WriteTimeout:      opts.HTTP.Write,
		IdleTimeout:       opts.HTTP.Idle,
	}
}

// newDebugServer builds the listener for http.DefaultServeMux, where
// net/http/pprof's blank import and any service-specific debug routes register
// themselves. It is deliberately a separate server: the shared listener must
// never serve DefaultServeMux, or those endpoints would be publicly reachable.
func newDebugServer(opts Options) *http.Server {
	return &http.Server{ //nolint:exhaustruct // net/http type; unset fields keep their documented defaults
		Addr:              opts.DebugAddr,
		Handler:           http.DefaultServeMux,
		ReadHeaderTimeout: opts.HTTP.ReadHeader,
	}
}

// serverUnit adapts an HTTP server into a supervised unit: it listens until the
// server fails or ctx is cancelled, then drains gracefully within
// Options.ShutdownTimeout. The drain context is detached from the cancelled
// lifecycle context so it keeps its values while getting its own budget.
func serverUnit(
	server *http.Server, name string, opts Options, logger *slog.Logger,
) supervisedService {
	return func(ctx context.Context) error {
		listenErr := make(chan error, 1)

		go func() {
			logger.InfoContext(
				ctx, "starting "+name, slog.String("address", server.Addr),
			)

			err := server.ListenAndServe()
			if errors.Is(err, http.ErrServerClosed) {
				err = nil
			}

			listenErr <- err
		}()

		select {
		case err := <-listenErr:
			if err != nil {
				return fmt.Errorf("%s failed: %w", name, err)
			}

			return nil
		case <-ctx.Done():
			return drain(ctx, server, name, opts.ShutdownTimeout, logger)
		}
	}
}

func drain(
	ctx context.Context,
	server *http.Server,
	name string,
	timeout time.Duration,
	logger *slog.Logger,
) error {
	logger.InfoContext(ctx, "shutting down "+name)

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), timeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutting down %s: %w", name, err)
	}

	return nil
}
