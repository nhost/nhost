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

// defaultShutdownTimeout is the shutdown budget when WithShutdownTimeout is not
// given.
const defaultShutdownTimeout = 30 * time.Second

var (
	// errLoggerRequired reports a Manager with no logger to hand to the services
	// it builds.
	errLoggerRequired = errors.New("serve: NewManager requires a logger")
	// errNoServices reports a Run with nothing to build.
	errNoServices = errors.New("serve: at least one service must be added")
	// errNameRequired reports a service that cannot be named in logs or errors.
	errNameRequired = errors.New("serve: Definition.Name is required")
	// errNameDuplicate reports two services added under the same name, which
	// would make them indistinguishable to WithHandler.
	errNameDuplicate = errors.New("serve: duplicate service name")
	// errBuildRequired reports a service added with no constructor.
	errBuildRequired = errors.New("serve: Definition.Build is required")
	// errServiceNotBuilt reports a BuildFunc that returned neither a service nor
	// an error, guarding against a nil dereference downstream.
	errServiceNotBuilt = errors.New("serve: Build returned no service and no error")
	// errNothingToRun reports a Run with no listener and no background work,
	// which would build every service only to release it again at once.
	errNothingToRun = errors.New("serve: no listener and no background work to run")
)

// Manager builds a set of services and runs them as one process: behind
// shared listeners, under one cancellation, and torn down in order.
//
// Services are registered with Add and only built when Run is called, so the
// Manager owns every resource from the moment it is acquired. A standalone
// binary adds its one service; a composed binary adds whichever subset it was
// configured to run.
type Manager struct {
	logger          *slog.Logger
	shutdownTimeout time.Duration
	definitions     []Definition
}

// built is a service Run has constructed and now owns.
type built struct {
	name    string
	service *Service
}

// Option configures a Manager.
type Option func(*Manager)

// WithShutdownTimeout sets the total shutdown budget: the time from the moment
// shutdown begins until every listener has drained, all background work has
// stopped, and every service has released its resources. A non-positive value
// keeps the default of thirty seconds.
//
// Keep it below the process supervisor's termination grace period, so shutdown
// completes, or reports what it had to abandon, before the process is killed.
func WithShutdownTimeout(timeout time.Duration) Option {
	return func(m *Manager) {
		if timeout > 0 {
			m.shutdownTimeout = timeout
		}
	}
}

// NewManager returns a Manager that logs its lifecycle to logger and hands each
// service a copy of it tagged with the service's name.
func NewManager(logger *slog.Logger, opts ...Option) *Manager {
	m := &Manager{
		logger:          logger,
		shutdownTimeout: defaultShutdownTimeout,
		definitions:     nil,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Add registers services. Run builds them in the order they were added and
// releases them in reverse. Invalid definitions, such as an empty or repeated
// name, are reported by Run.
func (m *Manager) Add(definitions ...Definition) {
	m.definitions = append(m.definitions, definitions...)
}

// Run builds every added service, serves them on the given listeners, and runs
// their background work until ctx is cancelled or any listener or background
// hook returns. It never installs signal handlers: cancellation is the caller's
// to deliver, usually from a signal.NotifyContext created in main.
//
// Shutdown runs in the reverse of the order things become unavailable: the
// listeners drain first, so in-flight requests still see live service
// resources; then background work is cancelled; then each service's Close runs,
// in reverse build order. All of it shares the one budget set by
// WithShutdownTimeout. A step still running when the budget ends is reported as
// ErrShutdownTimeout and abandoned rather than allowed to hang the process.
//
// A part that returns, cleanly or not, stops the rest: a stopped service must
// not leave its peers running headless in the same process. Panics surface as
// ErrServicePanic instead of crashing the process. The returned error joins
// everything that failed along the way.
func (m *Manager) Run(ctx context.Context, listeners ...Listener) error {
	if err := m.validate(listeners); err != nil {
		return err
	}

	services, err := m.buildAll(ctx)
	if err != nil {
		return err
	}

	units, err := m.units(ctx, services, listeners)
	if err != nil {
		return errors.Join(err, m.release(ctx, services))
	}

	running := startGroup(units.listeners, units.background)

	select {
	case <-ctx.Done():
	case <-running.stopped():
	}

	shutdownCtx, cancel := m.shutdownContext(ctx)
	defer cancel()

	m.logger.InfoContext(
		shutdownCtx, "shutting down", slog.Duration("budget", m.shutdownTimeout),
	)

	// Sequenced deliberately rather than inlined into errors.Join: resources may
	// only be released once every unit has stopped, and argument evaluation
	// order is too implicit to carry that guarantee.
	runErr := running.shutdown(shutdownCtx)
	closeErr := m.closeAll(shutdownCtx, services)

	return errors.Join(runErr, closeErr)
}

func (m *Manager) validate(listeners []Listener) error {
	if m.logger == nil {
		return errLoggerRequired
	}

	if len(m.definitions) == 0 {
		return errNoServices
	}

	seen := make(map[string]bool, len(m.definitions))

	for _, definition := range m.definitions {
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

	for _, listener := range listeners {
		if listener.addr == "" {
			return errAddrRequired
		}
	}

	return nil
}

// buildAll constructs every service in the order it was added. Until the whole
// set is built it retains ownership: a failure releases the services already
// built, in reverse, so a half-built process leaks nothing.
func (m *Manager) buildAll(ctx context.Context) ([]built, error) {
	services := make([]built, 0, len(m.definitions))

	for _, definition := range m.definitions {
		service, err := definition.Build(
			ctx, m.logger.With(slog.String("service", definition.Name)),
		)
		if err == nil && service == nil {
			err = errServiceNotBuilt
		}

		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("building %s: %w", definition.Name, err),
				m.release(ctx, services),
			)
		}

		services = append(services, built{name: definition.Name, service: service})

		m.logger.InfoContext(ctx, "built service", slog.String("service", definition.Name))
	}

	return services, nil
}

type tiers struct {
	listeners  []unit
	background []unit
}

// units prepares everything Run supervises: one unit per listener, then one per
// service with background work.
func (m *Manager) units(
	ctx context.Context, services []built, listeners []Listener,
) (tiers, error) {
	handlers := make(map[string]http.Handler, len(services))

	for _, service := range services {
		if service.service.Handler != nil {
			handlers[service.name] = service.service.Handler
		}
	}

	result := tiers{
		listeners:  make([]unit, 0, len(listeners)),
		background: make([]unit, 0, len(services)),
	}

	for _, listener := range listeners {
		handler, err := listener.handler(handlers)
		if err != nil {
			return tiers{}, err
		}

		result.listeners = append(result.listeners, listener.unit(ctx, handler, m.logger))
	}

	for _, service := range services {
		if service.service.Background != nil {
			result.background = append(result.background, backgroundUnit(ctx, service))
		}
	}

	if len(result.listeners) == 0 && len(result.background) == 0 {
		return tiers{}, errNothingToRun
	}

	return result, nil
}

// backgroundUnit adapts a service's background hook into a supervised unit. Its
// context keeps the process context's values but not its cancellation, so the
// hook keeps running while the listeners drain and stops only when its own tier
// is shut down.
func backgroundUnit(ctx context.Context, service built) unit {
	backgroundCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))

	return unit{
		name: service.name + " background",
		run: func() error {
			return service.service.Background(backgroundCtx)
		},
		stop: func(context.Context) error {
			cancel()

			return nil
		},
	}
}

// shutdownContext starts the shutdown budget. It is detached from ctx, which is
// usually already cancelled by then, so it keeps ctx's values while getting a
// deadline of its own.
func (m *Manager) shutdownContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), m.shutdownTimeout)
}

// release closes services outside a normal shutdown, when Run fails before
// anything started, under a budget of its own.
func (m *Manager) release(ctx context.Context, services []built) error {
	closeCtx, cancel := m.shutdownContext(ctx)
	defer cancel()

	return m.closeAll(closeCtx, services)
}

// closeAll releases every service's resources in reverse build order within
// ctx. A Close still running when ctx ends is abandoned and reported; the
// remaining services are still given the chance to start releasing before the
// process exits.
func (m *Manager) closeAll(ctx context.Context, services []built) error {
	var errs []error

	for _, service := range slices.Backward(services) {
		if service.service.Close == nil {
			continue
		}

		m.logger.InfoContext(
			ctx, "releasing service resources", slog.String("service", service.name),
		)

		if err := closeService(ctx, service); err != nil {
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

func closeService(ctx context.Context, service built) error {
	done := make(chan error, 1)

	go func() {
		done <- protect(func() error { return service.service.Close(ctx) })
	}()

	var err error

	select {
	case err = <-done:
	case <-ctx.Done():
		// Prefer a Close that finished just as the budget ran out over reporting
		// it as stuck.
		select {
		case err = <-done:
		default:
			return fmt.Errorf("%w: %s still releasing resources", ErrShutdownTimeout, service.name)
		}
	}

	if err != nil {
		return fmt.Errorf("closing %s: %w", service.name, err)
	}

	return nil
}
