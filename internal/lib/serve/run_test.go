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
	"strings"
	"sync"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

var (
	errBuild      = errors.New("build failed")
	errBackground = errors.New("background failed")
	errClose      = errors.New("close failed")
	errCompose    = errors.New("compose failed")
)

// recorder collects lifecycle events from several goroutines so a test can
// assert the order Run drives them in.
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

// freeAddr reserves a loopback port and releases it, so Run can bind it without
// the test having to guess a port number.
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

func testOptions(t *testing.T) serveutil.Options {
	t.Helper()

	return serveutil.Options{
		Logger:          discardLogger(),
		Addr:            freeAddr(t),
		DebugAddr:       "",
		HTTP:            serveutil.HTTPTimeouts{ReadHeader: 0, Read: 0, Write: 0, Idle: 0},
		ShutdownTimeout: 2 * time.Second,
		Compose:         nil,
	}
}

// definition builds a service that records when its background work starts and
// stops and when its resources are released.
func definition(rec *recorder, name, prefix string, background bool) serveutil.Definition {
	return serveutil.Definition{
		Name:   name,
		Prefix: prefix,
		Build: func(_ context.Context, _ *slog.Logger) (*serveutil.Service, error) {
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
		},
	}
}

func TestRunRejectsIncompleteConfiguration(t *testing.T) {
	t.Parallel()

	build := func(context.Context, *slog.Logger) (*serveutil.Service, error) {
		return &serveutil.Service{Handler: nil, Background: nil, Close: nil}, nil
	}

	tests := []struct {
		name        string
		opts        serveutil.Options
		definitions []serveutil.Definition
		wantErr     string
	}{
		{
			name: "without a logger",
			opts: serveutil.Options{
				Logger: nil,
				Addr:   ":0",
			},
			definitions: []serveutil.Definition{{Name: "a", Prefix: "", Build: build}},
			wantErr:     "Options.Logger is required",
		},
		{
			name: "without an address",
			opts: serveutil.Options{
				Logger: discardLogger(),
				Addr:   "",
			},
			definitions: []serveutil.Definition{{Name: "a", Prefix: "", Build: build}},
			wantErr:     "Options.Addr is required",
		},
		{
			name: "without any service",
			opts: serveutil.Options{
				Logger: discardLogger(),
				Addr:   ":0",
			},
			definitions: nil,
			wantErr:     "at least one Definition is required",
		},
		{
			name: "with an unnamed service",
			opts: serveutil.Options{
				Logger: discardLogger(),
				Addr:   ":0",
			},
			definitions: []serveutil.Definition{{Name: "", Prefix: "", Build: build}},
			wantErr:     "Definition.Name is required",
		},
		{
			name: "with no constructor",
			opts: serveutil.Options{
				Logger: discardLogger(),
				Addr:   ":0",
			},
			definitions: []serveutil.Definition{{Name: "a", Prefix: "", Build: nil}},
			wantErr:     "Definition.Build is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := serveutil.Run(t.Context(), tt.opts, tt.definitions...)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("Run() err = %v; want it to contain %q", err, tt.wantErr)
			}
		})
	}
}

func TestRunServesComposedHandlersAndShutsDownOnCancel(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := testOptions(t)

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(
			ctx, opts,
			definition(&rec, "auth", "/auth", false),
			definition(&rec, "storage", "/storage", false),
		)
	}()

	body := getWhenReady(t, "http://"+opts.Addr+"/storage/v1/files")
	if want := "storage:/v1/files"; body != want {
		t.Errorf("response body = %q; want %q", body, want)
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run() err = %v; want nil", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Run did not return after cancellation")
	}

	want := []string{"build:auth", "build:storage", "close:storage", "close:auth"}
	if got := rec.snapshot(); !slicesEqual(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunReleasesResourcesAfterBackgroundStops(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := testOptions(t)

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(
			ctx, opts,
			definition(&rec, "auth", "/auth", false),
			definition(&rec, "graphql", "/graphql", true),
		)
	}()

	getWhenReady(t, "http://"+opts.Addr+"/auth/v1/signin")
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run() err = %v; want nil", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Run did not return after cancellation")
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
	if got := rec.snapshot(); !slicesEqual(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunReleasesAlreadyBuiltServicesWhenBuildFails(t *testing.T) {
	t.Parallel()

	var rec recorder

	failing := serveutil.Definition{
		Name:   "graphql",
		Prefix: "/graphql",
		Build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
			return nil, errBuild
		},
	}

	err := serveutil.Run(
		t.Context(), testOptions(t),
		definition(&rec, "auth", "/auth", false),
		definition(&rec, "storage", "/storage", false),
		failing,
	)

	if !errors.Is(err, errBuild) {
		t.Fatalf("Run() err = %v; want %v", err, errBuild)
	}

	if !strings.Contains(err.Error(), "initializing graphql") {
		t.Errorf("Run() err = %q; want it to name the failing service", err)
	}

	want := []string{"build:auth", "build:storage", "close:storage", "close:auth"}
	if got := rec.snapshot(); !slicesEqual(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunRejectsBuildReturningNoService(t *testing.T) {
	t.Parallel()

	err := serveutil.Run(
		t.Context(), testOptions(t),
		serveutil.Definition{
			Name:   "auth",
			Prefix: "",
			Build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return nil, nil //nolint:nilnil // the contract violation under test
			},
		},
	)

	if err == nil || !strings.Contains(err.Error(), "Build returned no service") {
		t.Errorf("Run() err = %v; want a not-built error naming the contract", err)
	}
}

func TestRunReleasesServicesWhenComposeFails(t *testing.T) {
	t.Parallel()

	var rec recorder

	opts := testOptions(t)
	opts.Compose = func([]serveutil.Mounted) (http.Handler, error) {
		return nil, errCompose
	}

	err := serveutil.Run(t.Context(), opts, definition(&rec, "auth", "", false))
	if !errors.Is(err, errCompose) {
		t.Fatalf("Run() err = %v; want %v", err, errCompose)
	}

	want := []string{"build:auth", "close:auth"}
	if got := rec.snapshot(); !slicesEqual(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
	}
}

func TestRunReportsBackgroundFailureAndStopsEverything(t *testing.T) {
	t.Parallel()

	failing := serveutil.Definition{
		Name:   "graphql",
		Prefix: "",
		Build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
			return &serveutil.Service{
				Handler:    http.NotFoundHandler(),
				Background: func(context.Context) error { return errBackground },
				Close:      nil,
			}, nil
		},
	}

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(t.Context(), testOptions(t), failing)
	}()

	select {
	case err := <-done:
		if !errors.Is(err, errBackground) {
			t.Fatalf("Run() err = %v; want %v", err, errBackground)
		}

		if !strings.Contains(err.Error(), "graphql background") {
			t.Errorf("Run() err = %q; want it to name the failing service", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("a failing background hook did not stop the process")
	}
}

func TestRunReportsCloseFailure(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := testOptions(t)

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(ctx, opts, serveutil.Definition{
			Name:   "auth",
			Prefix: "",
			Build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return &serveutil.Service{
					Handler:    http.NotFoundHandler(),
					Background: nil,
					Close:      func(context.Context) error { return errClose },
				}, nil
			},
		})
	}()

	getWhenReady(t, "http://"+opts.Addr+"/")
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, errClose) {
			t.Fatalf("Run() err = %v; want %v", err, errClose)
		}

		if !strings.Contains(err.Error(), "closing auth") {
			t.Errorf("Run() err = %q; want it to name the failing service", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Run did not return after cancellation")
	}
}

func TestRunRecoversPanicWhileReleasingResources(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := testOptions(t)

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(ctx, opts, serveutil.Definition{
			Name:   "auth",
			Prefix: "",
			Build: func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return &serveutil.Service{
					Handler:    http.NotFoundHandler(),
					Background: nil,
					Close:      func(context.Context) error { panic("boom") },
				}, nil
			},
		})
	}()

	getWhenReady(t, "http://"+opts.Addr+"/")
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, serveutil.ErrServicePanic) {
			t.Fatalf("Run() err = %v; want %v", err, serveutil.ErrServicePanic)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("a panicking Close crashed the process instead of being reported")
	}
}

func TestRunReportsListenerFailure(t *testing.T) {
	t.Parallel()

	// Hold the port so the listener cannot bind it.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserving a port: %v", err)
	}
	defer listener.Close()

	var rec recorder

	opts := testOptions(t)
	opts.Addr = listener.Addr().String()

	err = serveutil.Run(t.Context(), opts, definition(&rec, "auth", "", false))
	if err == nil || !strings.Contains(err.Error(), "server failed") {
		t.Fatalf("Run() err = %v; want a listener failure", err)
	}

	// The failed listener must still leave the built service released.
	want := []string{"build:auth", "close:auth"}
	if got := rec.snapshot(); !slicesEqual(got, want) {
		t.Errorf("lifecycle events = %v; want %v", got, want)
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

func TestRunServesDebugListener(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	var rec recorder

	opts := testOptions(t)
	opts.DebugAddr = freeAddr(t)

	done := make(chan error, 1)
	go func() {
		done <- serveutil.Run(ctx, opts, definition(&rec, "auth", "", false))
	}()

	if body := getWhenReady(t, "http://"+opts.DebugAddr+debugRoute); body != "debug-ok" {
		t.Errorf("debug response body = %q; want %q", body, "debug-ok")
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run() err = %v; want nil", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Run did not return after cancellation")
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

	deadline := time.Now().Add(10 * time.Second)

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

func slicesEqual(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}

	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}

	return true
}
