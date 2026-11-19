package embedder

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
)

type stubTransport struct {
	response *http.Response
	err      error
}

func (s stubTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return s.response, s.err
}

type brokenBody struct{}

func (brokenBody) Read([]byte) (int, error) { return 0, http.ErrBodyReadAfterClose }
func (brokenBody) Close() error             { return nil }

func TestExecuteFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		transport stubTransport
		class     ErrorClass
		cancel    bool
	}{
		{"transport", stubTransport{err: http.ErrServerClosed}, Transient, false},
		{
			"deadline with live context",
			stubTransport{err: context.DeadlineExceeded},
			Transient,
			false,
		},
		{"cancellation with live context", stubTransport{err: context.Canceled}, Transient, false},
		{"caller canceled", stubTransport{err: context.Canceled}, Canceled, true},
		{
			"unreadable body",
			stubTransport{response: &http.Response{StatusCode: http.StatusOK, Body: brokenBody{}}},
			Transient,
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a := &adapter{client: &http.Client{Transport: tt.transport}}

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			if tt.cancel {
				cancel()
			}

			request, err := http.NewRequestWithContext(
				ctx,
				http.MethodPost,
				"http://localhost",
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			_, err = a.execute(ctx, request)

			var status *StatusError
			if !errors.As(err, &status) {
				t.Fatalf("unclassified: %v", err)
			}

			if diff := cmp.Diff(tt.class, status.Class); diff != "" {
				t.Fatal(diff)
			}
		})
	}
}
