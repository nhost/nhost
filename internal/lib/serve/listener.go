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

// defaultReadHeaderTimeout bounds how long a listener waits for request
// headers. It is a cheap slowloris guard that does not limit upload or response
// duration, so it applies even when every other timeout is left off.
const defaultReadHeaderTimeout = 5 * time.Second

var (
	// errAddrRequired reports a listener with nowhere to bind.
	errAddrRequired = errors.New("serve: a listener address is required")
	// errNoHandlers reports a listener left to pick the only service handler
	// when no service defines one.
	errNoHandlers = errors.New("serve: no service defines a Handler")
	// errAmbiguousHandler reports a listener left to pick the only service
	// handler when several services define one.
	errAmbiguousHandler = errors.New(
		"serve: several services define a Handler; compose them with WithHandler",
	)
	// errNilHandler reports a WithHandler function that returned no handler and
	// no error.
	errNilHandler = errors.New("serve: WithHandler returned no handler and no error")
)

// HTTPTimeouts configures a listener's per-connection deadlines. A zero value
// leaves that deadline off, which is the right choice for a server that streams
// large uploads or long-lived responses: Read, Write and Idle timeouts would
// abort them mid-flight. ReadHeader defaults to five seconds instead of off,
// because bounding the header read costs nothing.
type HTTPTimeouts struct {
	ReadHeader time.Duration
	Read       time.Duration
	Write      time.Duration
	Idle       time.Duration
}

// ComposeFunc builds what a listener serves from the handlers of the built
// services, keyed by the name each was added under. Services without a Handler
// are absent from the map.
type ComposeFunc func(handlers map[string]http.Handler) (http.Handler, error)

// Listener is one HTTP server a Manager runs. Build one with Listen or
// DebugListen.
type Listener struct {
	label    string
	addr     string
	timeouts HTTPTimeouts
	compose  ComposeFunc
}

// ListenOption configures a Listener.
type ListenOption func(*Listener)

// Listen returns a listener bound to addr. Without WithHandler it serves the
// handler of the only service that defines one, and Run fails if there is not
// exactly one.
func Listen(addr string, opts ...ListenOption) Listener {
	listener := Listener{
		label:    "listener",
		addr:     addr,
		timeouts: HTTPTimeouts{ReadHeader: 0, Read: 0, Write: 0, Idle: 0},
		compose:  onlyHandler,
	}

	for _, opt := range opts {
		opt(&listener)
	}

	return listener
}

// DebugListen returns a listener serving http.DefaultServeMux, where
// net/http/pprof's blank import and any service-specific debug routes register
// themselves. Keep it on its own address: a public listener must never serve
// DefaultServeMux, or those endpoints would be reachable from outside.
func DebugListen(addr string) Listener {
	listener := Listen(addr, WithHandler(func(map[string]http.Handler) (http.Handler, error) {
		return http.DefaultServeMux, nil
	}))
	listener.label = "debug listener"

	return listener
}

// WithTimeouts sets the listener's per-connection deadlines.
func WithTimeouts(timeouts HTTPTimeouts) ListenOption {
	return func(l *Listener) {
		l.timeouts = timeouts
	}
}

// WithHandler sets how the listener composes the built services' handlers into
// the one it serves, e.g. by mounting each beneath its own path prefix.
func WithHandler(compose ComposeFunc) ListenOption {
	return func(l *Listener) {
		l.compose = compose
	}
}

func (l Listener) name() string {
	return l.label + " " + l.addr
}

// handler resolves what the listener serves from the built services.
func (l Listener) handler(handlers map[string]http.Handler) (http.Handler, error) {
	handler, err := l.compose(handlers)
	if err != nil {
		return nil, fmt.Errorf("composing handler for %s: %w", l.name(), err)
	}

	if handler == nil {
		return nil, fmt.Errorf("%s: %w", l.name(), errNilHandler)
	}

	return handler, nil
}

// onlyHandler is the default composition: a standalone binary's single service
// is served directly, with nothing in front of it.
func onlyHandler(handlers map[string]http.Handler) (http.Handler, error) {
	switch len(handlers) {
	case 0:
		return nil, errNoHandlers
	case 1:
		for _, handler := range handlers {
			return handler, nil
		}
	}

	names := make([]string, 0, len(handlers))
	for name := range handlers {
		names = append(names, name)
	}

	sort.Strings(names)

	return nil, fmt.Errorf("%w: %v", errAmbiguousHandler, names)
}

// unit adapts the listener into a supervised unit serving handler. Every
// deadline other than ReadHeaderTimeout is left as configured, including off,
// so a deployment that streams large uploads or long-lived responses can let
// its load balancer own those limits instead.
func (l Listener) unit(ctx context.Context, handler http.Handler, logger *slog.Logger) unit {
	readHeader := l.timeouts.ReadHeader
	if readHeader <= 0 {
		readHeader = defaultReadHeaderTimeout
	}

	server := &http.Server{ //nolint:exhaustruct // net/http type; unset fields keep their documented defaults
		Addr:              l.addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeader,
		ReadTimeout:       l.timeouts.Read,
		WriteTimeout:      l.timeouts.Write,
		IdleTimeout:       l.timeouts.Idle,
	}

	return unit{
		name: l.name(),
		run: func() error {
			logger.InfoContext(ctx, "starting "+l.label, slog.String("address", l.addr))

			err := server.ListenAndServe()
			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				return fmt.Errorf("serving: %w", err)
			}

			return nil
		},
		stop: func(shutdownCtx context.Context) error {
			logger.InfoContext(shutdownCtx, "draining "+l.label, slog.String("address", l.addr))

			if err := server.Shutdown(shutdownCtx); err != nil {
				return fmt.Errorf("draining: %w", err)
			}

			return nil
		},
	}
}
