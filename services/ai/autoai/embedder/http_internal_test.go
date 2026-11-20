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
	}{
		{"transport", stubTransport{err: http.ErrServerClosed}, Transient},
		{"deadline", stubTransport{err: context.DeadlineExceeded}, Canceled},
		{
			"unreadable body",
			stubTransport{response: &http.Response{StatusCode: http.StatusOK, Body: brokenBody{}}},
			Transient,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a := &adapter{client: &http.Client{Transport: tt.transport}}

			request, err := http.NewRequestWithContext(
				t.Context(),
				http.MethodPost,
				"http://localhost",
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			_, err = a.execute(t.Context(), request)

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
