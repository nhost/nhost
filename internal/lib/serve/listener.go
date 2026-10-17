package serve

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"time"
)

// defaultReadHeaderTimeout bounds header reads without limiting uploads or responses.
const defaultReadHeaderTimeout = 5 * time.Second

var (
	errAddrRequired     = errors.New("serve: Options.Addr is required")
	errNoHandlers       = errors.New("serve: no service defines a Handler")
	errAmbiguousHandler = errors.New(
		"serve: several services define a Handler; set Options.Compose",
	)
	errNilHandler = errors.New("serve: Compose returned no handler and no error")
)

// HTTPTimeouts configures the main listener's per-connection deadlines. Zero
// leaves Read, Write and Idle off; ReadHeader defaults to five seconds.
type HTTPTimeouts struct {
	ReadHeader time.Duration
	Read       time.Duration
	Write      time.Duration
	Idle       time.Duration
}

// onlyHandler serves a standalone binary's only handler directly.
func onlyHandler(services []Mounted) (http.Handler, error) {
	var (
		names   []string
		handler http.Handler
	)

	for _, service := range services {
		if service.Service.Handler == nil {
			continue
		}

		names = append(names, service.Name)
		handler = service.Service.Handler
	}

	switch len(names) {
	case 0:
		return nil, errNoHandlers
	case 1:
		return handler, nil
	}

	sort.Strings(names)

	return nil, fmt.Errorf("%w: %v", errAmbiguousHandler, names)
}

// serverUnit adapts the main HTTP listener into a supervised unit.
func serverUnit(
	ctx context.Context,
	addr string,
	handler http.Handler,
	timeouts HTTPTimeouts,
	logger *slog.Logger,
) unit {
	readHeader := timeouts.ReadHeader
	if readHeader <= 0 {
		readHeader = defaultReadHeaderTimeout
	}

	server := &http.Server{ //nolint:exhaustruct // net/http type; unset fields keep their documented defaults
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeader,
		ReadTimeout:       timeouts.Read,
		WriteTimeout:      timeouts.Write,
		IdleTimeout:       timeouts.Idle,
	}

	return unit{
		name: "listener " + addr,
		run: func() error {
			logger.InfoContext(ctx, "starting listener", slog.String("address", addr))

			if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				return fmt.Errorf("serving: %w", err)
			}

			return nil
		},
		stop: func(shutdownCtx context.Context) error {
			logger.InfoContext(shutdownCtx, "draining listener", slog.String("address", addr))

			if err := server.Shutdown(shutdownCtx); err != nil {
				return fmt.Errorf("draining: %w", err)
			}

			return nil
		},
	}
}

// debugUnit serves the process-global mux only on the opt-in debug address.
// It is best-effort: a failed bind or serve error is logged, and run then waits
// for stop instead of returning, because any supervised unit returning shuts
// the whole group down. The main listener keeps serving either way.
func debugUnit(ctx context.Context, addr string, logger *slog.Logger) unit {
	server := &http.Server{ //nolint:exhaustruct // net/http type; unset fields keep their documented defaults
		Addr:              addr,
		Handler:           http.DefaultServeMux,
		ReadHeaderTimeout: defaultReadHeaderTimeout,
	}
	stopping := make(chan struct{})

	return unit{
		name: "debug listener " + addr,
		run: func() error {
			logger.InfoContext(ctx, "starting debug listener", slog.String("address", addr))

			if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				logger.ErrorContext(
					ctx,
					"debug listener unavailable",
					slog.String("address", addr),
					slog.Any("error", err),
				)
				<-stopping
			}

			return nil
		},
		stop: func(shutdownCtx context.Context) error {
			close(stopping)
			logger.InfoContext(shutdownCtx, "draining debug listener", slog.String("address", addr))

			if err := server.Shutdown(shutdownCtx); err != nil {
				return fmt.Errorf("draining: %w", err)
			}

			return nil
		},
	}
}
