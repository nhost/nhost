package serve_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

const (
	testShutdownBudget = 2 * time.Second
	// testReturnDeadline bounds how long a test waits for Run to return.
	testReturnDeadline = 10 * time.Second
)

var (
	errBuild      = errors.New("build failed")
	errBackground = errors.New("background failed")
	errClose      = errors.New("close failed")
	errCompose    = errors.New("compose failed")
)

type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) record(event string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.events = append(r.events, event)
}

func (r *recorder) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	return append([]string(nil), r.events...)
}

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func newManager() *serveutil.Manager {
	return serveutil.NewManager(
		discardLogger(), serveutil.WithShutdownTimeout(testShutdownBudget),
	)
}

func freeAddr(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserving a port: %v", err)
	}

	addr := listener.Addr().String()

	if err := listener.Close(); err != nil {
		t.Fatalf("releasing the reserved port: %v", err)
	}

	return addr
}

// recorded builds a service that echoes its name and the request path, and
// records its build, background and close events.
func recorded(rec *recorder, name string, background bool) serveutil.BuildFunc {
	return func(_ context.Context, _ *slog.Logger) (*serveutil.Service, error) {
		rec.record("build:" + name)

		service := &serveutil.Service{
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, name+":"+r.URL.Path)
			}),
			Background: nil,
			Close: serveutil.CloseFunc(func() {
				rec.record("close:" + name)
			}),
		}

		if background {
			service.Background = func(ctx context.Context) error {
				rec.record("background-start:" + name)
				<-ctx.Done()
				rec.record("background-stop:" + name)

				return nil
			}
		}

		return service, nil
	}
}

func fixed(service *serveutil.Service) serveutil.BuildFunc {
	return func(context.Context, *slog.Logger) (*serveutil.Service, error) {
		return service, nil
	}
}

// byPrefix mounts every handler beneath "/<name>", stripping the prefix.
func byPrefix(handlers map[string]http.Handler) (http.Handler, error) {
	mux := http.NewServeMux()
	for name, handler := range handlers {
		mux.Handle("/"+name+"/", http.StripPrefix("/"+name, handler))
	}

	return mux, nil
}

// runAsync runs m in the background and returns the channel its result arrives
// on.
func runAsync(
	ctx context.Context, m *serveutil.Manager, listeners ...serveutil.Listener,
) <-chan error {
	done := make(chan error, 1)

	go func() {
		done <- m.Run(ctx, listeners...)
	}()

	return done
}

func waitRun(t *testing.T, done <-chan error) error {
	t.Helper()

	select {
	case err := <-done:
		return err
	case <-time.After(testReturnDeadline):
		t.Fatal("Run did not return")

		return nil
	}
}

func TestRunRejectsIncompleteConfiguration(t *testing.T) {
	t.Parallel()

	build := fixed(&serveutil.Service{Handler: nil, Background: nil, Close: nil})

	tests := []struct {
		name        string
		logger      *slog.Logger
		definitions []serveutil.Definition
		listener    serveutil.Listener
		wantErr     string
	}{
		{
			name:        "without a logger",
			logger:      nil,
			definitions: []serveutil.Definition{{Name: "a", Build: build}},
			listener:    serveutil.Listen(":0"),
			wantErr:     "NewManager requires a logger",
		},
		{
			name:        "without any service",
			logger:      discardLogger(),
			definitions: nil,
			listener:    serveutil.Listen(":0"),
			wantErr:     "at least one service must be added",
		},
		{
			name:        "with an unnamed service",
			logger:      discardLogger(),
			definitions: []serveutil.Definition{{Name: "", Build: build}},
			listener:    serveutil.Listen(":0"),
			wantErr:     "Definition.Name is required",
		},
		{
			name:   "with a repeated name",
			logger: discardLogger(),
			definitions: []serveutil.Definition{
				{Name: "a", Build: build},
				{Name: "a", Build: build},
			},
			listener: serveutil.Listen(":0"),
			wantErr:  "duplicate service name: a",
		},
		{
			name:        "with no constructor",
			logger:      discardLogger(),
			definitions: []serveutil.Definition{{Name: "a", Build: nil}},
			listener:    serveutil.Listen(":0"),
			wantErr:     "a: serve: Definition.Build is required",
		},
		{
			name:        "with a listener without an address",
			logger:      discardLogger(),
			definitions: []serveutil.Definition{{Name: "a", Build: build}},
			listener:    serveutil.Listen(""),
			wantErr:     "a listener address is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			m := serveutil.NewManager(tt.logger)
			m.Add(tt.definitions...)

			err := m.Run(t.Context(), tt.listener)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("Run() err = %v; want it to contain %q", err, tt.wantErr)
			}
		})
	}
}

func TestRunServesTheOnlyHandlerAndShutsDownOnCancel(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)

	m := newManager()
	m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})

	done := runAsync(ctx, m, serveutil.Listen(addr))

	if body, want := getWhenReady(t, "http://"+addr+"/v1/signin"), "auth:/v1/signin"; body != want {
		t.Errorf("response body = %q; want %q", body, want)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}

	want := []string{"build:auth", "close:auth"}
	if got := rec.snapshot(); !slices.Equal(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunServesComposedHandlers(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)

	m := newManager()
	m.Add(
		serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)},
		serveutil.Definition{Name: "storage", Build: recorded(&rec, "storage", false)},
		// A service without a handler is left out of the composition.
		serveutil.Definition{Name: "worker", Build: fixed(&serveutil.Service{
			Handler:    nil,
			Background: func(ctx context.Context) error { <-ctx.Done(); return nil },
			Close:      nil,
		})},
	)

	var composed []string

	done := runAsync(ctx, m, serveutil.Listen(addr, serveutil.WithHandler(
		func(handlers map[string]http.Handler) (http.Handler, error) {
			for name := range handlers {
				composed = append(composed, name)
			}

			return byPrefix(handlers)
		},
	)))

	body := getWhenReady(t, "http://"+addr+"/storage/v1/files")
	if want := "storage:/v1/files"; body != want {
		t.Errorf("response body = %q; want %q", body, want)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}

	if len(composed) != 2 || !strings.Contains(strings.Join(composed, ","), "auth") ||
		!strings.Contains(strings.Join(composed, ","), "storage") {
		t.Errorf("composed handlers = %v; want auth and storage only", composed)
	}

	want := []string{"build:auth", "build:storage", "close:storage", "close:auth"}
	if got := rec.snapshot(); !slices.Equal(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunRejectsUnresolvableHandler(t *testing.T) {
	t.Parallel()

	noHandler := fixed(&serveutil.Service{
		Handler:    nil,
		Background: func(ctx context.Context) error { <-ctx.Done(); return nil },
		Close:      nil,
	})

	tests := []struct {
		name     string
		services []string
		listener serveutil.Listener
		wantErr  error
		wantMsg  string
	}{
		{
			name:     "no service defines a handler",
			services: []string{"worker"},
			listener: serveutil.Listen("127.0.0.1:0"),
			wantErr:  nil,
			wantMsg:  "no service defines a Handler",
		},
		{
			name:     "several services define a handler",
			services: []string{"auth", "storage"},
			listener: serveutil.Listen("127.0.0.1:0"),
			wantErr:  nil,
			wantMsg:  "compose them with WithHandler: [auth storage]",
		},
		{
			name:     "composition fails",
			services: []string{"auth"},
			listener: serveutil.Listen("127.0.0.1:0", serveutil.WithHandler(
				func(map[string]http.Handler) (http.Handler, error) { return nil, errCompose },
			)),
			wantErr: errCompose,
			wantMsg: "composing handler for listener 127.0.0.1:0",
		},
		{
			name:     "composition returns no handler",
			services: []string{"auth"},
			listener: serveutil.Listen("127.0.0.1:0", serveutil.WithHandler(
				func(map[string]http.Handler) (http.Handler, error) {
					return nil, nil //nolint:nilnil // the contract violation under test
				},
			)),
			wantErr: nil,
			wantMsg: "WithHandler returned no handler",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var rec recorder

			m := newManager()

			for _, name := range tt.services {
				if name == "worker" {
					m.Add(serveutil.Definition{Name: name, Build: noHandler})

					continue
				}

				m.Add(serveutil.Definition{Name: name, Build: recorded(&rec, name, false)})
			}

			err := m.Run(t.Context(), tt.listener)
			if err == nil || !strings.Contains(err.Error(), tt.wantMsg) {
				t.Fatalf("Run() err = %v; want it to contain %q", err, tt.wantMsg)
			}

			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("Run() err = %v; want %v", err, tt.wantErr)
			}

			// Whatever was built must be released again.
			for _, name := range tt.services {
				if name != "worker" && !slices.Contains(rec.snapshot(), "close:"+name) {
					t.Errorf("service %s was not released: %v", name, rec.snapshot())
				}
			}
		})
	}
}

func TestRunReleasesResourcesAfterBackgroundStops(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)

	m := newManager()
	m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})
	m.Add(serveutil.Definition{Name: "graphql", Build: recorded(&rec, "graphql", true)})

	done := runAsync(ctx, m, serveutil.Listen(addr, serveutil.WithHandler(byPrefix)))

	getWhenReady(t, "http://"+addr+"/auth/v1/signin")
	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}

	// Resources must be released only once the background loop that depends on
	// them has stopped, and in reverse build order.
	want := []string{
		"build:auth",
		"build:graphql",
		"background-start:graphql",
		"background-stop:graphql",
		"close:graphql",
		"close:auth",
	}
	if got := rec.snapshot(); !slices.Equal(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunRunsBackgroundWorkWithoutListeners(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	m := newManager()
	m.Add(serveutil.Definition{Name: "graphql", Build: recorded(&rec, "graphql", true)})

	done := runAsync(ctx, m)

	deadline := time.Now().Add(testReturnDeadline)
	for !slices.Contains(rec.snapshot(), "background-start:graphql") {
		if time.Now().After(deadline) {
			t.Fatal("background work never started")
		}

		time.Sleep(5 * time.Millisecond)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}
}

func TestRunRejectsNothingToRun(t *testing.T) {
	t.Parallel()

	var rec recorder

	m := newManager()
	m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})

	err := m.Run(t.Context())
	if err == nil || !strings.Contains(err.Error(), "no listener and no background work") {
		t.Fatalf("Run() err = %v; want a nothing-to-run error", err)
	}

	if want := []string{"build:auth", "close:auth"}; !slices.Equal(rec.snapshot(), want) {
		t.Errorf("lifecycle events = %v; want %v", rec.snapshot(), want)
	}
}

func TestRunReleasesAlreadyBuiltServicesWhenBuildFails(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		build   serveutil.BuildFunc
		wantErr error
		wantMsg string
	}{
		{
			name: "build returns an error",
			build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return nil, errBuild
			},
			wantErr: errBuild,
			wantMsg: "building graphql",
		},
		{
			name: "build returns no service",
			build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return nil, nil //nolint:nilnil // the contract violation under test
			},
			wantErr: nil,
			wantMsg: "building graphql: serve: Build returned no service and no error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var rec recorder

			m := newManager()
			m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})
			m.Add(serveutil.Definition{Name: "storage", Build: recorded(&rec, "storage", false)})
			m.Add(serveutil.Definition{Name: "graphql", Build: tt.build})

			err := m.Run(t.Context(), serveutil.Listen(freeAddr(t)))
			if err == nil || !strings.Contains(err.Error(), tt.wantMsg) {
				t.Fatalf("Run() err = %v; want it to contain %q", err, tt.wantMsg)
			}

			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("Run() err = %v; want %v", err, tt.wantErr)
			}

			want := []string{"build:auth", "build:storage", "close:storage", "close:auth"}
			if got := rec.snapshot(); !slices.Equal(got, want) {
				t.Errorf("lifecycle events = %v; want %v", got, want)
			}
		})
	}
}

func TestRunHandsEachServiceATaggedLogger(t *testing.T) {
	t.Parallel()

	var out strings.Builder

	logger := slog.New(slog.NewTextHandler(&out, nil))

	m := serveutil.NewManager(logger)
	m.Add(
		serveutil.Definition{
			Name: "auth",
			Build: func(ctx context.Context, logger *slog.Logger) (*serveutil.Service, error) {
				logger.InfoContext(ctx, "hello from build")

				return nil, errBuild
			},
		},
	)

	if err := m.Run(t.Context(), serveutil.Listen(freeAddr(t))); !errors.Is(err, errBuild) {
		t.Fatalf("Run() err = %v; want %v", err, errBuild)
	}

	if !strings.Contains(out.String(), `msg="hello from build" service=auth`) {
		t.Errorf("build log = %q; want it tagged with service=auth", out.String())
	}
}

func TestRunReportsBackgroundFailureAndStopsEverything(t *testing.T) {
	t.Parallel()

	m := newManager()
	m.Add(serveutil.Definition{Name: "graphql", Build: fixed(&serveutil.Service{
		Handler:    http.NotFoundHandler(),
		Background: func(context.Context) error { return errBackground },
		Close:      nil,
	})})

	err := waitRun(t, runAsync(t.Context(), m, serveutil.Listen(freeAddr(t))))
	if !errors.Is(err, errBackground) {
		t.Fatalf("Run() err = %v; want %v", err, errBackground)
	}

	if !strings.Contains(err.Error(), "graphql background") {
		t.Errorf("Run() err = %q; want it to name the failing service", err)
	}
}

func TestRunReportsCloseFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		close   func(context.Context) error
		wantErr error
	}{
		{
			name:    "an error",
			close:   func(context.Context) error { return errClose },
			wantErr: errClose,
		},
		{
			name:    "a panic",
			close:   func(context.Context) error { panic("boom") },
			wantErr: serveutil.ErrServicePanic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			addr := freeAddr(t)

			m := newManager()
			m.Add(serveutil.Definition{Name: "auth", Build: fixed(&serveutil.Service{
				Handler:    http.NotFoundHandler(),
				Background: nil,
				Close:      tt.close,
			})})

			done := runAsync(ctx, m, serveutil.Listen(addr))

			getWhenReady(t, "http://"+addr+"/")
			cancel()

			err := waitRun(t, done)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Run() err = %v; want %v", err, tt.wantErr)
			}

			if !strings.Contains(err.Error(), "closing auth") {
				t.Errorf("Run() err = %q; want it to name the failing service", err)
			}
		})
	}
}

func TestRunSharesOneShutdownBudget(t *testing.T) {
	t.Parallel()

	const budget = 100 * time.Millisecond

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	release := make(chan struct{})
	defer close(release)

	closeCtxErr := make(chan error, 1)

	m := serveutil.NewManager(discardLogger(), serveutil.WithShutdownTimeout(budget))
	m.Add(serveutil.Definition{Name: "graphql", Build: fixed(&serveutil.Service{
		Handler: http.NotFoundHandler(),
		// Ignores cancellation, so it uses up the whole budget.
		Background: func(context.Context) error {
			<-release

			return nil
		},
		Close: func(ctx context.Context) error {
			closeCtxErr <- ctx.Err()

			return nil
		},
	})})

	addr := freeAddr(t)
	done := runAsync(ctx, m, serveutil.Listen(addr))

	getWhenReady(t, "http://"+addr+"/")

	start := time.Now()

	cancel()

	err := waitRun(t, done)
	if !errors.Is(err, serveutil.ErrShutdownTimeout) {
		t.Fatalf("Run() err = %v; want %v", err, serveutil.ErrShutdownTimeout)
	}

	if !strings.Contains(err.Error(), "graphql background still stopping") {
		t.Errorf("Run() err = %q; want it to name the stuck background work", err)
	}

	if elapsed := time.Since(start); elapsed > budget+time.Second {
		t.Errorf("shutdown took %v; want it bounded by the %v budget", elapsed, budget)
	}

	// With the budget spent, Close is still called but no longer waited for.
	select {
	case ctxErr := <-closeCtxErr:
		if !errors.Is(ctxErr, context.DeadlineExceeded) {
			t.Errorf("Close context err = %v; want the exhausted shared budget", ctxErr)
		}
	case <-time.After(testReturnDeadline):
		t.Error("Close was not called after the background work was abandoned")
	}
}

func TestRunReportsListenerFailure(t *testing.T) {
	t.Parallel()

	// Hold the port so the listener cannot bind it.
	held, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserving a port: %v", err)
	}
	defer held.Close()

	var rec recorder

	m := newManager()
	m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})

	addr := held.Addr().String()

	err = m.Run(t.Context(), serveutil.Listen(addr))
	if want := "listener " + addr + ": serving:"; err == nil ||
		!strings.Contains(err.Error(), want) {
		t.Fatalf("Run() err = %v; want it to contain %q", err, want)
	}

	// The failed listener must still leave the built service released.
	if want := []string{"build:auth", "close:auth"}; !slices.Equal(rec.snapshot(), want) {
		t.Errorf("lifecycle events = %v; want %v", rec.snapshot(), want)
	}
}

func TestListenWithTimeoutsAppliesDeadlines(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)

	m := newManager()
	m.Add(serveutil.Definition{Name: "slow", Build: fixed(&serveutil.Service{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/slow" {
				time.Sleep(200 * time.Millisecond)
			}

			_, _ = io.WriteString(w, "ok")
		}),
		Background: nil,
		Close:      nil,
	})})

	done := runAsync(ctx, m, serveutil.Listen(addr, serveutil.WithTimeouts(serveutil.HTTPTimeouts{
		ReadHeader: 0,
		Read:       0,
		Write:      50 * time.Millisecond,
		Idle:       0,
	})))

	getWhenReady(t, "http://"+addr+"/")

	if body, err := get(t.Context(), "http://"+addr+"/slow"); err == nil {
		t.Errorf("slow response = %q; want the write timeout to cut it off", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}
}

// debugRoute names a route no other test uses, because registering on
// http.DefaultServeMux is process-global and panics on a repeat registration.
const debugRoute = "/debug/serve-run-test"

// TestMain registers the debug route once per test binary. Registration cannot
// live in the test itself: http.DefaultServeMux is process-global and panics on
// a repeat registration, which a -count greater than one would trigger.
func TestMain(m *testing.M) {
	http.HandleFunc(debugRoute, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "debug-ok")
	})

	os.Exit(m.Run())
}

func TestDebugListenServesDefaultServeMux(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	var rec recorder

	addr, debugAddr := freeAddr(t), freeAddr(t)

	m := newManager()
	m.Add(serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth", false)})

	done := runAsync(ctx, m, serveutil.Listen(addr), serveutil.DebugListen(debugAddr))

	if body := getWhenReady(t, "http://"+debugAddr+debugRoute); body != "debug-ok" {
		t.Errorf("debug response body = %q; want %q", body, "debug-ok")
	}

	// The public listener must not expose the debug routes.
	if body := getWhenReady(t, "http://"+addr+debugRoute); body != "auth:"+debugRoute {
		t.Errorf("public response body = %q; want the service handler", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v; want nil", err)
	}
}

func TestCloseFuncAdaptsAPlainRelease(t *testing.T) {
	t.Parallel()

	released := false
	release := serveutil.CloseFunc(func() { released = true })

	if err := release(t.Context()); err != nil {
		t.Errorf("CloseFunc hook err = %v; want nil", err)
	}

	if !released {
		t.Error("CloseFunc hook did not run the release function")
	}
}

// getWhenReady polls url until the listener accepts a connection, then returns
// the response body. It fails the test if the server never comes up.
func getWhenReady(t *testing.T, url string) string {
	t.Helper()

	deadline := time.Now().Add(testReturnDeadline)

	for {
		body, err := get(t.Context(), url)
		if err == nil {
			return body
		}

		if time.Now().After(deadline) {
			t.Fatalf("server at %s never became reachable: %v", url, err)
		}

		time.Sleep(5 * time.Millisecond)
	}
}

func get(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("building request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("issuing request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	return string(body), nil
}
