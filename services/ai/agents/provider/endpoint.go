package provider

import (
	"context"
	"log/slog"

	"github.com/nhost/nhost/services/ai/internal/providerconfig"
)

var (
	errInvalidProviderBaseURL = providerconfig.ErrInvalidBaseURL
	errInvalidProviderHeaders = providerconfig.ErrInvalidHeaders
)

type endpointConfiguration struct {
	baseURL string
	headers map[string]string
}

func newEndpointConfiguration(
	baseURL string,
	headers map[string]string,
	validateAdapterURL func(string) error,
	forbiddenHeaderPrefixes []string,
	forbiddenHeaders map[string]struct{},
) (endpointConfiguration, error) {
	endpoint, err := providerconfig.NewEndpoint(
		baseURL,
		headers,
		validateAdapterURL,
		forbiddenHeaderPrefixes,
		forbiddenHeaders,
	)
	if err != nil {
		return endpointConfiguration{}, err //nolint:wrapcheck // Preserve the adapter error-string contract.
	}

	return endpointConfiguration{baseURL: endpoint.BaseURL, headers: endpoint.Headers}, nil
}

func logProviderError(ctx context.Context, message string, err error, redactions []string) {
	slog.ErrorContext(
		ctx,
		message,
		slog.String("error", providerconfig.ErrorLogValue(err, redactions)),
	)
}
