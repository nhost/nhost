package cmd

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/image"
	"github.com/nhost/nhost/services/storage/metadata"
	"github.com/nhost/nhost/services/storage/storage"
	"github.com/urfave/cli/v3"
)

func TestResolvePostgresSource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, source, fallback string
		enabled                bool
		want                   string
		wantErr                bool
	}{
		{"explicit", "explicit", "fallback", true, "explicit", false},
		{"fallback", "", "fallback", true, "fallback", false},
		{"missing enabled", "", "", true, "", true},
		{"disabled", "", "", false, "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolvePostgresSource(tt.source, tt.fallback, tt.enabled)
			if got != tt.want || (err != nil) != tt.wantErr {
				t.Fatalf(
					"source = %q, error = %v; want %q, error = %v",
					got,
					err,
					tt.want,
					tt.wantErr,
				)
			}
		})
	}
}

func TestValidateUsageStartup(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, source, fallback, bind, wantSource string
		limit                                    int64
		wantErr                                  error
	}{
		{name: "negative limit disabled", limit: -1, wantErr: errNegativeStorageLimit},
		{
			name:    "negative limit with metrics",
			bind:    "127.0.0.1:0",
			limit:   -1,
			wantErr: errNegativeStorageLimit,
		},
		{name: "zero limit disabled"},
		{name: "enabled without source", bind: "127.0.0.1:0", wantErr: errMissingUsageSource},
		{
			name:       "enabled with source",
			source:     "postgres://example",
			bind:       "127.0.0.1:0",
			wantSource: "postgres://example",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := validateUsageStartup(tt.source, tt.fallback, tt.bind, tt.limit)
			if !errors.Is(err, tt.wantErr) || got != tt.wantSource {
				t.Fatalf(
					"source = %q, error = %v; want %q, error = %v",
					got,
					err,
					tt.wantSource,
					tt.wantErr,
				)
			}
		})
	}
}

func TestUsageStartupValidation(t *testing.T) {
	t.Parallel()

	pool, server, listener, err := startUsage(
		context.Background(),
		"not a postgres URL",
		"127.0.0.1:0",
	)
	if pool != nil || server != nil || listener != nil {
		t.Fatal("invalid source opened usage resources")
	}

	if !errors.Is(err, errInvalidUsageSource) {
		t.Fatalf("invalid source error = %v", err)
	}

	pool, server, listener, err = startUsage(context.Background(), "", "")
	if err != nil || pool != nil || server != nil || listener != nil {
		t.Fatalf(
			"disabled startup: pool=%v server=%v listener=%v err=%v",
			pool,
			server,
			listener,
			err,
		)
	}
}

func TestUsageConnectionErrorRedactsPassword(t *testing.T) {
	t.Parallel()

	const password = "distinctive-secret-password"
	// A closed local port gives a connect error after the DSN has parsed.
	pool, server, listener, err := startUsage(
		context.Background(),
		"postgres://postgres:"+password+"@127.0.0.1:1/postgres?sslmode=disable&connect_timeout=1",
		"",
	)
	if pool != nil || server != nil || listener != nil {
		t.Fatal("failed probe retained usage resources")
	}

	if !errors.Is(err, errUnreadableUsage) || !strings.Contains(err.Error(), "127.0.0.1:1") {
		t.Fatalf("expected connect cause and probe sentinel, got %v", err)
	}

	if strings.Contains(err.Error(), password) {
		t.Fatal("connection error exposed password")
	}
}

func TestSecretPostgresSource(t *testing.T) {
	t.Parallel()

	if !isSecret(flagPostgresSource) {
		t.Fatal("postgres source must be redacted")
	}
}

type fakeUsage struct {
	total          int64
	err            error
	failAfterProbe bool
	reads          atomic.Int32
	closed         atomic.Bool
	onClose        func()
}

func (f *fakeUsage) Total(context.Context) (int64, error) {
	if f.failAfterProbe && f.reads.Add(1) == 1 {
		return f.total, nil
	}

	return f.total, f.err
}

func (f *fakeUsage) Close() {
	if f.onClose != nil {
		f.onClose()
	}

	f.closed.Store(true)
}

var errFakeUsage = errors.New("usage unavailable")

//nolint:paralleltest // The occupied port is shared by the table cases.
func TestUsageStartupFailures(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()

	tests := []struct {
		name, bind string
		probeErr   error
	}{
		{"probe without migrations", "", errFakeUsage},
		{"probe with metrics", "127.0.0.1:0", errFakeUsage},
		{"occupied bind", occupied.Addr().String(), nil},
		{"invalid bind", "bad address", nil},
	}
	//nolint:paralleltest // The occupied port is shared.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeUsage{err: tt.probeErr}

			pool, server, listener, err := startUsageWith(
				context.Background(),
				"source",
				tt.bind,
				func(context.Context, string) (usageConnection, error) { return fake, nil },
			)
			if err == nil || pool != nil || server != nil || listener != nil {
				t.Fatalf("startup = %v %v %v %v", pool, server, listener, err)
			}

			if !fake.closed.Load() {
				t.Fatal("pool not closed")
			}
		})
	}
}

//nolint:gocognit // Scrape assertions cover status, metric shape and lifecycle.
func TestMetricsScrape(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		total   int64
		readErr error
		status  int
		line    string
	}{
		{"value", 42, nil, http.StatusOK, "nhost_storage_total_bytes 42"},
		{"read failure", 0, errFakeUsage, http.StatusInternalServerError, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			fake := &fakeUsage{total: tt.total, err: tt.readErr, failAfterProbe: tt.readErr != nil}

			pool, server, listener, err := startUsageWith(
				context.Background(),
				"source",
				"127.0.0.1:0",
				func(context.Context, string) (usageConnection, error) { return fake, nil },
			)
			if err != nil {
				t.Fatal(err)
			}
			defer pool.Close()
			defer listener.Close()

			done := make(chan error, 1)
			go func() { done <- server.Serve(listener) }()

			defer func() {
				if err := server.Shutdown(context.Background()); err != nil {
					t.Error(err)
				}

				<-done
			}()

			client := &http.Client{
				Timeout: 5 * time.Second,
			}

			resp, err := client.Get(
				"http://" + listener.Addr().String() + "/metrics",
			)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatal(err)
			}

			if resp.StatusCode != tt.status {
				t.Fatalf("status=%d body=%s", resp.StatusCode, body)
			}

			if tt.line != "" {
				lines := strings.Split(string(body), "\n")

				found := false
				for _, line := range lines {
					if line == tt.line {
						found = true
					}

					if strings.HasPrefix(line, "nhost_storage_total_bytes{") {
						t.Fatalf("unexpected labels: %s", line)
					}
				}

				if !found {
					t.Fatalf("metric missing: %s", body)
				}
			}
		})
	}
}

func TestMetricsNotOnPublicRouter(t *testing.T) {
	t.Parallel()

	cmd := &cli.Command{Flags: CommandServe().Flags}
	logger := slog.Default()

	transformer := image.NewTransformer(1, 100, 1)
	defer transformer.Shutdown()

	server, err := getServer(
		cmd,
		metadata.NewHasura("http://localhost/graphql"),
		&storage.S3{},
		transformer,
		logger,
	)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}

	recorder := &statusRecorder{header: make(http.Header)}
	server.Handler.ServeHTTP(recorder, req)

	if recorder.status != http.StatusNotFound {
		t.Fatalf("/metrics status = %d", recorder.status)
	}
}

type statusRecorder struct {
	header http.Header
	status int
}

func (w *statusRecorder) Header() http.Header         { return w.header }
func (w *statusRecorder) WriteHeader(status int)      { w.status = status }
func (w *statusRecorder) Write(p []byte) (int, error) { return len(p), nil }
func TestShutdownUsage(t *testing.T) {
	t.Parallel()

	fake := &fakeUsage{}
	metrics := newMetricsServer("127.0.0.1:0", fake)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() { done <- metrics.Serve(listener) }()

	client := &http.Client{Timeout: time.Second}
	url := "http://" + listener.Addr().String() + "/metrics"

	deadline := time.After(5 * time.Second)
	for {
		resp, requestErr := client.Get(url)
		if requestErr == nil {
			if closeErr := resp.Body.Close(); closeErr != nil {
				t.Fatal(closeErr)
			}

			if resp.StatusCode == http.StatusOK {
				break
			}
		}

		select {
		case <-deadline:
			t.Fatalf("metrics server did not start: %v", requestErr)
		case <-time.After(10 * time.Millisecond):
		}
	}

	fake.onClose = func() {
		if conn, dialErr := net.DialTimeout(
			"tcp",
			listener.Addr().String(),
			time.Second,
		); dialErr == nil {
			conn.Close()
			t.Error("pool closed before metrics listener stopped")
		}
	}
	main := &http.Server{}

	if err := shutdownUsage(context.Background(), metrics, main, fake); err != nil {
		t.Fatal(err)
	}

	if !fake.closed.Load() {
		t.Fatal("pool remains open")
	}

	if err := <-done; !errors.Is(err, http.ErrServerClosed) {
		t.Fatal(err)
	}

	if _, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second); err == nil {
		t.Fatal("listener remains open")
	}
}
