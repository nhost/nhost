package action

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/action/transform"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
	"golang.org/x/net/http/httpguts"
)

const (
	defaultTimeoutSeconds      = 30
	defaultMaxRequestBodyBytes = 10 << 20
	defaultMaxResponseBytes    = 10 << 20
)

// clientHeadersIgnored is the list of client headers Hasura does not forward
// to action webhooks. x-hasura-* is handled separately so raw client headers
// cannot override the resolved session_variables payload.
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

// HTTPDoer is the HTTP-transport boundary for synchronous action webhooks.
// Production callers pass nil to New and receive the hardened default client;
// tests can use the generated mock in the mock/ subpackage.
//
//go:generate mockgen -package mock -destination mock/http_doer.go . HTTPDoer
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type httpClient struct {
	doer                 HTTPDoer
	maxRequestBodyBytes  int64
	maxResponseBodyBytes int64
}

func newHTTPClient(doer HTTPDoer) *httpClient {
	if doer == nil {
		doer = &http.Client{ //nolint:exhaustruct
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}

	return &httpClient{
		doer:                 doer,
		maxRequestBodyBytes:  defaultMaxRequestBodyBytes,
		maxResponseBodyBytes: defaultMaxResponseBytes,
	}
}

func validateActionURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("parsing URL: %w", err)
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%w %q (want http or https)", errUnsupportedURLScheme, parsed.Scheme)
	}

	if parsed.Host == "" {
		return fmt.Errorf("%w: %q", errURLMissingHost, raw)
	}

	return nil
}

func buildActionHeaders(action metadata.ActionMetadata) (map[string]string, error) {
	headers := make(map[string]string, len(action.Definition.Headers))

	for _, header := range action.Definition.Headers {
		if !httpguts.ValidHeaderFieldName(header.Name) {
			return nil, fmt.Errorf("%w %q", errInvalidActionHeaderName, header.Name)
		}

		value := header.Value
		if header.ValueFromEnv != "" {
			var ok bool

			value, ok = os.LookupEnv(header.ValueFromEnv)
			if !ok {
				return nil, fmt.Errorf(
					"resolving header %q: %w: %s",
					header.Name,
					metadata.ErrUnresolvedEnvVars,
					header.ValueFromEnv,
				)
			}
		}

		if !httpguts.ValidHeaderFieldValue(value) {
			return nil, fmt.Errorf("%w for %q", errInvalidActionHeaderValue, header.Name)
		}

		headers[header.Name] = value
	}

	return headers, nil
}

func applyClientHeaders(headers http.Header, clientHeaders http.Header) {
	if host := clientHeaders.Get("Host"); host != "" {
		headers.Set("X-Forwarded-Host", host)
	}

	if userAgent := clientHeaders.Get("User-Agent"); userAgent != "" {
		headers.Set("X-Forwarded-User-Agent", userAgent)
	}

	if origin := clientHeaders.Get("Origin"); origin != "" {
		headers.Set("X-Forwarded-Origin", origin)
	}

	for name, values := range clientHeaders {
		if _, ignored := clientHeadersIgnored[http.CanonicalHeaderKey(name)]; ignored {
			continue
		}

		if strings.HasPrefix(strings.ToLower(name), "x-hasura-") {
			continue
		}

		for _, value := range values {
			headers.Add(name, value)
		}
	}
}

func (h *httpClient) buildRequestModel(
	action runtimeAction,
	payload actionPayload,
	clientHeaders http.Header,
) (transform.OutgoingRequest, error) {
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return transform.OutgoingRequest{}, fmt.Errorf("marshaling action request: %w", err)
	}

	requestModel := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    action.url,
		Header: make(http.Header),
		Body:   jsonBody,
	}

	if action.forwardClientHeaders && clientHeaders != nil {
		applyClientHeaders(requestModel.Header, clientHeaders)
	}

	requestModel.Header.Set("Content-Type", "application/json")

	for name, value := range action.headers {
		requestModel.Header.Set(name, value)
	}

	if action.requestTransform != nil {
		if err := action.requestTransform.Apply(
			transform.RequestContext{
				Body:             payload,
				BaseURL:          action.url,
				SessionVariables: payload.SessionVariables,
			},
			&requestModel,
		); err != nil {
			return transform.OutgoingRequest{}, fmt.Errorf("applying request transform: %w", err)
		}
	}

	if err := validateActionURL(requestModel.URL); err != nil {
		return transform.OutgoingRequest{}, fmt.Errorf("invalid transformed action URL: %w", err)
	}

	return requestModel, nil
}

func (h *httpClient) do(
	ctx context.Context,
	action runtimeAction,
	payload actionPayload,
	clientHeaders http.Header,
) ([]byte, int, error) {
	requestModel, err := h.buildRequestModel(action, payload, clientHeaders)
	if err != nil {
		return nil, 0, err
	}

	if int64(len(requestModel.Body)) > h.maxRequestBodyBytes {
		return nil, 0, errActionRequestBodyTooLarge
	}

	ctx, cancel := context.WithTimeout(ctx, action.timeout)
	defer cancel()

	var bodyReader io.Reader
	if requestModel.Body != nil {
		bodyReader = bytes.NewReader(requestModel.Body)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		requestModel.Method,
		requestModel.URL,
		bodyReader,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("creating action request: %w", err)
	}

	req.Header = requestModel.Header.Clone()

	resp, err := h.doer.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("performing action request: %w", err)
	}
	defer resp.Body.Close()

	// Forward Set-Cookie response headers to the GraphQL client, mirroring
	// Hasura's mkSetCookieHeaders. Done before reading the body so it applies
	// regardless of the action's success/error status. A nil collector (no sink
	// installed) is a no-op.
	requestcontext.ResponseHeaderCollectorFromContext(ctx).AddSetCookies(resp.Header)

	body, err := readLimited(resp.Body, h.maxResponseBodyBytes)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	body, err = h.applyResponseTransform(action, payload, resp, body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	return body, resp.StatusCode, nil
}

// applyResponseTransform runs the action's response transform (if any) over the
// webhook body, enforcing the response size cap on the transformed output.
// Returns the body unchanged when no response transform is configured.
func (h *httpClient) applyResponseTransform(
	action runtimeAction,
	payload actionPayload,
	resp *http.Response,
	body []byte,
) ([]byte, error) {
	if action.responseTransform == nil {
		return body, nil
	}

	transformed, err := action.responseTransform.Apply(
		transform.ResponseContext{
			BaseURL:          action.url,
			SessionVariables: payload.SessionVariables,
			Status:           resp.StatusCode,
			Headers:          resp.Header,
		},
		body,
	)
	if err != nil {
		return nil, fmt.Errorf("applying response transform: %w", err)
	}

	if int64(len(transformed)) > h.maxResponseBodyBytes {
		return nil, errActionResponseTooLarge
	}

	return transformed, nil
}

func readLimited(body io.Reader, limit int64) ([]byte, error) {
	limited := io.LimitReader(body, limit+1)

	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("reading action response: %w", err)
	}

	if int64(len(data)) > limit {
		return nil, errActionResponseTooLarge
	}

	return data, nil
}
