package autoai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
)

func (ai *AutoAI) deployFunctionality(
	ctx context.Context,
	fnName string,
	schemaName string,
	tpl string,
	args map[string]string,
	logger *slog.Logger,
) error {
	logger = logger.With(slog.String("function", fnName))
	logger.InfoContext(ctx, "deploying similar functionality")

	fnCode, err := renderTemplate(tpl, args)
	if err != nil {
		logger.ErrorContext(ctx, "failed to render template", slog.String("error", err.Error()))
		return fmt.Errorf("failed to render template: %w", err)
	}

	logger.DebugContext(ctx, "running SQL", slog.String("sql", fnCode))

	if _, err := ai.hasuraClient.RunSQL(ctx, fnCode, false); err != nil {
		logger.ErrorContext(
			ctx,
			"failed to run SQL",
			slog.String("error", err.Error()),
			slog.String("sql", fnCode),
		)

		return fmt.Errorf("failed to run SQL: %w", err)
	}

	logger.InfoContext(ctx, "tracking function")

	if err := ai.hasuraClient.TrackFunction(ctx, schemaName, fnName); err != nil {
		var reqErr *hasura.MetadataRequestError
		if errors.As(err, &reqErr) && reqErr.Body.Code == hasura.ErrorCodeAlreadyTracked {
			return nil
		}

		logger.ErrorContext(ctx, "failed to track function", slog.String("error", err.Error()))

		return fmt.Errorf("failed to track function: %w", err)
	}

	return nil
}

func (ai *AutoAI) removeFunctionality(
	ctx context.Context,
	fnName string,
	schemaName string,
	logger *slog.Logger,
) error {
	logger = logger.With(slog.String("function", fnName))
	logger.InfoContext(ctx, "removing similar functionality")

	logger.InfoContext(ctx, "untracking function")

	if err := ai.hasuraClient.UntrackFunction(ctx, schemaName, fnName); err != nil {
		logger.ErrorContext(ctx, "failed to untrack function", slog.String("error", err.Error()))
		return fmt.Errorf("failed to untrack function: %w", err)
	}

	logger.InfoContext(ctx, "dropping function")

	fnCode := fmt.Sprintf("DROP FUNCTION IF EXISTS %s;", fnName)
	logger.DebugContext(ctx, "running SQL", slog.String("sql", fnCode))

	if _, err := ai.hasuraClient.RunSQL(ctx, fnCode, false); err != nil {
		logger.ErrorContext(
			ctx,
			"failed to run SQL",
			slog.String("error", err.Error()),
			slog.String("sql", fnCode),
		)

		return fmt.Errorf("failed to run SQL: %w", err)
	}

	return nil
}

//nolint:unqueryvet
const tplSimilar = `DROP FUNCTION IF EXISTS {{ .FnName }};

CREATE OR REPLACE FUNCTION
{{ .Schema }}.{{ .FnName }}({{ .IDColumn }} {{ .IDType }}, amount integer, maxDistance float DEFAULT 1.0)
RETURNS SETOF {{ .Schema }}.{{ .Table }} AS $$
    SELECT * FROM {{ .Schema }}.{{ .Table }} AS t1
        WHERE t1.{{ .IDColumn }} != $1
        AND t1.{{ .EmbeddingsColumn }} <=> (
            SELECT {{ .EmbeddingsColumn }}
            FROM {{ .Schema }}.{{ .Table }} AS t2
            WHERE t2.{{ .IDColumn }} = $1
        ) <= maxDistance
        ORDER BY t1.{{ .EmbeddingsColumn }} <=> (
            SELECT {{ .EmbeddingsColumn }}
            FROM {{ .Schema }}.{{ .Table }} AS t2
            WHERE t2.{{ .IDColumn }} = $1
        )
        LIMIT $2;
$$ LANGUAGE sql STABLE;`

func (ai *AutoAI) DeploySimilarFunctionality(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	pkInfo []hasura.PKInformation,
	logger *slog.Logger,
) error {
	fnName := "ai_similar_" + config.GetName()

	args := map[string]string{
		"FnName":           fnName,
		"Schema":           config.GetSchemaName(),
		"Table":            config.GetTableName(),
		"IDType":           pkInfo[0].DataType,
		"IDColumn":         pkInfo[0].ColumnName,
		"EmbeddingsColumn": config.GetColumnName(),
	}
	if err := ai.deployFunctionality(
		ctx, fnName, config.GetSchemaName(), tplSimilar, args, logger,
	); err != nil {
		return fmt.Errorf("failed to deploy similar functionality: %w", err)
	}

	return nil
}

func (ai *AutoAI) RemoveSimilarFunctionality(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) error {
	fnName := "ai_similar_" + config.GetName()
	if err := ai.removeFunctionality(
		ctx, fnName, config.GetSchemaName(), logger,
	); err != nil {
		return fmt.Errorf("failed to remove similar functionality: %w", err)
	}

	return nil
}

//nolint:unqueryvet
const tplSearch = `DROP FUNCTION IF EXISTS {{ .FnName }};
CREATE OR REPLACE FUNCTION
{{ .Schema }}.{{ .FnName }}(query text, amount integer, maxDistance float DEFAULT 1.0)
RETURNS SETOF {{ .Schema }}.{{ .Table }} AS $$
DECLARE
    emb text;
BEGIN
    PERFORM http_set_curlopt('CURLOPT_TIMEOUT', '5000');
    PERFORM http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '5000');

    SELECT content::json->'embeddings' FROM http(
        (
            'POST',
            '{{ .AIURL }}',
            ARRAY[http_header('X-AI-Webhook-Secret','{{ .WebhookSecret }}')],
            'application/json',
            jsonb_build_object('query', query, 'model', '{{ .Model }}')
        )::http_request
    )
    INTO emb;

    IF EMB IS NULL THEN
        RAISE EXCEPTION 'couldn''t get embeddings for the search';
    END IF;

    RETURN QUERY
        SELECT * FROM {{ .Schema }}.{{ .Table }} AS t
            WHERE t.{{ .EmbeddingsColumn }} <=> emb::vector <= maxDistance
            ORDER BY t.{{ .EmbeddingsColumn }} <=> emb::vector
            LIMIT amount;
END;
$$ LANGUAGE plpgsql STABLE;`

func (ai *AutoAI) DeploySearchFunctionality(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	pkInfo []hasura.PKInformation,
	logger *slog.Logger,
) error {
	fnName := "ai_search_" + config.GetName()

	args := map[string]string{
		"FnName":           fnName,
		"Schema":           config.GetSchemaName(),
		"Table":            config.GetTableName(),
		"IDType":           pkInfo[0].DataType,
		"IDColumn":         pkInfo[0].ColumnName,
		"Model":            config.GetModel(),
		"EmbeddingsColumn": config.GetColumnName(),
		"AIURL":            ai.aiBaseURL + "/v1/webhooks/generate-embeddings",
		"WebhookSecret":    ai.webhookSecret,
	}
	if err := ai.deployFunctionality(
		ctx, fnName, config.GetSchemaName(), tplSearch, args, logger,
	); err != nil {
		return fmt.Errorf("failed to deploy search functionality: %w", err)
	}

	return nil
}

func (ai *AutoAI) RemoveSearchFunctionality(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	logger *slog.Logger,
) error {
	fnName := "ai_search_" + config.GetName()
	if err := ai.removeFunctionality(
		ctx, fnName, config.GetSchemaName(), logger,
	); err != nil {
		return fmt.Errorf("failed to remove search functionality: %w", err)
	}

	return nil
}
