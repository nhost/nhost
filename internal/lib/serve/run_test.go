package serve_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	n, err := b.buf.Write(p)
	if err != nil {
		return n, fmt.Errorf("writing log buffer: %w", err)
	}

	return n, nil
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

func TestRunSkipsNilBackgroundAndReturnsShutdownError(t *testing.T) {
	t.Parallel()

	var started atomic.Bool

	svc := &serveutil.Service{}

	err := serveutil.Run(
		context.Background(),
		slog.New(slog.DiscardHandler),
		serveutil.RunHooks{
			Start: func(_ context.Context) { started.Store(true) },
			ServeHTTP: func(_ context.Context) {
				if !started.Load() {
					t.Error("ServeHTTP ran before Start")
				}
			},
			Shutdown: func(ctx context.Context) error {
				if !errors.Is(ctx.Err(), context.Canceled) {
					t.Errorf("shutdown context error = %v; want context.Canceled", ctx.Err())
				}

				return errShutdown
			},
		},
		svc,
	)

	if !errors.Is(err, errShutdown) {
		t.Errorf("Run err = %v; want %v", err, errShutdown)
	}
}

func TestRunLogsBackgroundFailure(t *testing.T) {
	t.Parallel()

	var buf lockedBuffer

	svc := &serveutil.Service{
		Background: func(_ context.Context) error { return errBackground },
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	err := serveutil.Run(
		ctx,
		slog.New(slog.NewTextHandler(&buf, nil)),
		serveutil.RunHooks{
			Start:     nil,
			ServeHTTP: func(ctx context.Context) { <-ctx.Done() },
			Shutdown:  func(_ context.Context) error { return nil },
		},
		svc,
	)
	if err != nil {
		t.Fatalf("Run err = %v; want nil", err)
	}

	output := buf.String()
	if !strings.Contains(output, "background work failed") ||
		!strings.Contains(output, errBackground.Error()) {
		t.Errorf("background failure log = %q; want message and error", output)
	}
}

func TestRunRequiresServingAndShutdownHooks(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		hooks   serveutil.RunHooks
		wantErr string
	}{
		{
			name: "ServeHTTP",
			hooks: serveutil.RunHooks{
				Start:     nil,
				ServeHTTP: nil,
				Shutdown:  func(context.Context) error { return nil },
			},
			wantErr: "serve: RunHooks.ServeHTTP is required",
		},
		{
			name: "Shutdown",
			hooks: serveutil.RunHooks{
				Start:     nil,
				ServeHTTP: func(context.Context) {},
				Shutdown:  nil,
			},
			wantErr: "serve: RunHooks.Shutdown is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := serveutil.Run(
				context.Background(), slog.New(slog.DiscardHandler), tt.hooks,
			)
			if err == nil || err.Error() != tt.wantErr {
				t.Errorf("Run err = %v; want %q", err, tt.wantErr)
			}
		})
	}
}

func TestRunFansOutBackgroundServices(t *testing.T) {
	t.Parallel()

	type ctxKey struct{}

	ctx, cancel := context.WithTimeout(
		context.WithValue(context.Background(), ctxKey{}, "sentinel"),
		time.Second,
	)
	defer cancel()

	lifecycleStarted := atomic.Bool{}
	started := make(chan struct{}, 2)
	done := make(chan struct{}, 2)

	newService := func() *serveutil.Service {
		return &serveutil.Service{
			Background: func(ctx context.Context) error {
				if !lifecycleStarted.Load() {
					t.Error("Background ran before start")
				}

				if got := ctx.Value(ctxKey{}); got != "sentinel" {
					t.Errorf("Background context value = %v; want %q", got, "sentinel")
				}

				started <- struct{}{}

				<-ctx.Done()

				done <- struct{}{}

				return nil
			},
		}
	}

	err := serveutil.Run(
		ctx,
		slog.New(slog.DiscardHandler),
		serveutil.RunHooks{
			Start: func(_ context.Context) { lifecycleStarted.Store(true) },
			ServeHTTP: func(_ context.Context) {
				<-started
				<-started
			},
			Shutdown: func(_ context.Context) error { return nil },
		},
		newService(),
		newService(),
	)
	if err != nil {
		t.Fatalf("Run err = %v; want nil", err)
	}

	for range 2 {
		select {
		case <-done:
		case <-time.After(time.Second):
			t.Fatal("Background did not receive lifecycle cancellation")
		}
	}
}
