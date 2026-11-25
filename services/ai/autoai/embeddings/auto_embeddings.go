// Package embeddings runs provider-agnostic embedding synchronization jobs.
package embeddings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
)

// Validator checks a configuration against the database and the provider
// registry before the worker runs it. Errors with an InspectionFailure method mean the catalog could not be read
// (see inspectionFailure); every other error is a verdict that the worker records
// in last_error.
//
//go:generate mockgen -package mock -destination mock/validator.go . Validator
type Validator interface {
	ValidateConfiguration(
		ctx context.Context,
		config *hasura.AiAutoEmbeddingsConfigurationFragment,
	) error
}

// SynchWorkerHasuraClient provides configuration, query, and status access.
//
//go:generate mockgen -package mock -destination mock/hasura.go . SynchWorkerHasuraClient
type SynchWorkerHasuraClient interface {
	GetAiAutoEmbeddingsConfigurations(
		ctx context.Context,
		where *hasura.AiAutoEmbeddingsConfigurationBoolExp,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAiAutoEmbeddingsConfigurations, error)
	GetAiAutoEmbeddingsConfiguration(
		ctx context.Context,
		id string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAiAutoEmbeddingsConfiguration, error)
	SetAiAutoEmbeddingsConfigurationLastError(
		ctx context.Context,
		id string,
		message *string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error)
	SetAiAutoEmbeddingsConfigurationRunStatus(
		ctx context.Context,
		id string,
		started time.Time,
		message *string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.SetAiAutoEmbeddingsConfigurationRunStatus, error)
	RawQuery(ctx context.Context, query string, vars map[string]any, response any) error
}

const (
	retryAttempts     = 3
	retryWait         = 40 * time.Second
	retryDelay        = 5 * time.Second
	jobTimeout        = 2 * time.Minute
	callTimeout       = 10 * time.Second
	statusTimeout     = 5 * time.Second
	deployErrorPrefix = "deploy: "
)

// Process synchronizes configurations sequentially, once per period.
type Process struct {
	period     time.Duration
	hasura     SynchWorkerHasuraClient
	embeddings embedder.Registry
	logger     *slog.Logger
	now        func() time.Time
	validator  Validator
	retry      embedder.RetryPolicy
	callBudget time.Duration
}

// New constructs a worker.
func New(
	period time.Duration,
	h SynchWorkerHasuraClient,
	registry embedder.Registry,
	validator Validator,
	logger *slog.Logger,
) *Process {
	return &Process{
		period:     period,
		hasura:     h,
		embeddings: registry,
		logger:     logger,
		now:        time.Now,
		validator:  validator,
		callBudget: callTimeout,
		retry: embedder.RetryPolicy{
			MaxAttempts:  retryAttempts,
			MaxWait:      retryWait,
			InitialDelay: time.Second,
			MaxDelay:     retryDelay,
			Clock:        nil,
			Jitter:       nil,
		},
	}
}

func (p *Process) getJobsToRun(
	ctx context.Context,
) (*hasura.GetAiAutoEmbeddingsConfigurations, error) {
	//nolint:exhaustruct // GraphQL filters intentionally omit unrelated columns.
	filter := &hasura.AiAutoEmbeddingsConfigurationBoolExp{
		Mutation: &hasura.StringComparisonExp{IsNull: new(false)},
		Query:    &hasura.StringComparisonExp{IsNull: new(false)},
	}

	configs, err := p.hasura.GetAiAutoEmbeddingsConfigurations(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("fetch embedding jobs: %w", err)
	}

	return configs, nil
}

// Run polls until cancellation; a failed fetch never falls through to processing.
func (p *Process) Run(ctx context.Context) {
	ticker := time.NewTicker(p.period)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			configs, err := p.getJobsToRun(ctx)
			if err != nil {
				p.logger.ErrorContext(ctx, "could not fetch embedding jobs")
				continue
			}

			for _, config := range configs.AiAutoEmbeddingsConfigurations {
				p.run(ctx, config, p.logger.With("configuration_id", config.ID))
			}
		}
	}
}

// run processes one configuration. The tick's listing only supplies the id: the
// row is reloaded so earlier jobs in a long tick cannot leave it stale.
func (p *Process) run(
	ctx context.Context,
	listed *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) {
	ctx, cancel := context.WithTimeout(ctx, jobTimeout)
	defer cancel()

	loaded, err := p.hasura.GetAiAutoEmbeddingsConfiguration(ctx, listed.ID)
	if err != nil {
		logger.ErrorContext(ctx, "could not reload embedding configuration")
		return
	}

	config := loaded.AiAutoEmbeddingsConfiguration
	if config == nil || config.Query == nil || config.Mutation == nil {
		return
	}

	if !p.prepare(ctx, config, logger) {
		return
	}

	started := p.now()
	summary := p.execute(ctx, config, p.embeddings[config.Provider])

	statusCtx, statusCancel := context.WithTimeout(context.WithoutCancel(ctx), statusTimeout)
	defer statusCancel()

	if _, err := p.hasura.SetAiAutoEmbeddingsConfigurationRunStatus(
		statusCtx,
		config.ID,
		started,
		p.runStatus(statusCtx, config.ID, summary),
	); err != nil {
		logger.ErrorContext(ctx, "could not write embedding run status")
	}
}

func (p *Process) validationStatus(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	message string,
	logger *slog.Logger,
) {
	if config.LastError != nil && *config.LastError == message {
		return
	}

	statusCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), statusTimeout)
	defer cancel()

	if _, err := p.hasura.SetAiAutoEmbeddingsConfigurationLastError(
		statusCtx,
		config.ID,
		&message,
	); err != nil {
		logger.ErrorContext(ctx, "could not write embedding validation status")
	}
}

type (
	jobRow struct {
		id   any
		text string
	}
	runResult struct {
		total, failed, processed int
		first                    string
	}
)

func (r *runResult) fail(message string) {
	r.failed++

	r.processed++
	if r.first == "" {
		r.first = message
	}
}

func (r *runResult) summary() *string {
	if r.failed == 0 && r.processed == r.total {
		return nil
	}

	text := fmt.Sprintf(
		"%d failed, %d not processed of %d rows; first: %s",
		r.failed,
		r.total-r.processed,
		r.total,
		r.first,
	)

	return &text
}

func (p *Process) execute(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	provider embedder.Embedder,
) *string {
	var response struct {
		Data map[string][]map[string]any `json:"data"`
	}
	if err := p.hasura.RawQuery(ctx, *config.Query, map[string]any{}, &response); err != nil {
		text := "query failed"
		return &text
	}

	rows, result := prepareRows(response.Data)

	inputs := make([]string, len(rows))
	for i, row := range rows {
		inputs[i] = row.text
	}

	req := embedder.Request{
		Model:      config.Model,
		Inputs:     inputs,
		Dimensions: int(config.Dimensions),
		Kind:       embedder.Document,
	}

	offset := 0
	for _, batch := range embedder.Split(req, provider.BatchLimits()) {
		vectors, err := p.embed(ctx, provider, batch)
		if err != nil {
			if errorClass(err) != embedder.Input {
				result.first = firstMessage(result.first, errorMessage(err))
				break
			}

			if p.fallback(ctx, config, provider, batch, rows[offset:], &result) {
				break
			}
		} else {
			for i, vector := range vectors {
				p.mutate(ctx, config, rows[offset+i], vector, &result)
			}
		}

		offset += len(batch.Inputs)
	}

	return result.summary()
}

func firstMessage(first, next string) string {
	if first != "" {
		return first
	}

	return next
}

func errorClass(err error) embedder.ErrorClass {
	if status, ok := errors.AsType[*embedder.StatusError](err); ok {
		return status.Class
	}

	return embedder.Transient
}

func errorMessage(err error) string {
	switch errorClass(err) {
	case embedder.Configuration:
		return "embedding provider configuration failed"
	case embedder.Input:
		return "embedding input rejected"
	case embedder.Canceled:
		return "embedding job canceled"
	case embedder.Transient:
		return "embedding provider unavailable"
	default:
		return "embedding failed"
	}
}

func (p *Process) embed(
	ctx context.Context,
	provider embedder.Embedder,
	req embedder.Request,
) ([][]float32, error) {
	var vectors [][]float32

	err := embedder.WithRetry(ctx, p.retry, func() error {
		call, cancel := context.WithTimeout(ctx, p.callBudget)
		defer cancel()

		var err error

		vectors, err = provider.Embed(call, req)
		if ctx.Err() == nil && call.Err() != nil {
			return &embedder.StatusError{
				Class: embedder.Transient, StatusCode: 0, RetryAfter: "",
				Message: "embedding call timed out",
			}
		}

		if err != nil {
			return fmt.Errorf("embed batch: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("embedding batch: %w", err)
	}

	return vectors, nil
}

func (p *Process) mutate(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	row jobRow,
	vector []float32,
	result *runResult,
) {
	encoded, err := json.Marshal(vector)
	if err != nil {
		result.fail("could not encode embedding")
		return
	}

	var response any
	if err := p.hasura.RawQuery(
		ctx,
		*config.Mutation,
		map[string]any{"id": row.id, "embeddings": string(encoded)},
		&response,
	); err != nil {
		result.fail("mutation failed")
		return
	}

	result.processed++
}

// prepare validates the configuration. The validator already rejects undeclared
// providers, so the registry check only guards the lookup in run.
func (p *Process) prepare(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) bool {
	if err := p.validator.ValidateConfiguration(ctx, config); err != nil {
		if isInspectionFailure(err) {
			logger.WarnContext(ctx, "could not inspect embedding target; retrying next tick")
			return false
		}

		p.validationStatus(ctx, config, err.Error(), logger)

		return false
	}

	_, ok := p.embeddings[config.Provider]

	return ok
}

func prepareRows(data map[string][]map[string]any) ([]jobRow, runResult) {
	result := runResult{total: 0, failed: 0, processed: 0, first: ""}
	rows := []jobRow{}

	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	for _, key := range keys {
		for _, row := range data[key] {
			result.total++

			id, ok := row["id"]
			if !ok || id == nil {
				result.fail("row has no id")
				continue
			}

			text, err := json.Marshal(row)
			if err != nil {
				result.fail("could not encode row")
				continue
			}

			rows = append(rows, jobRow{id: id, text: string(text)})
		}
	}

	return rows, result
}

func (p *Process) fallback(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	provider embedder.Embedder,
	batch embedder.Request,
	rows []jobRow,
	result *runResult,
) bool {
	for i, input := range batch.Inputs {
		single := batch
		single.Inputs = []string{input}

		vectors, err := p.embed(ctx, provider, single)
		if err != nil {
			if errorClass(err) != embedder.Input {
				result.first = firstMessage(result.first, errorMessage(err))
				return true
			}

			// Input errors are row-specific: skip the row and keep going, so bad rows
			// never block the rows after them (as the original Graphite worker did).
			result.fail(errorMessage(err))

			continue
		}

		p.mutate(ctx, config, rows[i], vectors[0], result)
	}

	return false
}

func hasDeployError(lastError *string) bool {
	return lastError != nil && strings.HasPrefix(*lastError, deployErrorPrefix)
}

// runStatus never replaces a deploy: error, including one the webhook wrote
// while the job ran: only a successful deploy (a configuration edit or a
// restart) clears it, so the user keeps seeing why search may not work.
// A deploy write between this reload and the status write can still be lost.
func (p *Process) runStatus(ctx context.Context, id string, summary *string) *string {
	loaded, err := p.hasura.GetAiAutoEmbeddingsConfiguration(ctx, id)
	if err == nil && loaded.AiAutoEmbeddingsConfiguration != nil &&
		hasDeployError(loaded.AiAutoEmbeddingsConfiguration.LastError) {
		return loaded.AiAutoEmbeddingsConfiguration.LastError
	}

	return summary
}

// inspectionFailure is implemented by Validator errors that report a failed
// catalog read rather than a validation verdict. The worker retries those on its
// next tick instead of recording a deploy: status for a configuration that may
// be healthy.
type inspectionFailure interface{ InspectionFailure() }

func isInspectionFailure(err error) bool {
	var marker inspectionFailure
	return errors.As(err, &marker)
}
