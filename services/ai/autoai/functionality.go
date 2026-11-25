package autoai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/lib/pq"

	"github.com/nhost/nhost/services/ai/hasura"
)

var errDeploymentRequest = errors.New("database functionality request failed")

func (ai *AutoAI) removeFunctionality(
	ctx context.Context,
	fnName string,
	schemaName string,
	logger *slog.Logger,
) error {
	logger = logger.With(slog.String("function", fnName), slog.String("schema", schemaName))
	logger.InfoContext(ctx, "removing similar functionality")

	logger.InfoContext(ctx, "untracking function")

	if err := ai.hasuraClient.UntrackFunction(ctx, schemaName, fnName); err != nil {
		if metadataCode(err) != hasura.ErrorCodeNotExists {
			logger.ErrorContext(
				ctx,
				"failed to untrack function",
				slog.String("error", sanitizedSQLError(err).Error()),
			)

			return fmt.Errorf("failed to untrack function: %w", sanitizedSQLError(err))
		}
	}

	logger.InfoContext(ctx, "dropping function")

	fnCode := dropFunctions(schemaName, fnName)

	if _, err := ai.hasuraClient.RunSQL(ctx, fnCode, false); err != nil {
		logger.ErrorContext(
			ctx,
			"failed to run SQL",
			slog.String("error", sanitizedSQLError(err).Error()),
		)

		return fmt.Errorf("failed to run SQL: %w", sanitizedSQLError(err))
	}

	return nil
}

//nolint:unqueryvet
const tplSimilar = `{{ .Drop }}

CREATE FUNCTION
{{ .Schema }}.{{ .FnName }}({{ .IDColumn }} {{ .IDType }}, amount integer, maxDistance float DEFAULT 1.0)
RETURNS SETOF {{ .Schema }}.{{ .Table }} AS {{ .BodyDelimiter }}
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
{{ .BodyDelimiter }} LANGUAGE sql STABLE;`

//nolint:unqueryvet
const tplSearch = `{{ .Drop }}
CREATE FUNCTION
{{ .Schema }}.{{ .FnName }}(query text, amount integer, maxDistance float DEFAULT 1.0)
RETURNS SETOF {{ .Schema }}.{{ .Table }} AS {{ .BodyDelimiter }}
DECLARE
    emb text;
    response http_response;
    body json;
    msg text;
BEGIN
    PERFORM http_reset_curlopt();
    PERFORM http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
    PERFORM http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '5000');
    BEGIN
        response := http((
            'POST', {{ .AIURL }},
            ARRAY[http_header('X-AI-Webhook-Secret', {{ .WebhookSecret }})],
            'application/json',
            jsonb_build_object('query', query, 'configuration_id', {{ .ConfigurationID }})
        )::http_request);
    EXCEPTION WHEN OTHERS THEN
        msg := 'embedding service connection failed';
    END;
    IF msg IS NULL THEN
        BEGIN
            body := response.content::json;
            IF response.status >= 200 AND response.status < 300 THEN
                emb := body->>'embeddings';
                IF json_typeof(body->'embeddings') IS DISTINCT FROM 'array' THEN
                    msg := 'embedding service returned invalid embeddings';
                ELSE
                    PERFORM emb::vector;
                END IF;
            ELSE
                msg := COALESCE(body->>'error', 'embedding service request failed');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            IF response.status >= 200 AND response.status < 300 THEN
                msg := 'embedding service returned invalid embeddings';
            ELSE
                msg := 'embedding service returned an invalid error response';
            END IF;
        END;
    END IF;
    IF msg IS NOT NULL THEN
        RAISE EXCEPTION '%', left(msg, 500);
    END IF;
    RETURN QUERY
        SELECT * FROM {{ .Schema }}.{{ .Table }} AS t
            WHERE t.{{ .EmbeddingsColumn }} <=> emb::vector <= maxDistance
            ORDER BY t.{{ .EmbeddingsColumn }} <=> emb::vector
            LIMIT amount;
END;
{{ .BodyDelimiter }} LANGUAGE plpgsql STABLE;`

// Drop by namespace and name across signatures: table/primary-key type changes
// cannot be applied with CREATE OR REPLACE. Never remove another schema's function.
func dropFunctions(schema, name string) string {
	body := fmt.Sprintf(`DECLARE f record; BEGIN
    FOR f IN SELECT oid FROM pg_proc
        WHERE proname = %s AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = %s) LOOP
        EXECUTE format('DROP FUNCTION %%s', f.oid::regprocedure);
    END LOOP;
    END;`, pq.QuoteLiteral(name), pq.QuoteLiteral(schema))

	return "DO " + pq.QuoteLiteral(body) + ";"
}

// RunSQL errors may embed the complete SQL including the webhook credential.
// Read only an allowlisted code; never wrap or log the underlying error.
func sanitizedSQLError(err error) error {
	code := "request-failed"
	switch metadataCode(err) {
	case hasura.ErrorCodeAlreadyTracked:
		code = "already-tracked"
	case hasura.ErrorCodeNotExists:
		code = "not-exists"
	case "invalid-configuration":
		code = "invalid-configuration"
	case "not-supported":
		code = "not-supported"
	}

	if requestError, ok := errors.AsType[*hasura.RequestError](err); ok {
		var body struct {
			Code string `json:"code"`
		}
		if json.Unmarshal(requestError.Body, &body) == nil {
			switch body.Code {
			case "postgres-error",
				"not-exists",
				"already-tracked",
				"not-supported",
				"constraint-violation":
				code = body.Code
			}
		}
	}

	return fmt.Errorf("%w (%s)", errDeploymentRequest, code)
}

func renderFunction(tpl string, args map[string]string) (string, error) {
	delimiter := "$function$"
	for {
		found := false
		for _, value := range args {
			if strings.Contains(value, delimiter) {
				found = true
				break
			}
		}

		if !found {
			break
		}

		delimiter = strings.TrimSuffix(delimiter, "$") + "_$"
	}

	args["BodyDelimiter"] = delimiter

	code, err := renderTemplate(tpl, args)
	if err != nil {
		return "", fmt.Errorf("render functionality: %w", err)
	}

	if args["Ownership"] != "" {
		code += fmt.Sprintf(
			"\nCOMMENT ON FUNCTION %s.%s(%s) IS %s;\n",
			args["Schema"],
			args["FnName"],
			args["Signature"],
			args["Ownership"],
		)
	}

	return code, nil
}

func (ai *AutoAI) renderDeployment(
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	pk []hasura.PKInformation,
) (string, error) {
	var result strings.Builder
	for _, search := range []bool{false, true} {
		_, tpl, args := ai.functionArguments(config, pk, search)

		code, err := renderFunction(tpl, args)
		if err != nil {
			return "", fmt.Errorf("render deployment: %w", err)
		}

		result.WriteString(code)
	}

	return result.String(), nil
}

func (ai *AutoAI) functionArguments(
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	pk []hasura.PKInformation,
	search bool,
) (string, string, map[string]string) {
	name := "ai_similar_" + config.Name
	tpl := tplSimilar

	signature := pk[0].DataType + ",integer,double precision"
	if search {
		name = "ai_search_" + config.Name
		tpl = tplSearch
		signature = "text,integer,double precision"
	}

	return name, tpl, map[string]string{
		"FnName": pq.QuoteIdentifier(name),
		"Drop":   dropFunctions(config.SchemaName, name),
		"Schema": pq.QuoteIdentifier(
			config.SchemaName,
		),
		"Table":    pq.QuoteIdentifier(config.TableName),
		"IDType":   pk[0].DataType,
		"IDColumn": pq.QuoteIdentifier(pk[0].ColumnName),
		"EmbeddingsColumn": pq.QuoteIdentifier(
			config.ColumnName,
		),
		"ConfigurationID": pq.QuoteLiteral(config.ID),
		"AIURL": pq.QuoteLiteral(
			ai.aiBaseURL + "/v1/webhooks/generate-embeddings",
		),
		"WebhookSecret": pq.QuoteLiteral(ai.webhookSecret),
		"Signature":     signature,
		"Ownership":     pq.QuoteLiteral(ownershipTag(config.ID)),
	}
}

func metadataCode(err error) string {
	var request *hasura.MetadataRequestError
	if errors.As(err, &request) && request.Body != nil {
		return request.Body.Code
	}

	return ""
}
