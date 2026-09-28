package serve

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"
)

const defaultShutdownTimeout = 30 * time.Second

var (
	errLoggerRequired  = errors.New("serve: Options.Logger is required")
	errNoServices      = errors.New("serve: at least one Definition is required")
	errNameRequired    = errors.New("serve: Definition.Name is required")
	errNameDuplicate   = errors.New("serve: duplicate service name")
	errBuildRequired   = errors.New("serve: Definition.Build is required")
	errServiceNotBuilt = errors.New("serve: Build returned no service and no error")
)

// Options configures the shared HTTP listener and the process lifecycle.
type Options struct {
	Logger *slog.Logger
	Addr   string
	HTTP   HTTPTimeouts
	// DebugAddr, if nonempty, serves http.DefaultServeMux on a separate,
	// best-effort listener. Never expose this address publicly.
	DebugAddr string
	// ShutdownTimeout is one budget for listener drain, background cancellation,
	// and resource release. Non-positive values default to thirty seconds.
	ShutdownTimeout time.Duration
	// Compose receives the built services in definition order. If nil, Run
	// serves the only non-nil Handler directly.
	Compose func([]Mounted) (http.Handler, error)
}

// Run builds services in definition order and runs them until ctx is cancelled
// or a supervised part returns. It never installs signal handlers. Shutdown
// drains the public listener before cancelling background work and closes each
// service once, in reverse order, within one shared budget. A step exceeding
// the budget is reported as ErrShutdownTimeout instead of hanging the process.
// Panics in supervised work and Close become ErrServicePanic.
func Run(ctx context.Context, opts Options, definitions ...Definition) error {
	if err := validate(opts, definitions); err != nil {
		return err
	}

	if opts.ShutdownTimeout <= 0 {
		opts.ShutdownTimeout = defaultShutdownTimeout
	}

	services, err := buildAll(ctx, opts, definitions)
	if err != nil {
		return err
	}

	units, err := prepareUnits(ctx, opts, services)
	if err != nil {
		return errors.Join(err, release(ctx, opts, services))
	}

	running := startGroup(units.listeners, units.background)

	select {
	case <-ctx.Done():
	case <-running.stopped():
	}

	shutdownCtx, cancel := shutdownContext(ctx, opts.ShutdownTimeout)
	defer cancel()

	opts.Logger.InfoContext(
		shutdownCtx,
		"shutting down",
		slog.Duration("budget", opts.ShutdownTimeout),
	)

	// Keep these sequential: Close must follow the drain and background stop.
	runErr := running.shutdown(shutdownCtx)
	closeErr := closeAll(shutdownCtx, opts.Logger, services)

	return errors.Join(runErr, closeErr)
}

func validate(opts Options, definitions []Definition) error {
	if opts.Logger == nil {
		return errLoggerRequired
	}

	if opts.Addr == "" {
		return errAddrRequired
	}

	if len(definitions) == 0 {
		return errNoServices
	}

	seen := make(map[string]bool, len(definitions))
	for _, definition := range definitions {
		switch {
		case definition.Name == "":
			return errNameRequired
		case seen[definition.Name]:
			return fmt.Errorf("%w: %s", errNameDuplicate, definition.Name)
		case definition.Build == nil:
			return fmt.Errorf("%s: %w", definition.Name, errBuildRequired)
		}

		seen[definition.Name] = true
	}

	return nil
}

// buildAll retains ownership of every built service until the entire set is
// ready; on failure it releases the successful builds in reverse order.
func buildAll(ctx context.Context, opts Options, definitions []Definition) ([]Mounted, error) {
	services := make([]Mounted, 0, len(definitions))
	for _, definition := range definitions {
		service, err := definition.Build(
			ctx,
			opts.Logger.With(slog.String("service", definition.Name)),
		)
		if err == nil && service == nil {
			err = errServiceNotBuilt
		}

		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("building %s: %w", definition.Name, err),
				release(ctx, opts, services),
			)
		}

		services = append(
			services,
			Mounted{Name: definition.Name, Prefix: definition.Prefix, Service: service},
		)
		opts.Logger.InfoContext(ctx, "built service", slog.String("service", definition.Name))
	}

	return services, nil
}

type tiers struct {
	listeners  []unit
	background []unit
}

func prepareUnits(ctx context.Context, opts Options, services []Mounted) (tiers, error) {
	compose := opts.Compose
	if compose == nil {
		compose = onlyHandler
	}

	handler, err := compose(services)
	if err != nil {
		return tiers{}, fmt.Errorf("composing handler for listener %s: %w", opts.Addr, err)
	}

	if handler == nil {
		return tiers{}, fmt.Errorf("listener %s: %w", opts.Addr, errNilHandler)
	}

	result := tiers{
		listeners:  []unit{serverUnit(ctx, opts.Addr, handler, opts.HTTP, opts.Logger)},
		background: make([]unit, 0, len(services)),
	}

	if opts.DebugAddr != "" {
		result.listeners = append(result.listeners, debugUnit(ctx, opts.DebugAddr, opts.Logger))
	}

	for _, service := range services {
		if service.Service.Background != nil {
			result.background = append(result.background, backgroundUnit(ctx, service))
		}
	}

	return result, nil
}

// backgroundUnit keeps the process context's values but not its cancellation,
// so the hook remains available while the public listener drains.
func backgroundUnit(ctx context.Context, service Mounted) unit {
	backgroundCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))

	return unit{
		name: service.Name + " background",
		run: func() error {
			return service.Service.Background(backgroundCtx)
		},
		stop: func(context.Context) error {
			cancel()

			return nil
		},
	}
}

func shutdownContext(
	ctx context.Context,
	timeout time.Duration,
) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), timeout)
}

// release bounds cleanup on startup failures independently of the normal
// shutdown budget, which only starts when the running process stops.
func release(ctx context.Context, opts Options, services []Mounted) error {
	closeCtx, cancel := shutdownContext(ctx, opts.ShutdownTimeout)
	defer cancel()

	return closeAll(closeCtx, opts.Logger, services)
}

func closeAll(ctx context.Context, logger *slog.Logger, services []Mounted) error {
	var errs []error

	for _, service := range slices.Backward(services) {
		if service.Service.Close == nil {
			continue
		}

		logger.InfoContext(ctx, "releasing service resources", slog.String("service", service.Name))

		if err := closeService(ctx, service); err != nil {
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

func closeService(ctx context.Context, service Mounted) error {
	done := make(chan error, 1)

	go func() {
		done <- protect(func() error { return service.Service.Close(ctx) })
	}()

	var err error

	select {
	case err = <-done:
	case <-ctx.Done():
		select {
		case err = <-done:
		default:
			return fmt.Errorf("%w: %s still releasing resources", ErrShutdownTimeout, service.Name)
		}
	}

	if err != nil {
		return fmt.Errorf("closing %s: %w", service.Name, err)
	}

	return nil
}
