package autoai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/nhost/nhost/services/ai/hasura"
)

func (ai *AutoAI) addEmbeddingConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) error {
	pk, err := ai.validateConfiguration(ctx, config)
	if err != nil {
		return err
	}

	code, err := ai.renderDeployment(config, pk)
	if err != nil {
		return fmt.Errorf("%w: could not render deployment", errDeploymentRequest)
	}
	// Both replacements and ownership comments commit in a single Hasura transaction.
	if _, err := ai.hasuraClient.RunSQL(ctx, code, false); err != nil {
		logger.ErrorContext(
			ctx,
			"failed to deploy functions",
			slog.String("schema", config.SchemaName),
			slog.String("function", config.Name),
			slog.String("error", sanitizedSQLError(err).Error()),
		)

		return fmt.Errorf("deploy functions: %w", sanitizedSQLError(err))
	}

	for _, name := range []string{"ai_similar_" + config.Name, "ai_search_" + config.Name} {
		if err := ai.hasuraClient.TrackFunction(
			ctx,
			config.SchemaName,
			name,
		); err != nil &&
			metadataCode(err) != hasura.ErrorCodeAlreadyTracked {
			var message string
			if metadataCode(err) == "invalid-configuration" && untrackedTableError(err) {
				message = "target table must be tracked in Hasura"
			} else {
				message = "could not track deployed function"
			}

			logger.ErrorContext(
				ctx,
				"failed to track deployed function",
				slog.String("schema", config.SchemaName),
				slog.String("function", name),
				slog.String("error", sanitizedSQLError(err).Error()),
			)

			return fmt.Errorf("%w: %s", errDeploymentRequest, message)
		}
	}

	if err := ai.cleanupFunctions(ctx, config, false, logger); err != nil {
		return fmt.Errorf("clean up previous deployment: %w", err)
	}

	return nil
}

func untrackedTableError(err error) bool {
	// Inspect only for classification; never return Hasura's text.
	var request *hasura.MetadataRequestError
	if errors.As(err, &request) && request.Body != nil {
		return strings.Contains(request.Body.Err, "not tracked") ||
			strings.Contains(request.Body.Err, "untracked")
	}

	return false
}

func (ai *AutoAI) cleanupFunctions(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	remove bool,
	logger *slog.Logger,
) error {
	functions, err := ai.catalog.TaggedFunctions(ctx, config.ID)
	if err != nil {
		return fmt.Errorf("%w: could not inspect function ownership", errDeploymentRequest)
	}

	if remove {
		functions = append(
			functions,
			Function{Schema: config.SchemaName, Name: "ai_similar_" + config.Name},
			Function{Schema: config.SchemaName, Name: "ai_search_" + config.Name},
		)
	}

	seen := map[Function]bool{}
	for _, f := range functions {
		if seen[f] {
			continue
		}

		seen[f] = true
		if !remove && f.Schema == config.SchemaName &&
			(f.Name == "ai_similar_"+config.Name || f.Name == "ai_search_"+config.Name) {
			continue
		}

		if err := ai.removeFunctionality(ctx, f.Name, f.Schema, logger); err != nil {
			return fmt.Errorf("remove previous function: %w", err)
		}
	}

	return nil
}

const deployStatusTimeout = 5 * time.Second

func (ai *AutoAI) writeDeployStatus(
	ctx context.Context,
	id string,
	deployErr error,
	logger *slog.Logger,
) error {
	statusCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), deployStatusTimeout)
	defer cancel()

	var message *string
	if deployErr != nil {
		text := deployErr.Error()
		if !strings.HasPrefix(text, "deploy: ") {
			text = "deploy: " + text
		}

		message = &text
	}

	if _, err := ai.hasuraClient.SetAiAutoEmbeddingsConfigurationLastError(
		statusCtx,
		id,
		message,
	); err != nil {
		logger.ErrorContext(
			ctx,
			"could not write deployment status",
			slog.String("configuration_id", id),
		)

		return fmt.Errorf("%w: could not write deployment status", errDeploymentRequest)
	}

	return nil
}

func (ai *AutoAI) SynchAutoEmbeddingsConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	remove bool,
	logger *slog.Logger,
) error {
	if remove {
		return ai.cleanupFunctions(ctx, config, true, logger)
	}

	err := ai.addEmbeddingConfiguration(ctx, config, logger)

	statusErr := ai.writeDeployStatus(ctx, config.ID, err, logger)
	if err != nil {
		if strings.HasPrefix(err.Error(), "deploy: ") {
			return err
		}

		return fmt.Errorf("deploy: %w", err)
	}

	if statusErr != nil {
		return fmt.Errorf("deploy: %w", statusErr)
	}

	return nil
}

func (ai *AutoAI) Start(ctx context.Context, logger *slog.Logger) error {
	logger = logger.With("component", "autoai.start")

	configs, err := ai.hasuraClient.GetAiAutoEmbeddingsConfigurations(ctx, nil)
	if err != nil {
		logger.ErrorContext(ctx, "could not list auto-embeddings configurations", listingCause(err))

		return fmt.Errorf(
			"%w: could not list auto-embeddings configurations",
			errDeploymentRequest,
		)
	}

	failed := []string{}

	undeclared := map[string]bool{}
	for _, config := range configs.AiAutoEmbeddingsConfigurations {
		if _, ok := ai.providers[config.Provider]; !ok {
			undeclared[config.Provider] = true
		}

		if err := ai.SynchAutoEmbeddingsConfiguration(ctx, config, false, logger); err != nil {
			failed = append(failed, config.ID)
			logger.ErrorContext(
				ctx,
				"auto-embeddings configuration deployment failed",
				slog.String("configuration_id", config.ID),
				slog.String("error", err.Error()),
			)
		}
	}

	logger.InfoContext(
		ctx,
		"auto-embeddings startup summary",
		slog.Any("failed_configurations", failed),
		slog.Any("undeclared_providers", slices.Sorted(maps.Keys(undeclared))),
	)

	return nil
}

func listingCause(err error) slog.Attr {
	switch {
	case errors.Is(err, context.Canceled):
		return slog.String("cause", "canceled")
	case errors.Is(err, context.DeadlineExceeded):
		return slog.String("cause", "deadline exceeded")
	}

	var request *hasura.RequestError
	if errors.As(err, &request) && request.StatusCode >= http.StatusContinue &&
		request.StatusCode <= 599 {
		return slog.Int("http_status", request.StatusCode)
	}

	return slog.String("cause", "request failed")
}
