package serve

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"slices"
	"time"
)

const (
	// defaultReadHeaderTimeout bounds how long a server waits for request
	// headers. It is a cheap slowloris guard that does not limit upload or
	// response duration, so it applies even when every other timeout is left off.
	defaultReadHeaderTimeout = 5 * time.Second
	// defaultShutdownTimeout bounds graceful listener drain and resource release
	// when Options leaves the budget unset.
	defaultShutdownTimeout = 30 * time.Second
	// maxTierTimeoutSlack is the headroom the supervisor gets on top of the
	// shutdown budget, so a unit that bounds its own shutdown by that budget can
	// report the result before the tier is abandoned. A budget shorter than this
	// gets itself as headroom instead, keeping a small budget small.
	maxTierTimeoutSlack = 5 * time.Second
)

var (
	// errLoggerRequired reports a Run call with no logger to hand to the
	// services it builds.
	errLoggerRequired = errors.New("serve: Options.Logger is required")
	// errAddrRequired reports a Run call with no address for its listener.
	errAddrRequired = errors.New("serve: Options.Addr is required")
	// errNoServices reports a Run call with nothing to run.
	errNoServices = errors.New("serve: at least one Definition is required")
	// errNameRequired reports a Definition that cannot be named in logs or errors.
	errNameRequired = errors.New("serve: Definition.Name is required")
	// errBuildRequired reports a Definition with no constructor.
	errBuildRequired = errors.New("serve: Definition.Build is required")
	// errServiceNotBuilt reports a Build that returned neither a service nor an
	// error, guarding against a nil dereference downstream.
	errServiceNotBuilt = errors.New("serve: Build returned no service and no error")
)

// HTTPTimeouts configures the shared listener's per-connection deadlines. A
// zero value leaves that deadline off, which is the right choice for a server
// that streams large uploads or long-lived responses: Read, Write and Idle
// timeouts would abort them mid-flight. ReadHeader defaults to five seconds
// instead of off, because bounding the header read costs nothing.
type HTTPTimeouts struct {
	ReadHeader time.Duration
	Read       time.Duration
	Write      time.Duration
	Idle       time.Duration
}

// Options configures the process lifecycle Run owns.
type Options struct {
	// Logger receives Run's own lifecycle records and, tagged with each
	// service's name, is handed to every Definition.Build. It is required.
	Logger *slog.Logger

	// Addr is the address the shared listener binds to. It is required.
	Addr string

	// DebugAddr serves http.DefaultServeMux on a second listener when non-empty,
	// exposing whatever the process registered there — net/http/pprof's handlers
	// via its blank import, plus any service-specific debug routes. The main
	// listener never serves DefaultServeMux, so these endpoints are reachable
	// only through this address.
	DebugAddr string

	// HTTP configures the shared listener's per-connection deadlines.
	HTTP HTTPTimeouts

	// ShutdownTimeout bounds the graceful drain of each listener and, separately,
	// the release of every service's resources. It defaults to thirty seconds.
	ShutdownTimeout time.Duration

	// Compose turns the built services into the handler the shared listener
	// serves. It defaults to MountByPrefix.
	Compose func(services []Mounted) (http.Handler, error)
}

// Run builds the given services, serves them behind one listener, and tears
// everything down again when ctx is cancelled or any part of the process stops.
//
// It never installs signal handlers: cancellation is the caller's to deliver.
// Call SignalContext from main and pass the result here.
//
// The sequence is: build every service in definition order; compose their
// handlers into one; start the listener, the optional debug listener, and every
// background hook. Shutdown then runs in the reverse of the order things become
// unavailable — the listeners drain first, so in-flight requests still see live
// service resources; then background work is cancelled; then each service's
// Close runs, in reverse build order. Each phase is bounded by ShutdownTimeout,
// and a phase that overruns is reported and abandoned rather than allowed to
// hang the process.
//
// A service that returns, cleanly or not, tears down the rest: a stopped
// service must not leave its peers running headless in the same process. Panics
// in background work and in Close surface as ErrServicePanic instead of
// crashing the process. The returned error joins everything that failed along
// the way.
func Run(ctx context.Context, opts Options, definitions ...Definition) error {
	opts, err := opts.normalized(definitions)
	if err != nil {
		return err
	}

	services, err := buildAll(ctx, opts, definitions)
	if err != nil {
		return err
	}

	handler, err := opts.Compose(services)
	if err != nil {
		return errors.Join(
			fmt.Errorf("composing handler: %w", err),
			closeAll(ctx, opts, services),
		)
	}

	// Sequenced deliberately rather than inlined into errors.Join: resources may
	// only be released once supervision has returned, and argument evaluation
	// order is too implicit to carry that guarantee.
	runErr := superviseServices(ctx, opts, handler, services)
	closeErr := closeAll(ctx, opts, services)

	return errors.Join(runErr, closeErr)
}

// normalized validates the parts of a run that have no sensible fallback and
// fills in the defaults for the parts that do.
func (o Options) normalized(definitions []Definition) (Options, error) {
	if o.Logger == nil {
		return o, errLoggerRequired
	}

	if o.Addr == "" {
		return o, errAddrRequired
	}

	if len(definitions) == 0 {
		return o, errNoServices
	}

	for _, definition := range definitions {
		if definition.Name == "" {
			return o, errNameRequired
		}

		if definition.Build == nil {
			return o, fmt.Errorf("%s: %w", definition.Name, errBuildRequired)
		}
	}

	if o.ShutdownTimeout <= 0 {
		o.ShutdownTimeout = defaultShutdownTimeout
	}

	if o.HTTP.ReadHeader <= 0 {
		o.HTTP.ReadHeader = defaultReadHeaderTimeout
	}

	if o.Compose == nil {
		o.Compose = MountByPrefix
	}

	return o, nil
}

// buildAll constructs every service in definition order. Until the whole set is
// built it retains ownership: a failure releases the services already built, in
// reverse, so a half-built process leaks nothing.
func buildAll(
	ctx context.Context, opts Options, definitions []Definition,
) (_ []Mounted, err error) {
	services := make([]Mounted, 0, len(definitions))

	defer func() {
		if err != nil {
			if closeErr := closeAll(ctx, opts, services); closeErr != nil {
				opts.Logger.ErrorContext(
					ctx,
					"releasing partially built services",
					slog.String("error", closeErr.Error()),
				)
			}
		}
	}()

	for _, definition := range definitions {
		var service *Service

		service, err = definition.Build(
			ctx, opts.Logger.With(slog.String("service", definition.Name)),
		)
		if err != nil {
			return nil, fmt.Errorf("initializing %s: %w", definition.Name, err)
		}

		if service == nil {
			err = fmt.Errorf("%s: %w", definition.Name, errServiceNotBuilt)

			return nil, err
		}

		services = append(services, Mounted{
			Name:    definition.Name,
			Prefix:  definition.Prefix,
			Service: service,
		})

		opts.Logger.InfoContext(
			ctx,
			"built service",
			slog.String("service", definition.Name),
			slog.String("prefix", definition.Prefix),
		)
	}

	return services, nil
}

// superviseServices runs the listeners and the background hooks until one of
// them stops or ctx is cancelled, then shuts them down in that order.
func superviseServices(
	ctx context.Context, opts Options, handler http.Handler, services []Mounted,
) error {
	listeners := []supervisedService{
		serverUnit(newHTTPServer(opts, handler), "server", opts, opts.Logger),
	}

	if opts.DebugAddr != "" {
		listeners = append(
			listeners, serverUnit(newDebugServer(opts), "debug server", opts, opts.Logger),
		)
	}

	background := make([]supervisedService, 0, len(services))

	for _, service := range services {
		if service.Service.Background == nil {
			continue
		}

		background = append(background, backgroundUnit(service))
	}

	tierTimeout := opts.ShutdownTimeout + min(maxTierTimeoutSlack, opts.ShutdownTimeout)

	if err := supervise(ctx, tierTimeout, listeners, background); err != nil {
		return fmt.Errorf("running services: %w", err)
	}

	return nil
}

// backgroundUnit adapts a service's background hook into a supervised unit,
// naming the service in whatever it returns.
func backgroundUnit(service Mounted) supervisedService {
	return func(ctx context.Context) error {
		if err := service.Service.Background(ctx); err != nil {
			return fmt.Errorf("%s background: %w", service.Name, err)
		}

		return nil
	}
}

// closeAll releases every service's resources in reverse build order, under one
// shared budget detached from the cancelled lifecycle context. A Close that
// exhausts the budget is abandoned and reported; the remaining services are
// still given the chance to start releasing before the process exits.
func closeAll(ctx context.Context, opts Options, services []Mounted) error {
	closeCtx, cancel := context.WithTimeout(
		context.WithoutCancel(ctx), opts.ShutdownTimeout,
	)
	defer cancel()

	var errs []error

	for _, service := range slices.Backward(services) {
		if service.Service.Close == nil {
			continue
		}

		opts.Logger.InfoContext(
			closeCtx, "releasing service resources", slog.String("service", service.Name),
		)

		if err := closeService(closeCtx, service); err != nil {
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

func closeService(ctx context.Context, service Mounted) error {
	done := make(chan error, 1)

	go func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				done <- fmt.Errorf(
					"%w: closing %s: %v\n%s",
					ErrServicePanic, service.Name, recovered, debug.Stack(),
				)
			}
		}()

		done <- service.Service.Close(ctx)
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("closing %s: %w", service.Name, err)
		}

		return nil
	case <-ctx.Done():
		return fmt.Errorf("%w: %s is still releasing resources", ErrShutdownTimeout, service.Name)
	}
}
