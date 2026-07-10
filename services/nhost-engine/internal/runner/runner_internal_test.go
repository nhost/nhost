package runner

import (
	"context"
	"errors"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

var errBoom = errors.New("boom")

func services(names ...string) func(string) bool {
	set := make(map[string]struct{}, len(names))
	for _, n := range names {
		set[n] = struct{}{}
	}

	return func(tok string) bool {
		_, ok := set[tok]

		return ok
	}
}

func TestSplit(t *testing.T) {
	t.Parallel()

	isService := services("auth", "storage", "graphql")

	tests := []struct {
		name       string
		args       []string
		wantShared []string
		wantInvs   []Invocation
	}{
		{
			name:       "single service, no shared",
			args:       []string{"auth", "--smtp-host", "mail"},
			wantShared: nil,
			wantInvs:   []Invocation{{Name: "auth", Args: []string{"--smtp-host", "mail"}}},
		},
		{
			name:       "shared then service without separator",
			args:       []string{"--debug", "auth", "--port", "4000"},
			wantShared: []string{"--debug"},
			wantInvs:   []Invocation{{Name: "auth", Args: []string{"--port", "4000"}}},
		},
		{
			name:       "separator after shared flags",
			args:       []string{"--debug", "--", "auth", "--port", "4000"},
			wantShared: []string{"--debug"},
			wantInvs:   []Invocation{{Name: "auth", Args: []string{"--port", "4000"}}},
		},
		{
			name:       "leading separator, empty shared",
			args:       []string{"--", "auth"},
			wantShared: nil,
			wantInvs:   []Invocation{{Name: "auth", Args: nil}},
		},
		{
			name:       "multiple services",
			args:       []string{"auth", "-a", "--", "storage", "-b", "--", "graphql", "-c"},
			wantShared: nil,
			wantInvs: []Invocation{
				{Name: "auth", Args: []string{"-a"}},
				{Name: "storage", Args: []string{"-b"}},
				{Name: "graphql", Args: []string{"-c"}},
			},
		},
		{
			name:       "shared with separator then multiple services",
			args:       []string{"--debug", "--", "auth", "--", "storage"},
			wantShared: []string{"--debug"},
			wantInvs: []Invocation{
				{Name: "auth", Args: nil},
				{Name: "storage", Args: nil},
			},
		},
		{
			name:       "help only, no service",
			args:       []string{"--help"},
			wantShared: []string{"--help"},
			wantInvs:   nil,
		},
		{
			name:       "empty args",
			args:       nil,
			wantShared: nil,
			wantInvs:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			shared, invs, err := Split(tt.args, isService)
			if err != nil {
				t.Fatalf("Split(%q) unexpected error: %v", tt.args, err)
			}

			if !equalArgs(shared, tt.wantShared) {
				t.Errorf("shared = %#v; want %#v", shared, tt.wantShared)
			}

			if !reflect.DeepEqual(invs, tt.wantInvs) {
				t.Errorf("invocations = %#v; want %#v", invs, tt.wantInvs)
			}
		})
	}
}

func TestSplitErrors(t *testing.T) {
	t.Parallel()

	isService := services("auth", "storage")

	tests := []struct {
		name    string
		args    []string
		wantErr error
	}{
		{"unknown service after separator", []string{"auth", "--", "nope"}, ErrUnknownService},
		{"empty segment from trailing separator", []string{"auth", "--"}, ErrEmptySegment},
		{
			"empty segment from adjacent separators",
			[]string{"auth", "--", "--", "storage"},
			ErrEmptySegment,
		},
		{"duplicate service", []string{"auth", "--", "auth"}, ErrDuplicateService},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, _, err := Split(tt.args, isService)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("Split(%q) err = %v; want %v", tt.args, err, tt.wantErr)
			}
		})
	}
}

func TestSuperviseCancelsPeersOnError(t *testing.T) {
	t.Parallel()

	wantErr := errBoom

	var peerCancelled atomic.Bool

	failing := func(_ context.Context) error {
		return wantErr
	}

	peer := func(ctx context.Context) error {
		<-ctx.Done()
		peerCancelled.Store(true)

		return nil
	}

	err := Supervise(context.Background(), []Service{failing, peer})
	if !errors.Is(err, wantErr) {
		t.Errorf("Supervise err = %v; want %v", err, wantErr)
	}

	if !peerCancelled.Load() {
		t.Error("peer service was not cancelled when its sibling failed")
	}
}

func TestSuperviseShutsDownOnContextCancel(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())

	var started atomic.Int32

	svc := func(ctx context.Context) error { //nolint:unparam // signature must match runner.Service
		started.Add(1)
		<-ctx.Done()

		return nil
	}

	done := make(chan error, 1)
	go func() { done <- Supervise(ctx, []Service{svc, svc}) }()

	// Give both services a moment to start, then trigger shutdown.
	deadline := time.After(2 * time.Second)

	for started.Load() < 2 {
		select {
		case <-deadline:
			t.Fatal("services did not start in time")
		default:
			time.Sleep(time.Millisecond)
		}
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("Supervise err = %v; want nil on clean shutdown", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Supervise did not return after context cancellation")
	}
}

// equalArgs treats nil and empty slices as equal, matching how callers consume
// the shared-flags result.
func equalArgs(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}
