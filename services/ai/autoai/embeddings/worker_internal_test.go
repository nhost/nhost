package embeddings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
)

type batchProvider struct {
	embedder.Embedder

	limits embedder.Limits
	calls  int
	call   func(context.Context, embedder.Request) ([][]float32, error)
}

func (e *batchProvider) BatchLimits() embedder.Limits { return e.limits }
func (e *batchProvider) Embed(ctx context.Context, r embedder.Request) ([][]float32, error) {
	e.calls++
	return e.call(ctx, r)
}

type workerClient struct {
	SynchWorkerHasuraClient

	rows               []map[string]any
	queries, mutations int
	mutationError      bool
	queryError         bool
}

func (h *workerClient) RawQuery(
	_ context.Context,
	query string,
	vars map[string]any,
	response any,
) error {
	if query == "query" {
		h.queries++
		if h.queryError {
			return errTestSecretQueryFailure
		}

		data, err := json.Marshal(map[string]any{"data": map[string]any{"rows": h.rows}})
		if err != nil {
			return fmt.Errorf("marshal test rows: %w", err)
		}

		if err := json.Unmarshal(data, response); err != nil {
			return fmt.Errorf("decode test rows: %w", err)
		}

		return nil
	}

	h.mutations++
	if h.mutationError && vars["id"] == float64(2) {
		return errTestSecretMutationFailure
	}

	return nil
}

func workerConfig() *hasura.AiAutoEmbeddingsConfigurationFragment {
	return &hasura.AiAutoEmbeddingsConfigurationFragment{
		ID:         "id",
		Provider:   "provider",
		Model:      "model",
		Dimensions: 2,
		Query:      new("query"),
		Mutation:   new("mutation"),
	}
}

func validVectors(r embedder.Request) [][]float32 {
	v := make([][]float32, len(r.Inputs))
	for i := range v {
		v[i] = []float32{1, 0}
	}

	return v
}

func statusError(class embedder.ErrorClass) error {
	return &embedder.StatusError{
		Class:      class,
		Message:    "untrusted secret",
		StatusCode: 400,
		RetryAfter: "",
	}
}

// failing returns a provider that rejects any request containing a listed row id:
// with batchClass when the request has several inputs, singleClass when it has one.
func failing(bad []int, batchClass, singleClass embedder.ErrorClass) func(
	context.Context, embedder.Request,
) ([][]float32, error) {
	return func(_ context.Context, r embedder.Request) ([][]float32, error) {
		for _, id := range bad {
			for _, text := range r.Inputs {
				if strings.Contains(text, fmt.Sprintf(`"id":%d`, id)) {
					if len(r.Inputs) > 1 {
						return nil, statusError(batchClass)
					}

					return nil, statusError(singleClass)
				}
			}
		}

		return validVectors(r), nil
	}
}

func TestExecute(t *testing.T) {
	t.Parallel()

	ok := func(_ context.Context, r embedder.Request) ([][]float32, error) { return validVectors(r), nil }

	// Six rows (ids 1-6) in batches of two unless the case sets rows.
	tests := []struct {
		name          string
		rows          []map[string]any
		queryError    bool
		mutationError bool
		call          func(context.Context, embedder.Request) ([][]float32, error)
		wantWrites    int
		wantSummary   string // empty means success (nil summary)
	}{
		{name: "all succeed", call: ok, wantWrites: 6},
		{name: "empty result", rows: []map[string]any{}, call: ok},
		{name: "query error", queryError: true, call: ok, wantSummary: "query failed"},
		{
			name:        "row without id",
			rows:        []map[string]any{{"text": "no id"}, {"id": 2}},
			call:        ok,
			wantWrites:  1,
			wantSummary: "1 failed, 0 not processed",
		},
		{
			name: "bad rows are skipped and do not block later rows",
			// Batches [1,2] [3,4] [5,6]: the second batch is retried row by row and row 4 still embeds.
			call:        failing([]int{1, 2, 3}, embedder.Input, embedder.Input),
			wantWrites:  3,
			wantSummary: "3 failed, 0 not processed",
		},
		{
			name:        "configuration error stops the run",
			call:        failing([]int{3}, embedder.Configuration, embedder.Configuration),
			wantWrites:  2,
			wantSummary: "0 failed, 4 not processed",
		},
		{
			name:        "transient error during row-by-row retry stops the run",
			call:        failing([]int{3}, embedder.Input, embedder.Transient),
			wantWrites:  2,
			wantSummary: "0 failed, 4 not processed",
		},
		{
			name:          "failed mutation is counted and the run continues",
			mutationError: true,
			call:          ok,
			wantWrites:    6,
			wantSummary:   "1 failed, 0 not processed",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h := &workerClient{
				SynchWorkerHasuraClient: nil,
				rows:                    tt.rows,
				queries:                 0,
				mutations:               0,
				mutationError:           tt.mutationError,
				queryError:              tt.queryError,
			}
			if tt.rows == nil {
				for i := 1; i <= 6; i++ {
					h.rows = append(h.rows, map[string]any{"id": i})
				}
			}

			e := &batchProvider{
				Embedder: nil,
				limits:   embedder.Limits{MaxInputs: 2, MaxBytes: 0},
				calls:    0,
				call:     tt.call,
			}
			p := New(time.Minute, h, nil, nil, slog.New(slog.DiscardHandler))
			p.retry = embedder.RetryPolicy{}

			summary := p.execute(t.Context(), workerConfig(), e)
			if h.queries != 1 || h.mutations != tt.wantWrites {
				t.Fatalf(
					"queries/mutations = %d/%d, want 1/%d",
					h.queries,
					h.mutations,
					tt.wantWrites,
				)
			}

			switch {
			case tt.wantSummary == "" && summary != nil:
				t.Fatalf("unexpected summary %q", *summary)
			case tt.wantSummary != "" && (summary == nil || !strings.Contains(*summary, tt.wantSummary)):
				t.Fatalf("summary = %v, want %q", summary, tt.wantSummary)
			case summary != nil && strings.Contains(*summary, "secret"):
				t.Fatal("summary leaked provider text")
			}
		})
	}
}

type retryClock struct {
	now    time.Time
	waited time.Duration
}

func (c *retryClock) Now() time.Time { return c.now }
func (c *retryClock) Sleep(_ context.Context, d time.Duration) error {
	c.waited += d
	c.now = c.now.Add(d)

	return nil
}

func TestEmbedRetries(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		callBudget time.Duration
		call       func(context.Context, embedder.Request) ([][]float32, error)
	}{
		{
			name: "unclassified error is retried as transient",
			call: func(context.Context, embedder.Request) ([][]float32, error) {
				return nil, errTestSecretTransport
			},
		},
		{
			name:       "per-call timeout is retried as transient",
			callBudget: time.Millisecond,
			call: func(ctx context.Context, _ embedder.Request) ([][]float32, error) {
				<-ctx.Done()
				return nil, ctx.Err()
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			p := New(time.Minute, nil, nil, nil, slog.New(slog.DiscardHandler))
			p.retry.Clock = &retryClock{now: time.Now(), waited: 0}
			p.retry.Jitter = func(time.Duration) time.Duration { return 0 }

			if tt.callBudget > 0 {
				p.callBudget = tt.callBudget
			}

			e := &batchProvider{Embedder: nil, limits: embedder.Limits{}, calls: 0, call: tt.call}

			_, err := p.embed(
				t.Context(),
				e,
				embedder.Request{
					Model:      "m",
					Inputs:     []string{"x"},
					Dimensions: 2,
					Kind:       embedder.Document,
				},
			)
			if errorClass(err) != embedder.Transient || e.calls != retryAttempts ||
				strings.Contains(err.Error(), "secret") {
				t.Fatalf("err = %v after %d calls", err, e.calls)
			}
		})
	}

	// Every attempt at its full call budget plus all retry waiting must fit in a job.
	if retryAttempts*callTimeout+retryWait >= jobTimeout {
		t.Fatal("retry policy exceeds the job deadline")
	}
}

var (
	errTestSecretQueryFailure    = errors.New("secret query failure")
	errTestSecretMutationFailure = errors.New("secret mutation failure")
	errTestSecretTransport       = errors.New("secret transport")
)
