package tool

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool/graphqlutil"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	graphqlTimeout              = 30 * time.Second
	graphqlMaxResponseSize      = 1 << 20  // 1 MB
	graphqlMaxIntrospectionSize = 10 << 20 // 10 MB
)

var (
	errIntrospectionFailed = errors.New("introspection query failed")
	errIntrospectionErrors = errors.New("introspection query returned errors")
	errQueryRequired       = errors.New("query is required")
	errNoOperations        = errors.New("query contains no operations")
	errMultipleOperations  = errors.New(
		"document must contain exactly one operation",
	)
	errSubscriptionNotAllowed = errors.New("subscriptions are not supported")
	errMutationNotAllowed     = errors.New(
		"mutations are not allowed in graphql_query, use graphql_mutation instead",
	)
	errQueryNotAllowed = errors.New(
		"queries are not allowed in graphql_mutation, use graphql_query instead",
	)
	errGraphQLHTTPStatus       = errors.New("graphql endpoint returned non-2xx status")
	errGraphQLResponseTooLarge = errors.New("graphql response too large")
)

// GraphQLConfig holds the configuration for GraphQL tools.
type GraphQLConfig struct {
	URL     string
	Headers http.Header
}

// GraphQLGetSchema implements the Tool interface for retrieving the GraphQL schema.
type GraphQLGetSchema struct {
	config GraphQLConfig
	client *http.Client
}

// NewGraphQLGetSchema creates a new GraphQL get schema tool.
func NewGraphQLGetSchema(config GraphQLConfig) *GraphQLGetSchema {
	return &GraphQLGetSchema{
		config: config,
		client: newTrustedGraphQLClient(),
	}
}

func newTrustedGraphQLClient() *http.Client {
	// GraphQL tools call the operator-configured Hasura URL, which is trusted
	// and commonly resolves to loopback or a private Docker IP in local/dev
	// deployments. Keep the SSRF-safe client for user-controlled URL tools.
	return &http.Client{Timeout: graphqlTimeout} //nolint:exhaustruct
}

// Definition returns the tool definition for GraphQL get schema.
func (g *GraphQLGetSchema) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name: "graphql_get_schema",
		Description: "Retrieve the GraphQL schema via introspection. " +
			"Use summary mode first for an overview, then full mode for specific details.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"summary": map[string]any{
					"type":        "boolean",
					"description": "If true, return a JSON summary of query/mutation names. If false, return the full SDL schema.",
					"default":     true,
				},
			},
		},
	}
}

type graphqlGetSchemaArgs struct {
	Summary *bool `json:"summary"`
}

// Execute performs the introspection query and returns the schema.
func (g *GraphQLGetSchema) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	var args graphqlGetSchemaArgs
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse arguments: %w", err)
	}

	summary := args.Summary == nil || *args.Summary

	logger.InfoContext(ctx, "introspecting GraphQL schema", slog.Bool("summary", summary))

	response, err := g.doIntrospection(ctx, summary)
	if err != nil {
		return "", err
	}

	if summary {
		return graphqlutil.SummarizeSchema(*response), nil
	}

	return graphqlutil.ParseSchema(*response), nil
}

func introspectionQuery(summary bool) string {
	if summary {
		return graphqlutil.SummaryIntrospectionQuery
	}

	return graphqlutil.IntrospectionQuery
}

func introspectionResponseTooLargeError(summary bool) error {
	suggestion := ""
	if !summary {
		suggestion = "; try summary mode first"
	}

	return fmt.Errorf(
		"%w: introspection response exceeds %d bytes%s",
		errIntrospectionFailed,
		graphqlMaxIntrospectionSize,
		suggestion,
	)
}

func (g *GraphQLGetSchema) doIntrospection(
	ctx context.Context,
	summary bool,
) (*graphqlutil.ResponseIntrospection, error) {
	body, err := json.Marshal(map[string]any{
		"query": introspectionQuery(summary),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal introspection query: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		g.config.URL,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	setAuthHeaders(req, g.config.Headers)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute introspection query: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, err := io.ReadAll(io.LimitReader(resp.Body, graphqlMaxResponseSize))
		if err != nil {
			return nil, fmt.Errorf("failed to read error response: %w", err)
		}

		return nil, fmt.Errorf(
			"%w with status %d: %s",
			errIntrospectionFailed,
			resp.StatusCode,
			respBody,
		)
	}

	var response graphqlutil.ResponseIntrospection

	lr := &io.LimitedReader{R: resp.Body, N: graphqlMaxIntrospectionSize}
	if err := json.NewDecoder(lr).Decode(&response); err != nil {
		if lr.N == 0 {
			return nil, introspectionResponseTooLargeError(summary)
		}

		return nil, fmt.Errorf("failed to decode introspection response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("%w: %s", errIntrospectionErrors, response.Errors[0].Message)
	}

	return &response, nil
}

// GraphQLQuery implements the Tool interface for executing GraphQL queries.
type GraphQLQuery struct {
	config GraphQLConfig
	client *http.Client
}

// NewGraphQLQuery creates a new GraphQL query tool.
func NewGraphQLQuery(config GraphQLConfig) *GraphQLQuery {
	return &GraphQLQuery{
		config: config,
		client: newTrustedGraphQLClient(),
	}
}

// Definition returns the tool definition for GraphQL query.
func (g *GraphQLQuery) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name: "graphql_query",
		Description: "Execute a GraphQL query (read-only). " +
			"For mutations, use graphql_mutation. " +
			"Retrieve the schema first to know available operations.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "The GraphQL query to execute.",
				},
				"variables": map[string]any{
					"type":        "object",
					"description": "Optional variables for the query.",
				},
			},
			"required": []string{"query"},
		},
	}
}

type graphqlQueryArgs struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

// Execute runs a GraphQL query and returns the response.
func (g *GraphQLQuery) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	var args graphqlQueryArgs
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse arguments: %w", err)
	}

	if args.Query == "" {
		return "", errQueryRequired
	}

	if err := validateOperationType(args.Query, ast.Query); err != nil {
		return "", err
	}

	logger.InfoContext(ctx, "executing GraphQL query")

	return executeGraphQL(ctx, g.client, g.config, args.Query, args.Variables, logger)
}

// GraphQLMutation implements the Tool interface for executing GraphQL mutations.
type GraphQLMutation struct {
	config GraphQLConfig
	client *http.Client
}

// NewGraphQLMutation creates a new GraphQL mutation tool.
func NewGraphQLMutation(config GraphQLConfig) *GraphQLMutation {
	return &GraphQLMutation{
		config: config,
		client: newTrustedGraphQLClient(),
	}
}

// Definition returns the tool definition for GraphQL mutation.
func (g *GraphQLMutation) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name: "graphql_mutation",
		Description: "Execute a GraphQL mutation. " +
			"For read-only queries, use graphql_query. " +
			"Retrieve the schema first to know available operations.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "The GraphQL mutation to execute.",
				},
				"variables": map[string]any{
					"type":        "object",
					"description": "Optional variables for the mutation.",
				},
			},
			"required": []string{"query"},
		},
	}
}

// Execute runs a GraphQL mutation and returns the response.
func (g *GraphQLMutation) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	var args graphqlQueryArgs
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse arguments: %w", err)
	}

	if args.Query == "" {
		return "", errQueryRequired
	}

	if err := validateOperationType(args.Query, ast.Mutation); err != nil {
		return "", err
	}

	logger.InfoContext(ctx, "executing GraphQL mutation")

	return executeGraphQL(ctx, g.client, g.config, args.Query, args.Variables, logger)
}

func executeGraphQL(
	ctx context.Context,
	client *http.Client,
	config GraphQLConfig,
	query string,
	variables map[string]any,
	logger *slog.Logger,
) (string, error) {
	body, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": variables,
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal query: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		config.URL,
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	setAuthHeaders(req, config.Headers)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute query: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := readGraphQLResponse(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		attrs := []any{
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(respBody)),
		}
		if resp.StatusCode >= http.StatusInternalServerError {
			logger.ErrorContext(ctx, "graphql endpoint returned server error", attrs...)
		} else {
			logger.WarnContext(ctx, "graphql endpoint returned client error", attrs...)
		}

		return "", fmt.Errorf(
			"%w: status %d: %s",
			errGraphQLHTTPStatus,
			resp.StatusCode,
			respBody,
		)
	}

	return string(respBody), nil
}

func readGraphQLResponse(body io.Reader) ([]byte, error) {
	respBody, err := io.ReadAll(io.LimitReader(body, graphqlMaxResponseSize+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if len(respBody) > graphqlMaxResponseSize {
		return nil, fmt.Errorf(
			"%w: response exceeds %d bytes; narrow the query or add pagination",
			errGraphQLResponseTooLarge,
			graphqlMaxResponseSize,
		)
	}

	return respBody, nil
}

func validateOperationType(query string, allowed ast.Operation) error {
	doc, err := parser.ParseQuery(&ast.Source{ //nolint:exhaustruct
		Input: query,
	})
	if err != nil {
		return fmt.Errorf("failed to parse query: %w", err)
	}

	if len(doc.Operations) == 0 {
		return errNoOperations
	}

	if len(doc.Operations) > 1 {
		return errMultipleOperations
	}

	op := doc.Operations[0]
	if op.Operation == ast.Subscription {
		return errSubscriptionNotAllowed
	}

	if op.Operation != allowed {
		if allowed == ast.Query {
			return errMutationNotAllowed
		}

		return errQueryNotAllowed
	}

	return nil
}

func setAuthHeaders(req *http.Request, headers http.Header) {
	if val := headers.Get("Authorization"); val != "" {
		req.Header.Set("Authorization", val)
	}

	for key, values := range headers {
		if !strings.HasPrefix(strings.ToLower(key), "x-hasura-") {
			continue
		}

		req.Header.Del(key)

		for _, v := range values {
			req.Header.Add(key, v)
		}
	}
}
