package autoai

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
)

func (ai *AutoAI) addEmbeddingConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) error {
	table := fmt.Sprintf("%s.%s", config.GetSchemaName(), config.GetTableName())

	pkInfo, err := ai.hasuraClient.GetPKInformation(ctx, table)
	if err != nil {
		return fmt.Errorf("failed to get primary key information: %w", err)
	}

	if len(pkInfo) != 1 {
		return fmt.Errorf("expected 1 primary key, got %d", len(pkInfo)) //nolint:err113
	}

	if err := ai.DeploySimilarFunctionality(ctx, config, pkInfo, logger); err != nil {
		return fmt.Errorf("failed to deploy similar functionality: %w", err)
	}

	if err := ai.DeploySearchFunctionality(ctx, config, pkInfo, logger); err != nil {
		return fmt.Errorf("failed to deploy search functionality: %w", err)
	}

	return nil
}

func (ai *AutoAI) removeEmbeddingConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) error {
	if err := ai.RemoveSimilarFunctionality(ctx, config, logger); err != nil {
		return fmt.Errorf("failed to deploy similar functionality: %w", err)
	}

	if err := ai.RemoveSearchFunctionality(ctx, config, logger); err != nil {
		return fmt.Errorf("failed to deploy search functionality: %w", err)
	}

	return nil
}

func (ai *AutoAI) SynchAutoEmbeddingsConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	remove bool,
	logger *slog.Logger,
) error {
	logger = logger.With(
		slog.String("name", config.GetName()),
		slog.String("id", config.GetID()),
		slog.Bool("remove", remove),
	)
	logger.InfoContext(ctx, "processing autoAI configuration entry")

	if remove {
		return ai.removeEmbeddingConfiguration(ctx, config, logger)
	}

	return ai.addEmbeddingConfiguration(ctx, config, logger)
}

func (ai *AutoAI) Start(ctx context.Context, logger *slog.Logger) error {
	logger = logger.With("component", "autoai.start")
	logger.InfoContext(ctx, "starting AutoAI")

	logger.InfoContext(ctx, "getting ai_auto_embeddings_configurations")

	configs, err := ai.hasuraClient.GetAiAutoEmbeddingsConfigurations(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to get ai_auto_embeddings_configurations: %w", err)
	}

	logger.InfoContext(ctx, "synching configurations")

	for _, config := range configs.AiAutoEmbeddingsConfigurations {
		if err := ai.SynchAutoEmbeddingsConfiguration(ctx, config, false, logger); err != nil {
			return fmt.Errorf("failed to synch config: %w", err)
		}
	}

	return nil
}
