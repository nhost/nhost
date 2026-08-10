package remoteschema

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
)

// clientHeadersIgnored is the list of headers that must not be forwarded to
// the remote schema endpoint. This matches Hasura's remote-schema
// header-forwarding rules — see
// https://hasura.io/docs/2.0/remote-schemas/quickstart/#header-forwarding
// for the upstream definition.
var clientHeadersIgnored = map[string]struct{}{ //nolint:gochecknoglobals
	"Content-Length":    {},
	"Content-Md5":       {},
	"User-Agent":        {},
	"Host":              {},
	"Origin":            {},
	"Referer":           {},
	"Accept":            {},
	"Accept-Encoding":   {},
	"Accept-Language":   {},
	"Accept-Datetime":   {},
	"Cache-Control":     {},
	"Connection":        {},
	"Dnt":               {},
	"Content-Type":      {},
	"Transfer-Encoding": {},
}

// HTTPDoer is the HTTP-transport boundary for the remote schema connector.
// Production callers pass nil to New and receive the default *http.Client;
// the mock subpackage targets this interface via mockgen so tests can drive
// the wire without a real server.
//
//go:generate mockgen -package mock -destination mock/http_doer.go . HTTPDoer
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// httpClient handles HTTP requests to the remote GraphQL endpoint.
type httpClient struct {
	url     string
	headers map[string]string
	client  HTTPDoer
}

// applyClientHeaders forwards client headers to the request following the
// Hasura remote-schema header-forwarding rules
// (https://hasura.io/docs/2.0/remote-schemas/quickstart/#header-forwarding):
//   - Headers in clientHeadersIgnored (Content-Length, Host, …) are dropped.
//   - x-hasura-* headers are filtered out; they are produced from session
//     variables in the caller and re-applied separately.
//   - X-Forwarded-* headers are synthesised from Host, User-Agent, and Origin.
func applyClientHeaders(req *http.Request, clientHeaders http.Header) {
	if host := clientHeaders.Get("Host"); host != "" {
		req.Header.Set("X-Forwarded-Host", host)
	}

	if userAgent := clientHeaders.Get("User-Agent"); userAgent != "" {
		req.Header.Set("X-Forwarded-User-Agent", userAgent)
	}

	if origin := clientHeaders.Get("Origin"); origin != "" {
		req.Header.Set("X-Forwarded-Origin", origin)
	}

	for name, values := range clientHeaders {
		if _, ignored := clientHeadersIgnored[http.CanonicalHeaderKey(name)]; ignored {
			continue
		}

		if strings.HasPrefix(strings.ToLower(name), "x-hasura-") {
			continue
		}

		for _, value := range values {
			req.Header.Add(name, value)
		}
	}
}

// do executes an HTTP POST request with the given body and returns the response body.
// Headers are applied in this priority order (highest first):
// 1. Configured headers (from remote schema definition)
// 2. Session variables as headers (x-hasura-*)
// 3. Client headers (if forward_client_headers is enabled).
func (h *httpClient) do(
	ctx context.Context,
	body any,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) ([]byte, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if clientHeaders != nil {
		applyClientHeaders(req, clientHeaders)
	}

	for name, value := range sessionVariables {
		req.Header.Set(name, fmt.Sprintf("%v", value))
	}

	req.Header.Set("Content-Type", "application/json")

	for name, value := range h.headers {
		req.Header.Set(name, value)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Never echo the upstream body into the client-facing error: it can
		// carry internal hostnames, stack traces, or framework error pages.
		// Retain the full detail server-side for debugging instead.
		oapimw.LoggerFromContext(ctx).ErrorContext(
			ctx,
			"remote schema returned non-200 status",
			slog.String("url", h.url),
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(respBody)),
		)

		return nil, fmt.Errorf("%w %d", ErrRemoteStatus, resp.StatusCode)
	}

	return respBody, nil
}
