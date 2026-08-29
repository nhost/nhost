package openai

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
	"github.com/nhost/nhost/services/ai/openai/api"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const webhookToolTimeout = 30 * time.Second

// webhookHTTPClient is the SSRF-safe client used for assistant webhook tool
// calls. The webhook URL is supplied via tool config and could otherwise be
// pointed at loopback / cloud metadata endpoints.
var webhookHTTPClient = httpsafe.NewClient(webhookToolTimeout) //nolint:gochecknoglobals

var (
	ErrOneOperationExpected = errors.New("expected 1 operation")
	ErrInvalidWebhookURL    = errors.New("invalid webhook url")
)

type ParseGraphqlError struct {
	Err error
}

func (e ParseGraphqlError) Error() string {
	return fmt.Sprintf("failed to parse graphql: %v", e.Err)
}

func toolFromMetadata[T any](metadata any) (*T, error) {
	s, ok := metadata.(string)
	if !ok {
		return nil, ErrMetadataMustBeString
	}

	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("error decoding base64: %w", err)
	}

	reader, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("error creating gzip reader: %w", err)
	}
	defer reader.Close()

	var tool T
	if err := json.NewDecoder(reader).Decode(&tool); err != nil {
		return nil, fmt.Errorf("error decoding tool: %w", err)
	}

	return &tool, nil
}

type toolItem interface {
	FromAssistantToolsFunction(v api.AssistantToolsFunction) error
}

func ToToolsItem[T *model.GraphiteAssistantToolGraphQLInput | *model.GraphiteAssistantToolWebhookInput](
	t T,
	fn func(t T) (api.FunctionObject, error),
	item toolItem,
) error {
	f, err := fn(t)
	if err != nil {
		return fmt.Errorf("error converting tool to function: %w", err)
	}

	if err := item.FromAssistantToolsFunction(
		api.AssistantToolsFunction{
			Function: f,
			Type:     "function",
		},
	); err != nil {
		return fmt.Errorf("error converting tool to item: %w", err)
	}

	return nil
}

func GraphqlQueryToFunctionsObject(
	gql *model.GraphiteAssistantToolGraphQLInput,
) (api.FunctionObject, error) {
	q, err := parser.ParseQuery(&ast.Source{
		Name:    "schema.graphql",
		Input:   gql.Query,
		BuiltIn: false,
	})
	if err != nil {
		return api.FunctionObject{},
			ParseGraphqlError{Err: err}
	}

	if len(q.Operations) != 1 {
		return api.FunctionObject{}, ErrOneOperationExpected
	}

	properties := make(map[string]any, len(gql.Arguments))

	required := make([]string, 0, len(gql.Arguments))
	for _, v := range gql.Arguments {
		properties[v.Name] = map[string]any{
			"type":        v.Type,
			"description": v.Description,
		}
		if v.Required {
			required = append(required, v.Name)
		}
	}

	return api.FunctionObject{ //nolint:exhaustruct
		Name:        gql.Name,
		Description: new(gql.Description),
		Parameters: &api.FunctionParameters{
			"type":       "object",
			"properties": properties,
			"required":   required,
		},
	}, nil
}

func WebhookToFunctionsObject(
	wh *model.GraphiteAssistantToolWebhookInput,
) (api.FunctionObject, error) {
	properties := make(map[string]any, len(wh.Arguments))

	required := make([]string, 0, len(wh.Arguments))
	for _, v := range wh.Arguments {
		properties[v.Name] = map[string]any{
			"type":        v.Type,
			"description": v.Description,
		}
		if v.Required {
			required = append(required, v.Name)
		}
	}

	url, err := url.Parse(wh.URL)
	if err != nil {
		return api.FunctionObject{}, ErrInvalidWebhookURL
	}

	if url.Scheme != "https" && url.Scheme != "http" {
		return api.FunctionObject{}, ErrInvalidWebhookURL
	}

	return api.FunctionObject{ //nolint:exhaustruct
		Name:        wh.Name,
		Description: new(wh.Description),
		Parameters: &api.FunctionParameters{
			"type":       "object",
			"properties": properties,
			"required":   required,
		},
	}, nil
}

func readToolResponseBody(resp *http.Response) ([]byte, error) {
	body := resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		reader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("error decoding gzip body: %w", err)
		}
		defer reader.Close()

		body = reader
	}

	b, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	return b, nil
}

func toolRequest(
	ctx context.Context,
	client *http.Client,
	url string,
	body io.Reader,
	logger *slog.Logger,
) string {
	ginC := middleware.GinFromContext(ctx)

	headers := ginC.Request.Header.Clone()
	headers.Set("Content-Type", "application/json")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		logger.ErrorContext(ctx, "error creating request", slog.String("error", err.Error()))
		return "error creating request"
	}

	req.Header = headers

	resp, err := client.Do(req)
	if err != nil {
		logger.ErrorContext(ctx, "error sending request", slog.String("error", err.Error()))
		return "error sending request"
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		logger.ErrorContext(
			ctx,
			"unexpected status code",
			slog.Int("status_code", resp.StatusCode),
			slog.String("body", string(b)),
		)

		return "unexpected status code"
	}

	b, err := readToolResponseBody(resp)
	if err != nil {
		logger.ErrorContext(ctx, "error reading response body", slog.String("error", err.Error()))
		return "error reading response body"
	}

	return string(b)
}

func webhookToolWrapper(url string) toolFn {
	return func(ctx context.Context, arguments string, logger *slog.Logger) string {
		return toolRequest(ctx, webhookHTTPClient, url, strings.NewReader(arguments), logger)
	}
}

func graphqlToolWrapper(url, adminSecret, query string) toolFn {
	return func(ctx context.Context, arguments string, logger *slog.Logger) string {
		ginC := middleware.GinFromContext(ctx)
		if ginC != nil && ginC.GetHeader("Authorization") == "" {
			// hasura doesn't forward the admin secret so if the Auhtorization header
			// is empty it means the request was done with the admin secret.
			// For this to not be a security issue GRAPHITE_WEBHOOK_SECRET must be set
			ginC.Request.Header.Set("X-Hasura-Admin-Secret", adminSecret)
		}

		var args map[string]any
		if err := json.Unmarshal([]byte(arguments), &args); err != nil {
			logger.ErrorContext(
				ctx,
				"error unmarshalling arguments",
				slog.String("error", err.Error()),
			)

			return "error unmarshalling arguments"
		}

		b, err := json.Marshal(
			map[string]any{
				"query":     query,
				"variables": args,
			},
		)
		if err != nil {
			logger.ErrorContext(ctx, "error marshalling query", slog.String("error", err.Error()))
			return "error marshalling query"
		}

		// graphqlToolWrapper points at the operator-configured Hasura URL,
		// which is trusted (and is loopback in dev). It does not need the
		// SSRF-safe client.
		return toolRequest(ctx, http.DefaultClient, url, bytes.NewReader(b), logger)
	}
}
