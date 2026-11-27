package embeddings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
)

type lifecycleClient struct {
	*workerClient

	config                *hasura.AiAutoEmbeddingsConfigurationFragment
	statuses, validations int
	status                *string
	started               time.Time
	statusError           bool
	onStatus              func(context.Context)
}

func (c *lifecycleClient) GetAiAutoEmbeddingsConfiguration(
	context.Context,
	string,
	...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
	return &hasura.GetAiAutoEmbeddingsConfiguration{AiAutoEmbeddingsConfiguration: c.config}, nil
}

func (c *lifecycleClient) SetAiAutoEmbeddingsConfigurationLastError(
	_ context.Context,
	_ string,
	message *string,
	_ ...clientv2.RequestInterceptor,
) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error) {
	c.validations++
	c.status = message
	c.config.LastError = message

	return &hasura.SetAiAutoEmbeddingsConfigurationLastError{
		UpdateAiAutoEmbeddingsConfiguration: nil,
	}, nil
}

func (c *lifecycleClient) SetAiAutoEmbeddingsConfigurationRunStatus(
	ctx context.Context,
	_ string,
	started time.Time,
	message *string,
	_ ...clientv2.RequestInterceptor,
) (*hasura.SetAiAutoEmbeddingsConfigurationRunStatus, error) {
	c.statuses++
	c.status = message
	c.config.LastError = message

	c.started = started
	if c.onStatus != nil {
		c.onStatus(ctx)
	}

	if c.statusError {
		return nil, errTestSecretStatusFailure
	}

	return &hasura.SetAiAutoEmbeddingsConfigurationRunStatus{
		UpdateAiAutoEmbeddingsConfiguration: nil,
	}, nil
}

// newLifecycleClient returns a client whose configuration query yields one row.
func newLifecycleClient() *lifecycleClient {
	return &lifecycleClient{
		workerClient: &workerClient{
			SynchWorkerHasuraClient: nil,
			rows:                    []map[string]any{{"id": 1}},
			queries:                 0,
			mutations:               0,
			mutationError:           false,
			queryError:              false,
		},
		config:      workerConfig(),
		statuses:    0,
		validations: 0,
		status:      nil,
		started:     time.Time{},
		statusError: false,
		onStatus:    nil,
	}
}

type workerValidator struct{ err error }

func (v workerValidator) ValidateConfiguration(
	context.Context,
	*hasura.AiAutoEmbeddingsConfigurationFragment,
) error {
	return v.err
}

const trackedError = "deploy: target table must be tracked in Hasura"

type lifecycleCase struct {
	name                                       string
	change                                     func(*lifecycleClient, *workerValidator)
	wantQueries, wantStatuses, wantValidations int
	wantStatus                                 *string
}

func TestJobLifecycle(t *testing.T) {
	t.Parallel()

	tests := []lifecycleCase{
		{name: "success", wantQueries: 1, wantStatuses: 1},
		{
			name:   "null query",
			change: func(c *lifecycleClient, _ *workerValidator) { c.config.Query = nil },
		},
		{
			name:            "validation failure is recorded",
			change:          func(_ *lifecycleClient, v *workerValidator) { v.err = errTestDeployInvalidTarget },
			wantValidations: 1,
			wantStatus:      new(errTestDeployInvalidTarget.Error()),
		},
		{
			name: "unchanged validation failure is not rewritten",
			change: func(c *lifecycleClient, v *workerValidator) {
				c.config.LastError = new(errTestDeployInvalidTarget.Error())
				v.err = errTestDeployInvalidTarget
			},
		},
		{
			name:   "catalog read failure retries next tick",
			change: func(_ *lifecycleClient, v *workerValidator) { v.err = testInspectionError{} },
		},
		{
			// The validator rejects undeclared providers; the worker only guards the lookup.
			name:   "undeclared provider is skipped",
			change: func(c *lifecycleClient, _ *workerValidator) { c.config.Provider = "absent" },
		},
		{
			name:         "a successful run keeps a deploy error",
			change:       func(c *lifecycleClient, _ *workerValidator) { c.config.LastError = new(trackedError) },
			wantQueries:  1,
			wantStatuses: 1,
			wantStatus:   new(trackedError),
		},
		{
			name:         "status failure",
			change:       func(c *lifecycleClient, _ *workerValidator) { c.statusError = true },
			wantQueries:  1,
			wantStatuses: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runLifecycleCase(t, tt, nil)
		})
	}
}

// runLifecycleCase runs one job; duringJob, when set, runs while rows are embedded.
func runLifecycleCase(
	t *testing.T,
	tt lifecycleCase,
	duringJob func(*lifecycleClient),
) *lifecycleClient {
	t.Helper()

	now := time.Now()
	c := newLifecycleClient()

	v := &workerValidator{err: nil}
	if tt.change != nil {
		tt.change(c, v)
	}

	var logs bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&logs, nil))
	p := New(
		time.Minute,
		c,
		embedder.Registry{
			"provider": &batchProvider{
				Embedder: nil,
				limits:   embedder.Limits{MaxInputs: 2, MaxBytes: 0},
				calls:    0,
				call: func(_ context.Context, r embedder.Request) ([][]float32, error) {
					if duringJob != nil {
						duringJob(c)
					}

					return validVectors(r), nil
				},
			},
		},
		v,
		logger,
	)
	p.now = func() time.Time { return now }
	c.onStatus = func(ctx context.Context) {
		if ctx.Err() != nil {
			t.Error("status write is not detached from the job context")
		}
	}

	p.run(t.Context(), c.config, logger)

	if c.queries != tt.wantQueries || c.statuses != tt.wantStatuses ||
		c.validations != tt.wantValidations {
		t.Fatalf(
			"queries/status/validation = %d/%d/%d",
			c.queries,
			c.statuses,
			c.validations,
		)
	}

	if tt.wantStatus != nil && (c.status == nil || *c.status != *tt.wantStatus) {
		t.Fatalf("status = %v, want %q", c.status, *tt.wantStatus)
	}

	if c.statuses > 0 && !c.started.Equal(now) {
		t.Error("last_run is not attempt start")
	}

	if c.statusError {
		if !strings.Contains(logs.String(), "level=ERROR") {
			t.Error("status failure not logged")
		}

		p.run(t.Context(), c.config, logger)

		if c.queries != 2 {
			t.Error("status failure prevented the next job")
		}
	}

	return c
}

func TestConcurrentDeployErrorSurvivesRunStatus(t *testing.T) {
	t.Parallel()

	c := runLifecycleCase(
		t,
		lifecycleCase{
			name:            "concurrent deploy error",
			change:          nil,
			wantQueries:     1,
			wantStatuses:    1,
			wantValidations: 0,
			wantStatus:      nil,
		},
		func(c *lifecycleClient) { c.config.LastError = new(trackedError) },
	)

	if c.status == nil || *c.status != trackedError {
		t.Fatalf("status = %v, want the concurrent deploy error", c.status)
	}
}

func TestCanceledJobPersistsStatus(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	c := newLifecycleClient()
	e := &batchProvider{
		Embedder: nil,
		limits:   embedder.Limits{MaxInputs: 1, MaxBytes: 0},
		calls:    0,
		call:     func(context.Context, embedder.Request) ([][]float32, error) { cancel(); return nil, context.Canceled },
	}
	p := New(
		time.Minute,
		c,
		embedder.Registry{"provider": e},
		workerValidator{err: nil},
		slog.New(slog.DiscardHandler),
	)
	c.onStatus = func(ctx context.Context) {
		if ctx.Err() != nil {
			t.Error("cancellation reached the status write")
		}
	}
	p.run(ctx, c.config, p.logger)

	if c.statuses != 1 || c.status == nil || !strings.Contains(*c.status, "canceled") {
		t.Fatal("canceled job did not persist its status")
	}
}

var (
	errTestSecretStatusFailure = errors.New("secret status failure")
	errTestDeployInvalidTarget = errors.New("deploy: invalid target")
)

type filterClient struct {
	SynchWorkerHasuraClient

	where *hasura.AiAutoEmbeddingsConfigurationBoolExp
}

func (c *filterClient) GetAiAutoEmbeddingsConfigurations(
	_ context.Context,
	where *hasura.AiAutoEmbeddingsConfigurationBoolExp,
	_ ...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfigurations, error) {
	c.where = where
	return &hasura.GetAiAutoEmbeddingsConfigurations{AiAutoEmbeddingsConfigurations: nil}, nil
}

func TestGetJobsToRunFilter(t *testing.T) {
	t.Parallel()

	c := &filterClient{SynchWorkerHasuraClient: nil, where: nil}

	p := New(90*time.Second, c, nil, nil, slog.New(slog.DiscardHandler))
	if _, err := p.getJobsToRun(t.Context()); err != nil {
		t.Fatal(err)
	}

	// Every configuration with a query and a mutation runs each tick.
	encoded, err := json.Marshal(c.where)
	if err != nil {
		t.Fatal(err)
	}

	var got map[string]any
	if err := json.Unmarshal(encoded, &got); err != nil {
		t.Fatal(err)
	}

	want := map[string]any{
		"mutation": map[string]any{"_is_null": false},
		"query":    map[string]any{"_is_null": false},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("job filter (-want +got):\n%s", diff)
	}
}

// testInspectionError mimics autoai's catalog read failure marker.
type testInspectionError struct{}

func (testInspectionError) Error() string      { return "deploy: could not inspect primary key" }
func (testInspectionError) InspectionFailure() {}

func TestRunReloadsConfiguration(t *testing.T) {
	t.Parallel()

	t.Run("uses the stored row, not the listed copy", func(t *testing.T) {
		t.Parallel()

		c := newLifecycleClient()
		c.config.Model = "edited-model"

		var model string

		p := New(
			time.Minute,
			c,
			embedder.Registry{"provider": &batchProvider{
				Embedder: nil,
				limits:   embedder.Limits{MaxInputs: 2, MaxBytes: 0},
				calls:    0,
				call: func(_ context.Context, r embedder.Request) ([][]float32, error) {
					model = r.Model
					return validVectors(r), nil
				},
			}},
			workerValidator{err: nil},
			slog.New(slog.DiscardHandler),
		)

		listed := workerConfig()
		listed.Model = "listed-model"
		p.run(t.Context(), listed, p.logger)

		if model != "edited-model" {
			t.Fatalf("embedded with model %q, want the reloaded edited-model", model)
		}
	})

	t.Run("a deleted row is skipped", func(t *testing.T) {
		t.Parallel()

		c := newLifecycleClient()
		c.config = nil
		p := New(time.Minute, c, nil, workerValidator{err: nil}, slog.New(slog.DiscardHandler))
		p.run(t.Context(), workerConfig(), p.logger)

		if c.queries != 0 || c.statuses != 0 {
			t.Fatal("deleted configuration was processed")
		}
	})
}
