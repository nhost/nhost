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
	"net/url"
	"time"

	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
)

const webSearchMaxResponseSize = 1 << 20 // 1 MB

var (
	// ErrUnsupportedSearchProvider is returned when a web search provider is not supported.
	ErrUnsupportedSearchProvider = errors.New("unsupported search provider")
	errWebSearchHTTPStatus       = errors.New("web search provider returned non-2xx status")
)

const (
	webSearchTimeout    = 15 * time.Second
	webSearchMaxResults = 5
)

// WebSearchConfig holds configuration for the web search tool.
type WebSearchConfig struct {
	Provider string `json:"provider"` // "brave" or "tavily"
	APIKey   string `json:"api_key"`
}

// WebSearch implements the Tool interface for web searches.
type WebSearch struct {
	config WebSearchConfig
	client *http.Client
}

// NewWebSearch creates a new web search tool.
func NewWebSearch(config WebSearchConfig) *WebSearch {
	return &WebSearch{
		config: config,
		client: httpsafe.NewClient(webSearchTimeout),
	}
}

// Definition returns the tool definition.
func (w *WebSearch) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name: "web_search",
		Description: "Search the web for current information. " +
			"Use this when you need up-to-date information that may not be in your training data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "The search query",
				},
			},
			"required": []string{"query"},
		},
	}
}

type webSearchArgs struct {
	Query string `json:"query"`
}

// Execute performs a web search.
func (w *WebSearch) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	var args webSearchArgs
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse arguments: %w", err)
	}

	logger.InfoContext(ctx, "performing web search", slog.String("query", args.Query))

	switch w.config.Provider {
	case "brave":
		return w.searchBrave(ctx, args.Query, logger)
	case "tavily":
		return w.searchTavily(ctx, args.Query, logger)
	default:
		return "", fmt.Errorf("%w: %s", ErrUnsupportedSearchProvider, w.config.Provider)
	}
}

func (w *WebSearch) searchBrave(
	ctx context.Context,
	query string,
	logger *slog.Logger,
) (string, error) {
	u := fmt.Sprintf(
		"https://api.search.brave.com/res/v1/web/search?q=%s&count=%d",
		url.QueryEscape(query), webSearchMaxResults,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Subscription-Token", w.config.APIKey)

	resp, err := w.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to perform search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, webSearchMaxResponseSize))
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if err := validateWebSearchStatus(ctx, logger, "brave", resp.StatusCode, body); err != nil {
		return "", err
	}

	return string(body), nil
}

func (w *WebSearch) searchTavily(
	ctx context.Context,
	query string,
	logger *slog.Logger,
) (string, error) {
	payload, err := json.Marshal(map[string]any{
		"query":       query,
		"max_results": webSearchMaxResults,
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		"https://api.tavily.com/search",
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+w.config.APIKey)

	resp, err := w.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to perform search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, webSearchMaxResponseSize))
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if err := validateWebSearchStatus(ctx, logger, "tavily", resp.StatusCode, body); err != nil {
		return "", err
	}

	return string(body), nil
}

func validateWebSearchStatus(
	ctx context.Context,
	logger *slog.Logger,
	provider string,
	statusCode int,
	body []byte,
) error {
	if statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices {
		return nil
	}

	attrs := []any{
		slog.String("provider", provider),
		slog.Int("status", statusCode),
		slog.String("body", string(body)),
	}
	switch {
	case statusCode >= http.StatusInternalServerError:
		logger.ErrorContext(ctx, "web search provider returned server error", attrs...)
	case statusCode >= http.StatusBadRequest:
		logger.WarnContext(ctx, "web search provider returned client error", attrs...)
	default:
		logger.WarnContext(ctx, "web search provider returned unexpected status", attrs...)
	}

	return fmt.Errorf(
		"%w: provider %s status %d: %s",
		errWebSearchHTTPStatus,
		provider,
		statusCode,
		body,
	)
}
