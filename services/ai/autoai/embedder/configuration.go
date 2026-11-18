package embedder

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/nhost/services/ai/internal/providerconfig"
)

// ErrInvalidConfiguration identifies invalid provider declarations.
var ErrInvalidConfiguration = errors.New("invalid embedding provider configuration")

const (
	openAIType = "openai_embeddings"
	voyageType = "voyage_embeddings"
	geminiType = "google_gemini_embeddings"
)

// LegacyOpenAI supplies deprecated OpenAI credentials.
type LegacyOpenAI struct {
	APIKey       string
	Organization string
}

// BuildResult reports safe startup metadata without exposing credentials.
type BuildResult struct {
	Registry          Registry
	Types             map[string]string
	LegacySynthesized bool
	LegacyIgnored     bool
}

type configuredEndpoint struct {
	endpoint providerconfig.Endpoint
	adapter  string
}

// Option configures HTTP execution without changing declared endpoints or headers.
type Option func(*buildOptions)

type buildOptions struct{ transport http.RoundTripper }

// WithTransport supplies the transport for all embedders. Redirects remain forbidden.
// A nil transport uses the default HTTP transport.
func WithTransport(transport http.RoundTripper) Option {
	return func(options *buildOptions) { options.transport = transport }
}

// BuildConfiguredEmbedders validates declarations atomically; an explicit openai
// name wins over the legacy key, even when it selects a different adapter.
func BuildConfiguredEmbedders(
	raw string,
	legacy *LegacyOpenAI,
	opts ...Option,
) (BuildResult, error) {
	declarations, err := providerconfig.Parse(raw, ErrInvalidConfiguration, lookupConfiguration)
	if err != nil {
		return BuildResult{}, fmt.Errorf("configure embedders: %w", err)
	}

	options := buildOptions{transport: nil}
	for _, option := range opts {
		option(&options)
	}

	result := BuildResult{
		Registry:          make(Registry),
		Types:             make(map[string]string),
		LegacySynthesized: false,
		LegacyIgnored:     false,
	}
	for _, declaration := range declarations {
		result.Registry[declaration.Name] = newAdapter(declaration.Configuration, options.transport)
		result.Types[declaration.Name] = declaration.Type
	}

	if err := result.addLegacy(legacy, options.transport); err != nil {
		return BuildResult{}, err
	}

	return result, nil
}

func (r *BuildResult) addLegacy(legacy *LegacyOpenAI, transport http.RoundTripper) error {
	if legacy == nil || legacy.APIKey == "" {
		return nil
	}

	if _, ok := r.Registry["openai"]; ok {
		r.LegacyIgnored = true
		return nil
	}

	headers := map[string]string{"Authorization": "Bearer " + legacy.APIKey}
	if legacy.Organization != "" {
		headers["OpenAI-Organization"] = legacy.Organization
	}

	constructor, _ := lookupConfiguration(openAIType)

	endpoint, err := constructor("https://api.openai.com/v1", headers)
	if err != nil {
		return fmt.Errorf(
			"configure legacy embedder: %w",
			providerconfig.NewError(ErrInvalidConfiguration, -1, "", "invalid legacy headers"),
		)
	}

	r.Registry["openai"] = newAdapter(endpoint, transport)
	r.Types["openai"] = openAIType
	r.LegacySynthesized = true

	return nil
}

func lookupConfiguration(
	adapter string,
) (func(string, map[string]string) (configuredEndpoint, error), bool) {
	var (
		validator func(string) error
		forbidden map[string]struct{}
	)
	switch adapter {
	case openAIType:
		validator = validateOpenAIURL
	case voyageType:
		validator = validateVoyageURL
	case geminiType:
		validator = validateGeminiURL
		forbidden = map[string]struct{}{
			"user-agent":        {},
			"x-goog-api-client": {},
			"x-server-timeout":  {},
		}
	default:
		return nil, false
	}

	return func(base string, headers map[string]string) (configuredEndpoint, error) {
		endpoint, err := providerconfig.NewEndpoint(base, headers, validator, nil, forbidden)
		if err != nil {
			return configuredEndpoint{}, fmt.Errorf("configure embedding endpoint: %w", err)
		}

		return configuredEndpoint{endpoint: endpoint, adapter: adapter}, nil
	}, true
}

func rejectSuffix(base string, suffixes ...string) error {
	parsed, err := url.Parse(base)
	if err != nil {
		return providerconfig.ErrInvalidBaseURL
	}

	path := strings.TrimRight(parsed.Path, "/")
	for _, suffix := range suffixes {
		if strings.HasSuffix(path, suffix) {
			return providerconfig.ErrInvalidBaseURL
		}
	}

	return nil
}
func validateOpenAIURL(base string) error { return rejectSuffix(base, "/embeddings") }
func validateVoyageURL(base string) error { return rejectSuffix(base, "/v1", "/embeddings") }
func validateGeminiURL(base string) error {
	parsed, err := url.Parse(base)
	if err != nil || strings.Contains(parsed.Path, "/models/") {
		return providerconfig.ErrInvalidBaseURL
	}

	return rejectSuffix(base, "/v1beta", "/models", ":batchEmbedContents", ":embedContent")
}
