package embeddings

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/hasura"
)

type SynchWorkerHasuraClient interface {
	GetAiAutoEmbeddingsConfigurations(
		ctx context.Context,
		where *hasura.AiAutoEmbeddingsConfigurationBoolExp,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAiAutoEmbeddingsConfigurations, error)
	RawQuery(
		ctx context.Context,
		query string,
		vars map[string]any,
		res any,
	) error
}

type EmbeddingsGenerator interface { //nolint:revive
	EmbeddingsGenerate(
		ctx context.Context,
		input string,
		embeddingsModel string,
	) ([]float64, error)
}

type Process struct {
	period     time.Duration
	hasura     SynchWorkerHasuraClient
	embeddings EmbeddingsGenerator
	logger     *slog.Logger
	inProgress map[string]struct{}
}

func New(
	period time.Duration,
	hasura SynchWorkerHasuraClient,
	embeddings EmbeddingsGenerator,
	logger *slog.Logger,
) *Process {
	return &Process{
		period:     period,
		hasura:     hasura,
		embeddings: embeddings,
		logger:     logger,
		inProgress: make(map[string]struct{}),
	}
}

func (p *Process) getJobsToRun(
	ctx context.Context, now time.Time,
) (*hasura.GetAiAutoEmbeddingsConfigurations, error) {
	configs, err := p.hasura.GetAiAutoEmbeddingsConfigurations(
		ctx,
		//nolint:exhaustruct
		&hasura.AiAutoEmbeddingsConfigurationBoolExp{
			Mutation: &hasura.StringComparisonExp{
				IsNull: new(false),
			},
			Query: &hasura.StringComparisonExp{
				IsNull: new(false),
			},
			Or: []*hasura.AiAutoEmbeddingsConfigurationBoolExp{
				{
					LastRun: &hasura.TimestamptzComparisonExp{
						Lt: new(now),
					},
				},
				{
					LastRun: &hasura.TimestamptzComparisonExp{
						IsNull: new(true),
					},
				},
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error querying ai auto embeddings configurations: %w", err)
	}

	return configs, nil
}

func (p *Process) Run(ctx context.Context) {
	ticker := time.NewTicker(p.period)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			p.logger.InfoContext(ctx, "context done, exiting")
			return
		case <-ticker.C:
			p.logger.InfoContext(ctx, "running auto embeddings process")

			now := time.Now()

			configs, err := p.getJobsToRun(ctx, now)
			if err != nil {
				p.logger.ErrorContext(
					ctx, "error getting ai jobs to run", slog.String("error", err.Error()),
				)
			}

			for _, config := range configs.GetAiAutoEmbeddingsConfigurations() {
				logger := p.logger.With(
					slog.String("job", config.Name),
					slog.String("id", config.ID),
				)

				if _, ok := p.inProgress[config.ID]; ok {
					logger.InfoContext(ctx, "job already in progress, skipping")
					continue
				}

				logger.InfoContext(ctx, "running job")

				p.inProgress[config.ID] = struct{}{}

				p.run(ctx, config, logger.WithGroup("data"))

				delete(p.inProgress, config.ID)
			}
		}
	}
}

func (p *Process) run(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) {
	vars := map[string]any{}

	var resp struct {
		Data map[string][]map[string]any `json:"data"`
	}
	if err := p.hasura.RawQuery(ctx, *config.GetQuery(), vars, &resp); err != nil {
		logger.ErrorContext(ctx, "error running query", slog.String("error", err.Error()))
		return
	}

	for _, v := range resp.Data {
		for _, vv := range v {
			id, ok := vv["id"]
			if !ok {
				logger.ErrorContext(ctx, "id not found in query response")
				return
			}

			logger.InfoContext(ctx, "updating embeddings", slog.Any("id", id))

			if err := p.hasura.RawQuery(ctx, *config.GetQuery(), vars, &resp); err != nil {
				logger.ErrorContext(
					ctx, "error running mutation", slog.String("error", err.Error()),
				)

				return
			}

			embeddings, err := p.genEmbeddings(ctx, vv, config.Model)
			if err != nil {
				logger.ErrorContext(
					ctx, "error generating embeddings", slog.String("error", err.Error()),
				)

				continue
			}

			vars := map[string]any{
				"id":         id,
				"embeddings": embeddings,
			}

			var r any
			if err := p.hasura.RawQuery(ctx, *config.GetMutation(), vars, &r); err != nil {
				logger.ErrorContext(
					ctx, "error running mutation", slog.String("error", err.Error()),
				)

				continue
			}
		}
	}
}

func (p *Process) genEmbeddings(
	ctx context.Context,
	v any,
	model string,
) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("error marshaling json: %w", err)
	}

	embeddings, err := p.embeddings.EmbeddingsGenerate(ctx, string(b), model)
	if err != nil {
		return "", fmt.Errorf("error generating embeddings: %w", err)
	}

	b, err = json.Marshal(embeddings)
	if err != nil {
		return "", fmt.Errorf("error marshaling json: %w", err)
	}

	return string(b), nil
}
