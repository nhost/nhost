package provider

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

const openAIChatCompletionsMaxRetries = 2

var errOpenAIChatCompletionsRequest = errors.New("chat completions provider request failed")

// OpenAIChatCompletionsConfig contains validated startup configuration for a
// Chat Completions endpoint. Its endpoint and headers are intentionally private
// so callers cannot read credentials back from it.
type OpenAIChatCompletionsConfig struct {
	baseURL string
	headers map[string]string
}

// NewOpenAIChatCompletionsConfig validates and defensively copies configuration
// for a Chat Completions endpoint.
func NewOpenAIChatCompletionsConfig(
	baseURL string,
	headers map[string]string,
) (*OpenAIChatCompletionsConfig, error) {
	configuration, err := newOpenAIChatCompletionsConfiguration(baseURL, headers)
	if err != nil {
		return nil, err
	}

	return &OpenAIChatCompletionsConfig{
		baseURL: configuration.baseURL,
		headers: configuration.headers,
	}, nil
}

func newOpenAIChatCompletionsConfiguration(
	baseURL string,
	headers map[string]string,
) (endpointConfiguration, error) {
	return newEndpointConfiguration(
		baseURL,
		headers,
		validateOpenAIChatCompletionsURL,
		[]string{"x-stainless-"},
		nil,
	)
}

func validateOpenAIChatCompletionsURL(baseURL string) error {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return errInvalidProviderBaseURL
	}

	pathWithoutTrailingSlash := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasSuffix(pathWithoutTrailingSlash, "/chat/completions") {
		return errInvalidProviderBaseURL
	}

	return nil
}

// OpenAIChatCompletions implements Provider for a configured Chat Completions
// endpoint.
type OpenAIChatCompletions struct {
	completions openai.ChatCompletionService
}

// NewOpenAIChatCompletions creates a reusable Chat Completions provider client.
func NewOpenAIChatCompletions(
	config *OpenAIChatCompletionsConfig,
) (*OpenAIChatCompletions, error) {
	if config == nil {
		return nil, errInvalidProviderBaseURL
	}

	configuration, err := newOpenAIChatCompletionsConfiguration(
		config.baseURL,
		config.headers,
	)
	if err != nil {
		return nil, err
	}

	return newOpenAIChatCompletions(configuration), nil
}

func newOpenAIChatCompletions(
	configuration endpointConfiguration,
) *OpenAIChatCompletions {
	headerNames := make([]string, 0, len(configuration.headers))
	for name := range configuration.headers {
		headerNames = append(headerNames, name)
	}

	slices.Sort(headerNames)

	options := []option.RequestOption{
		option.WithBaseURL(configuration.baseURL),
		option.WithHTTPClient(newNoRedirectHTTPClient()),
		option.WithMaxRetries(openAIChatCompletionsMaxRetries),
	}
	options = slices.Grow(options, len(headerNames))

	for _, name := range headerNames {
		options = append(options, option.WithHeader(name, configuration.headers[name]))
	}

	return &OpenAIChatCompletions{
		completions: openai.NewChatCompletionService(options...),
	}
}

// StreamResponse streams a request through the configured Chat Completions
// endpoint.
func (o *OpenAIChatCompletions) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	return streamOpenAIResponse(
		ctx,
		&o.completions,
		request,
		mapOpenAIChatCompletionsError,
	)
}

func mapOpenAIChatCompletionsError(_ error, response *http.Response) error {
	if response != nil && response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf(
			"%w: HTTP status %d",
			errOpenAIChatCompletionsRequest,
			response.StatusCode,
		)
	}

	return errOpenAIChatCompletionsRequest
}
