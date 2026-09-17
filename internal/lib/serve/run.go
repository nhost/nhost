package serve

import (
	"context"
	"errors"
	"log/slog"
)

var (
	errServeHTTPRequired = errors.New("serve: RunHooks.ServeHTTP is required")
	errShutdownRequired  = errors.New("serve: RunHooks.Shutdown is required")
)

// RunHooks names the process lifecycle callbacks used by Run.
//
// Start is optional and runs synchronously before any service background hooks
// or ServeHTTP. ServeHTTP and Shutdown are required; Run returns an error when
// either is nil. Shutdown receives the already-cancelled lifecycle context, so
// callers that need time for graceful draining must create a fresh context.
type RunHooks struct {
	Start     func(context.Context)
	ServeHTTP func(context.Context)
	Shutdown  func(context.Context) error
}

// Run coordinates the cancellable process lifecycle shared by the service
// binaries. It calls hooks.Start synchronously with the derived lifecycle
// context, starts every non-nil Background hook and hooks.ServeHTTP concurrently,
// and invokes hooks.Shutdown after the parent context is cancelled or
// hooks.ServeHTTP or a Background hook returns. Background failures are logged
// before they trigger shutdown.
//
// Run deliberately does not use Supervise because standalone binaries retain
// their existing lifecycle contract: background errors are logged and omitted
// from the returned error; background panics are not recovered and crash the
// process; one cancellation reaches every goroutine at once instead of following
// tier order; Run imposes no teardown timeout; and it returns after hooks.Shutdown
// without waiting for the background and HTTP goroutines.
//
// Run deliberately skips services without a Background hook. It does not call
// Service.Shutdown, so callers retain control of resource-cleanup ordering.
// Run returns an error without starting the lifecycle when hooks.ServeHTTP or
// hooks.Shutdown is nil. Shutdown receives the already-cancelled lifecycle
// context; it must derive a fresh context when graceful shutdown needs time.
func Run(
	ctx context.Context,
	logger *slog.Logger,
	hooks RunHooks,
	services ...*Service,
) error {
	if hooks.ServeHTTP == nil {
		return errServeHTTPRequired
	}

	if hooks.Shutdown == nil {
		return errShutdownRequired
	}

	lifecycleCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	if hooks.Start != nil {
		hooks.Start(lifecycleCtx)
	}

	for _, service := range services {
		if service.Background == nil {
			continue
		}

		go func() {
			defer cancel()

			if err := service.RunBackground(lifecycleCtx); err != nil {
				logger.ErrorContext(
					lifecycleCtx,
					"background work failed",
					slog.String("error", err.Error()),
				)
			}
		}()
	}

	go func() {
		defer cancel()

		hooks.ServeHTTP(lifecycleCtx)
	}()

	<-lifecycleCtx.Done()

	return hooks.Shutdown(lifecycleCtx)
}
