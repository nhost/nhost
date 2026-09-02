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

var (
	errOpenAIChatCompletionsRequest     = errors.New("chat completions provider request failed")
	errOpenAIChatCompletionsStreamClose = errors.New(
		"chat completions provider stream close failed",
	)
)

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

type openAIChatCompletions struct {
	completions openai.ChatCompletionService
}

func newOpenAIChatCompletions(
	configuration endpointConfiguration,
) *openAIChatCompletions {
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

	return &openAIChatCompletions{
		completions: openai.NewChatCompletionService(options...),
	}
}

func (o *openAIChatCompletions) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	return streamOpenAIResponse(ctx, &o.completions, request)
}

func mapOpenAIChatCompletionsError(response *http.Response) error {
	if response != nil && response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf(
			"%w: HTTP status %d",
			errOpenAIChatCompletionsRequest,
			response.StatusCode,
		)
	}

	return errOpenAIChatCompletionsRequest
}
