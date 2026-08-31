package provider

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

var (
	errInvalidOpenAICompatibleBaseURL = errors.New("invalid OpenAI-compatible base URL")
	errInvalidOpenAICompatibleHeaders = errors.New("invalid OpenAI-compatible headers")
	errOpenAICompatibleRedirect       = errors.New("OpenAI-compatible redirects are not allowed")
	errOpenAICompatibleRequest        = errors.New("OpenAI-compatible provider request failed")
)

// OpenAICompatibleConfig contains validated startup configuration for an
// OpenAI-compatible Chat Completions endpoint. Its endpoint and headers are
// intentionally private so callers cannot read credentials back from it.
type OpenAICompatibleConfig struct {
	baseURL string
	headers map[string]string
}

// NewOpenAICompatibleConfig validates and defensively copies configuration for
// an OpenAI-compatible Chat Completions endpoint.
func NewOpenAICompatibleConfig(
	baseURL string,
	headers map[string]string,
) (*OpenAICompatibleConfig, error) {
	if err := validateOpenAICompatibleBaseURL(baseURL); err != nil {
		return nil, err
	}

	if err := validateOpenAICompatibleHeaders(headers); err != nil {
		return nil, err
	}

	headersCopy := make(map[string]string, len(headers))
	maps.Copy(headersCopy, headers)

	return &OpenAICompatibleConfig{
		baseURL: baseURL,
		headers: headersCopy,
	}, nil
}

func validateOpenAICompatibleBaseURL(baseURL string) error {
	if !utf8.ValidString(baseURL) {
		return errInvalidOpenAICompatibleBaseURL
	}

	parsed, err := url.Parse(baseURL)
	if err != nil {
		return errInvalidOpenAICompatibleBaseURL
	}

	if !parsed.IsAbs() || parsed.Opaque != "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Host == "" || parsed.Hostname() == "" || parsed.User != nil ||
		parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" ||
		strings.Contains(baseURL, "#") {
		return errInvalidOpenAICompatibleBaseURL
	}

	pathWithoutTrailingSlash := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasSuffix(pathWithoutTrailingSlash, "/chat/completions") {
		return errInvalidOpenAICompatibleBaseURL
	}

	return nil
}

func validateOpenAICompatibleHeaders(headers map[string]string) error {
	reserved := map[string]struct{}{
		"host":                {},
		"content-length":      {},
		"content-type":        {},
		"accept":              {},
		"connection":          {},
		"keep-alive":          {},
		"proxy-authenticate":  {},
		"proxy-authorization": {},
		"te":                  {},
		"trailer":             {},
		"transfer-encoding":   {},
		"upgrade":             {},
	}
	seen := make(map[string]struct{}, len(headers))

	for name, value := range headers {
		lowerName := strings.ToLower(name)
		if !validOpenAICompatibleHeaderName(name) ||
			!validOpenAICompatibleHeaderValue(value) {
			return errInvalidOpenAICompatibleHeaders
		}

		if _, ok := seen[lowerName]; ok {
			return errInvalidOpenAICompatibleHeaders
		}

		seen[lowerName] = struct{}{}

		if _, ok := reserved[lowerName]; ok || strings.HasPrefix(lowerName, "x-stainless-") {
			return errInvalidOpenAICompatibleHeaders
		}
	}

	return nil
}

func validOpenAICompatibleHeaderName(name string) bool {
	if name == "" || !utf8.ValidString(name) {
		return false
	}

	for i := range len(name) {
		char := name[i]
		if ('a' <= char && char <= 'z') || ('A' <= char && char <= 'Z') ||
			('0' <= char && char <= '9') {
			continue
		}

		switch char {
		case '!', '#', '$', '%', '&', '\'', '*', '+', '-', '.', '^', '_', '`', '|', '~':
			continue
		default:
			return false
		}
	}

	return true
}

func validOpenAICompatibleHeaderValue(value string) bool {
	if !utf8.ValidString(value) {
		return false
	}

	for _, char := range value {
		if unicode.IsControl(char) {
			return false
		}
	}

	return true
}

// OpenAICompatible implements Provider for an OpenAI-compatible Chat Completions endpoint.
type OpenAICompatible struct {
	completions openai.ChatCompletionService
}

// NewOpenAICompatible creates a reusable OpenAI-compatible provider client.
func NewOpenAICompatible(config *OpenAICompatibleConfig) (*OpenAICompatible, error) {
	if config == nil {
		return nil, errInvalidOpenAICompatibleBaseURL
	}

	if err := validateOpenAICompatibleBaseURL(config.baseURL); err != nil {
		return nil, err
	}

	if err := validateOpenAICompatibleHeaders(config.headers); err != nil {
		return nil, err
	}

	client := &http.Client{
		Transport: nil,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errOpenAICompatibleRedirect
		},
		Jar:     nil,
		Timeout: 0,
	}
	options := []option.RequestOption{
		option.WithBaseURL(config.baseURL),
		option.WithHTTPClient(client),
	}

	headerNames := make([]string, 0, len(config.headers))
	for name := range config.headers {
		headerNames = append(headerNames, name)
	}

	slices.Sort(headerNames)

	for _, name := range headerNames {
		options = append(options, option.WithHeader(name, config.headers[name]))
	}

	return &OpenAICompatible{
		completions: openai.NewChatCompletionService(options...),
	}, nil
}

// StreamResponse streams a request through the configured OpenAI-compatible
// Chat Completions endpoint.
func (o *OpenAICompatible) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	return streamOpenAIResponse(
		ctx,
		&o.completions,
		request,
		mapOpenAICompatibleError,
	)
}

func mapOpenAICompatibleError(_ error, response *http.Response) error {
	if response != nil && response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf(
			"%w: HTTP status %d",
			errOpenAICompatibleRequest,
			response.StatusCode,
		)
	}

	return errOpenAICompatibleRequest
}
