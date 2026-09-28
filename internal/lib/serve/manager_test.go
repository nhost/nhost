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
	testReturnDeadline = 10 * time.Second
	debugRoute         = "/debug/serve-run-test"
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

type lockedWriter struct {
	mu  sync.Mutex
	out strings.Builder
}

func (w *lockedWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	n, err := w.out.Write(p)
	if err != nil {
		return n, fmt.Errorf("writing log: %w", err)
	}

	return n, nil
}

func (w *lockedWriter) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.out.String()
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

func runOptions(addr string) serveutil.Options {
	return serveutil.Options{
		Logger: slog.New(slog.DiscardHandler), Addr: addr, HTTP: serveutil.HTTPTimeouts{},
		DebugAddr: "", ShutdownTimeout: testShutdownBudget, Compose: nil,
	}
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

func recorded(
	rec *recorder,
	name string,
) func(context.Context, *slog.Logger) (*serveutil.Service, error) {
	return func(context.Context, *slog.Logger) (*serveutil.Service, error) {
		rec.record("build:" + name)

		service := &serveutil.Service{
			Handler: http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) { _, _ = io.WriteString(w, name+":"+r.URL.Path) },
			),
			Background: nil,
			Close:      serveutil.CloseFunc(func() { rec.record("close:" + name) }),
		}

		return service, nil
	}
}

func fixed(
	service *serveutil.Service,
) func(context.Context, *slog.Logger) (*serveutil.Service, error) {
	return func(context.Context, *slog.Logger) (*serveutil.Service, error) { return service, nil }
}

func byPrefix(services []serveutil.Mounted) (http.Handler, error) {
	mux := http.NewServeMux()
	for _, service := range services {
		if service.Service.Handler != nil {
			mux.Handle(
				"/"+service.Name+"/",
				http.StripPrefix("/"+service.Name, service.Service.Handler),
			)
		}
	}

	return mux, nil
}

func runAsync(
	ctx context.Context,
	opts serveutil.Options,
	defs ...serveutil.Definition,
) <-chan error {
	done := make(chan error, 1)
	go func() { done <- serveutil.Run(ctx, opts, defs...) }()

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
		name string
		opts serveutil.Options
		defs []serveutil.Definition
		want string
	}{
		{
			"no logger",
			serveutil.Options{Addr: ":0"},
			[]serveutil.Definition{{Name: "a", Build: build}},
			"Options.Logger is required",
		},
		{
			"no address",
			runOptions(""),
			[]serveutil.Definition{{Name: "a", Build: build}},
			"Options.Addr is required",
		},
		{"no services", runOptions(":0"), nil, "at least one Definition is required"},
		{
			"no name",
			runOptions(":0"),
			[]serveutil.Definition{{Name: "", Build: build}},
			"Definition.Name is required",
		},
		{
			"duplicate name",
			runOptions(":0"),
			[]serveutil.Definition{{Name: "a", Build: build}, {Name: "a", Build: build}},
			"duplicate service name: a",
		},
		{
			"no build",
			runOptions(":0"),
			[]serveutil.Definition{{Name: "a", Build: nil}},
			"a: serve: Definition.Build is required",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if err := serveutil.Run(
				t.Context(),
				tt.opts,
				tt.defs...); err == nil ||
				!strings.Contains(err.Error(), tt.want) {
				t.Errorf("Run() err = %v; want %q", err, tt.want)
			}
		})
	}
}

func TestRunServesOnlyHandlerAndClosesOnCancel(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)

	done := runAsync(
		ctx,
		runOptions(addr),
		serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth")},
	)
	if body := getWhenReady(t, "http://"+addr+"/v1/signin"); body != "auth:/v1/signin" {
		t.Errorf("body = %q; want auth:/v1/signin", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v", err)
	}

	if want := []string{"build:auth", "close:auth"}; !slices.Equal(rec.snapshot(), want) {
		t.Errorf("events = %v; want %v", rec.snapshot(), want)
	}
}

func TestRunComposesInDefinitionOrderAndDrainsBeforeClose(t *testing.T) {
	t.Parallel()

	var rec recorder

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)
	opts := runOptions(addr)

	var composed []string

	opts.Compose = func(services []serveutil.Mounted) (http.Handler, error) {
		for _, s := range services {
			composed = append(composed, s.Name)
		}

		return byPrefix(services)
	}
	done := runAsync(ctx, opts,
		serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth")},
		serveutil.Definition{Name: "storage", Build: recorded(&rec, "storage")},
		serveutil.Definition{Name: "worker", Build: fixed(&serveutil.Service{
			Handler:    nil,
			Background: func(ctx context.Context) error { <-ctx.Done(); rec.record("background-stop:worker"); return nil },
			Close:      nil,
		})},
	)

	if body := getWhenReady(t, "http://"+addr+"/storage/v1/files"); body != "storage:/v1/files" {
		t.Errorf("body = %q; want storage:/v1/files", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v", err)
	}

	if want := []string{"auth", "storage", "worker"}; !slices.Equal(composed, want) {
		t.Errorf("compose order = %v; want %v", composed, want)
	}

	if want := []string{
		"build:auth",
		"build:storage",
		"background-stop:worker",
		"close:storage",
		"close:auth",
	}; !slices.Equal(
		rec.snapshot(),
		want,
	) {
		t.Errorf("events = %v; want %v", rec.snapshot(), want)
	}
}

func TestRunRejectsUnresolvableHandler(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		defs    []serveutil.Definition
		compose func([]serveutil.Mounted) (http.Handler, error)
		want    string
		target  error
	}{
		{
			"none",
			[]serveutil.Definition{
				{
					Name:  "worker",
					Build: fixed(&serveutil.Service{Handler: nil, Background: nil, Close: nil}),
				},
			},
			nil,
			"no service defines a Handler",
			nil,
		},
		{
			"multiple",
			[]serveutil.Definition{
				{Name: "auth", Build: fixed(&serveutil.Service{Handler: http.NotFoundHandler()})},
				{
					Name:  "storage",
					Build: fixed(&serveutil.Service{Handler: http.NotFoundHandler()}),
				},
			},
			nil,
			"set Options.Compose: [auth storage]",
			nil,
		},
		{
			"compose error",
			[]serveutil.Definition{
				{Name: "auth", Build: fixed(&serveutil.Service{Handler: http.NotFoundHandler()})},
			},
			func([]serveutil.Mounted) (http.Handler, error) { return nil, errCompose },
			"composing handler for listener",
			errCompose,
		},
		{
			"nil compose result",
			[]serveutil.Definition{
				{Name: "auth", Build: fixed(&serveutil.Service{Handler: http.NotFoundHandler()})},
			},
			func([]serveutil.Mounted) (http.Handler, error) {
				return nil, nil //nolint:nilnil // deliberate invalid compose result
			},
			"Compose returned no handler",
			nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			opts := runOptions(freeAddr(t))
			opts.Compose = tt.compose

			err := serveutil.Run(t.Context(), opts, tt.defs...)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Run() err = %v; want %q", err, tt.want)
			}

			if tt.target != nil && !errors.Is(err, tt.target) {
				t.Errorf("Run() err = %v; want %v", err, tt.target)
			}
		})
	}
}

func TestRunReleasesAlreadyBuiltServicesOnFailure(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		build func(context.Context, *slog.Logger) (*serveutil.Service, error)
		want  error
	}{
		{
			"build error",
			func(context.Context, *slog.Logger) (*serveutil.Service, error) { return nil, errBuild },
			errBuild,
		},
		{
			"nil service",
			func(context.Context, *slog.Logger) (*serveutil.Service, error) {
				return nil, nil //nolint:nilnil // deliberate invalid build result
			},
			nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var rec recorder

			err := serveutil.Run(t.Context(), runOptions(freeAddr(t)),
				serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth")},
				serveutil.Definition{Name: "storage", Build: recorded(&rec, "storage")},
				serveutil.Definition{Name: "graphql", Build: tt.build},
			)
			if err == nil || !strings.Contains(err.Error(), "building graphql") {
				t.Fatalf("Run() err = %v; want building graphql", err)
			}

			if tt.want != nil && !errors.Is(err, tt.want) {
				t.Errorf("Run() err = %v; want %v", err, tt.want)
			}

			if want := []string{
				"build:auth",
				"build:storage",
				"close:storage",
				"close:auth",
			}; !slices.Equal(
				rec.snapshot(),
				want,
			) {
				t.Errorf("events = %v; want %v", rec.snapshot(), want)
			}
		})
	}
}

func TestRunReleasesOnComposeFailure(t *testing.T) {
	t.Parallel()

	var rec recorder

	opts := runOptions(freeAddr(t))
	opts.Compose = func([]serveutil.Mounted) (http.Handler, error) { return nil, errCompose }

	err := serveutil.Run(
		t.Context(),
		opts,
		serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth")},
	)
	if !errors.Is(err, errCompose) {
		t.Fatalf("Run() err = %v; want %v", err, errCompose)
	}

	if want := []string{"build:auth", "close:auth"}; !slices.Equal(rec.snapshot(), want) {
		t.Errorf("events = %v; want %v", rec.snapshot(), want)
	}
}

func TestRunTagsLogger(t *testing.T) {
	t.Parallel()

	var out strings.Builder

	opts := runOptions(freeAddr(t))
	opts.Logger = slog.New(slog.NewTextHandler(&out, nil))

	err := serveutil.Run(
		t.Context(),
		opts,
		serveutil.Definition{
			Name: "auth",
			Build: func(ctx context.Context, logger *slog.Logger) (*serveutil.Service, error) {
				logger.InfoContext(ctx, "hello from build")
				return nil, errBuild
			},
		},
	)
	if !errors.Is(err, errBuild) {
		t.Fatalf("Run() err = %v; want %v", err, errBuild)
	}

	if !strings.Contains(out.String(), `msg="hello from build" service=auth`) {
		t.Errorf("build log = %q; want tagged logger", out.String())
	}
}

func TestRunReportsBackgroundFailure(t *testing.T) {
	t.Parallel()

	err := waitRun(
		t,
		runAsync(
			t.Context(),
			runOptions(freeAddr(t)),
			serveutil.Definition{Name: "graphql", Build: fixed(&serveutil.Service{
				Handler:    http.NotFoundHandler(),
				Background: func(context.Context) error { return errBackground },
				Close:      nil,
			})},
		),
	)
	if !errors.Is(err, errBackground) || !strings.Contains(err.Error(), "graphql background") {
		t.Fatalf("Run() err = %v; want named background failure", err)
	}
}

func TestRunReportsCloseFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		close func(context.Context) error
		want  error
	}{
		{"error", func(context.Context) error { return errClose }, errClose},
		{"panic", func(context.Context) error { panic("boom") }, serveutil.ErrServicePanic},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			addr := freeAddr(t)
			done := runAsync(
				ctx,
				runOptions(addr),
				serveutil.Definition{
					Name: "auth",
					Build: fixed(
						&serveutil.Service{
							Handler:    http.NotFoundHandler(),
							Background: nil,
							Close:      tt.close,
						},
					),
				},
			)
			getWhenReady(t, "http://"+addr+"/")
			cancel()

			err := waitRun(t, done)
			if !errors.Is(err, tt.want) || !strings.Contains(err.Error(), "closing auth") {
				t.Fatalf("Run() err = %v; want named %v", err, tt.want)
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
	opts := runOptions(freeAddr(t))
	opts.ShutdownTimeout = budget
	done := runAsync(
		ctx,
		opts,
		serveutil.Definition{Name: "graphql", Build: fixed(&serveutil.Service{
			Handler:    http.NotFoundHandler(),
			Background: func(context.Context) error { <-release; return nil },
			Close:      func(ctx context.Context) error { closeCtxErr <- ctx.Err(); return nil },
		})},
	)
	getWhenReady(t, "http://"+opts.Addr+"/")

	start := time.Now()

	cancel()

	err := waitRun(t, done)
	if !errors.Is(err, serveutil.ErrShutdownTimeout) ||
		!strings.Contains(err.Error(), "graphql background still stopping") {
		t.Fatalf("Run() err = %v; want background timeout", err)
	}

	if elapsed := time.Since(start); elapsed > budget+time.Second {
		t.Errorf("shutdown took %v; budget %v", elapsed, budget)
	}

	select {
	case ctxErr := <-closeCtxErr:
		if !errors.Is(ctxErr, context.DeadlineExceeded) {
			t.Errorf("Close context err = %v", ctxErr)
		}
	case <-time.After(testReturnDeadline):
		t.Error("Close not called")
	}
}

func TestRunReportsListenerFailure(t *testing.T) {
	t.Parallel()

	held, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer held.Close()

	var rec recorder

	addr := held.Addr().String()

	err = serveutil.Run(
		t.Context(),
		runOptions(addr),
		serveutil.Definition{Name: "auth", Build: recorded(&rec, "auth")},
	)
	if want := "listener " + addr + ": serving:"; err == nil ||
		!strings.Contains(err.Error(), want) {
		t.Fatalf("Run() err = %v; want %q", err, want)
	}

	if want := []string{"build:auth", "close:auth"}; !slices.Equal(rec.snapshot(), want) {
		t.Errorf("events = %v; want %v", rec.snapshot(), want)
	}
}

func TestRunAppliesHTTPTimeouts(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	addr := freeAddr(t)
	opts := runOptions(addr)
	opts.HTTP = serveutil.HTTPTimeouts{
		ReadHeader: 0,
		Read:       0,
		Write:      50 * time.Millisecond,
		Idle:       0,
	}
	done := runAsync(ctx, opts, serveutil.Definition{Name: "slow", Build: fixed(&serveutil.Service{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/slow" {
				time.Sleep(200 * time.Millisecond)
			}

			_, _ = io.WriteString(w, "ok")
		}),
		Background: nil, Close: nil,
	})})

	getWhenReady(t, "http://"+addr+"/")

	if body, err := get(t.Context(), "http://"+addr+"/slow"); err == nil {
		t.Errorf("slow response = %q; want timeout", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v", err)
	}
}

func TestMain(m *testing.M) {
	http.HandleFunc(
		debugRoute,
		func(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, "debug-ok") },
	)
	os.Exit(m.Run())
}

func TestRunServesDebugMuxSeparately(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := runOptions(freeAddr(t))
	opts.DebugAddr = freeAddr(t)

	done := runAsync(
		ctx,
		opts,
		serveutil.Definition{
			Name: "auth",
			Build: fixed(
				&serveutil.Service{
					Handler: http.HandlerFunc(
						func(w http.ResponseWriter, r *http.Request) { _, _ = io.WriteString(w, "auth:"+r.URL.Path) },
					),
				},
			),
		},
	)
	if body := getWhenReady(t, "http://"+opts.DebugAddr+debugRoute); body != "debug-ok" {
		t.Errorf("debug body = %q", body)
	}

	if body := getWhenReady(t, "http://"+opts.Addr+debugRoute); body != "auth:"+debugRoute {
		t.Errorf("public body = %q", body)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v", err)
	}
}

func TestRunIgnoresDebugBindFailure(t *testing.T) {
	t.Parallel()

	held, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer held.Close()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	opts := runOptions(freeAddr(t))
	opts.DebugAddr = held.Addr().String()

	var out lockedWriter

	opts.Logger = slog.New(slog.NewTextHandler(&out, nil))
	done := runAsync(
		ctx,
		opts,
		serveutil.Definition{
			Name:  "auth",
			Build: fixed(&serveutil.Service{Handler: http.NotFoundHandler()}),
		},
	)
	getWhenReady(t, "http://"+opts.Addr+"/")
	// Poll for the failed bind before cancelling, so it cannot be mistaken for
	// a normal shutdown racing the debug listener's first ListenAndServe.
	deadline := time.Now().Add(testReturnDeadline)
	for !strings.Contains(out.String(), "debug listener unavailable") {
		select {
		case err := <-done:
			t.Fatalf("debug bind stopped Run: %v", err)
		default:
		}

		if time.Now().After(deadline) {
			t.Fatal("debug bind failure not logged")
		}

		time.Sleep(time.Millisecond)
	}

	cancel()

	if err := waitRun(t, done); err != nil {
		t.Fatalf("Run() err = %v", err)
	}
}

func TestCloseFuncAdaptsAPlainRelease(t *testing.T) {
	t.Parallel()

	released := false

	release := serveutil.CloseFunc(func() { released = true })
	if err := release(t.Context()); err != nil {
		t.Errorf("CloseFunc err = %v", err)
	}

	if !released {
		t.Error("release was not called")
	}
}

func getWhenReady(t *testing.T, url string) string {
	t.Helper()

	deadline := time.Now().Add(testReturnDeadline)
	for time.Now().Before(deadline) {
		body, err := get(t.Context(), url)
		if err == nil {
			return body
		}

		time.Sleep(5 * time.Millisecond)
	}

	t.Fatalf("listener did not become ready: %s", url)

	return ""
}

func get(ctx context.Context, url string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("requesting %s: %w", url, err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	return string(body), nil
}
