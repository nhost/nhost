// Package transport provides the HTTP middleware shared by the generated and
// hand-written Nhost clients, along with the service-URL helpers
// ([IsLoopbackHost], [NormalizeServiceURL]) that decide whether a credential
// may travel in cleartext. Those helpers live here so the nhost and middleware
// packages share one implementation of that rule rather than each carrying a
// copy that can drift.
//
// Middleware is modelled as an [http.RoundTripper] decorator: each Middleware
// wraps the next RoundTripper in the chain and may inspect or modify the
// outgoing *http.Request and the returned *http.Response. Session refresh,
// access-token attachment, and role/header injection are all implemented this
// way. The composed RoundTripper is installed as an [http.Client.Transport],
// so the service clients issue requests with the standard [http.Client.Do].
package transport

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	defaultAPIErrorMessage  = "An unexpected error occurred"
	defaultMaxRedirects     = 10
	maxAPIErrorMessageRunes = 1024
)

var errTooManyRedirects = fmt.Errorf("stopped after %d redirects", defaultMaxRedirects)

// IsLoopbackHost reports whether hostname identifies localhost or a loopback
// IP address.
func IsLoopbackHost(hostname string) bool {
	if strings.EqualFold(hostname, "localhost") {
		return true
	}

	ip := net.ParseIP(hostname)

	return ip != nil && ip.IsLoopback()
}

// NormalizeServiceURL adds a scheme to a scheme-less service URL, choosing
// HTTP for loopback hosts and HTTPS otherwise. URLs that already have a scheme,
// or cannot be parsed as an authority, are returned unchanged.
func NormalizeServiceURL(serviceURL string) string {
	if strings.Contains(serviceURL, "://") {
		return serviceURL
	}

	parsed, err := url.Parse("//" + serviceURL)
	if err != nil || parsed.Host == "" {
		return serviceURL
	}

	scheme := "https"
	if IsLoopbackHost(parsed.Hostname()) {
		scheme = "http"
	}

	return scheme + "://" + serviceURL
}

// RoundTripFunc adapts an ordinary function to an [http.RoundTripper].
type RoundTripFunc func(req *http.Request) (*http.Response, error)

// RoundTrip implements [http.RoundTripper].
func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

// Middleware wraps a RoundTripper with additional behaviour, returning a
// RoundTripper that typically calls through to next.
type Middleware func(next http.RoundTripper) http.RoundTripper

// Chain composes middleware around base. The middleware execute in argument
// order: the first wraps the second, and so on, with base at the centre. A nil
// base defaults to [http.DefaultTransport].
func Chain(base http.RoundTripper, middleware ...Middleware) http.RoundTripper {
	if base == nil {
		base = http.DefaultTransport
	}

	for i := len(middleware) - 1; i >= 0; i-- {
		base = middleware[i](base)
	}

	return base
}

// NewHTTPClient returns a copy of base whose Transport applies middleware. base
// may be nil, in which case a zero-value client (using
// [http.DefaultTransport]) is wrapped. The original base is never mutated, so
// callers may share one *http.Client across services with distinct middleware.
// Sensitive Nhost credentials are stripped before following a redirect to a
// different origin; redirects otherwise retain the base client's behavior.
func NewHTTPClient(base *http.Client, middleware ...Middleware) *http.Client {
	var client http.Client
	if base != nil {
		client = *base
	}

	checkRedirect := client.CheckRedirect
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if checkRedirect != nil {
			if err := checkRedirect(req, via); err != nil {
				return err
			}
		} else if len(via) >= defaultMaxRedirects {
			return errTooManyRedirects
		}

		if len(via) > 0 && !sameOrigin(req.URL, via[0].URL) {
			req.Header.Del("Authorization")
			req.Header.Del("x-hasura-admin-secret")
		}

		return nil
	}
	client.Transport = Chain(client.Transport, middleware...)

	return &client
}

func sameOrigin(left, right *url.URL) bool {
	return strings.EqualFold(left.Scheme, right.Scheme) &&
		strings.EqualFold(left.Host, right.Host)
}

// Response carries the HTTP metadata returned alongside a decoded body.
type Response struct {
	Status  int
	Headers http.Header
}

// DecodeJSON reads response and unmarshals its body into v. It is a no-op for
// no-content statuses and empty bodies, leaving v at its zero value.
func DecodeJSON(response *http.Response, v any) error {
	switch response.StatusCode {
	case http.StatusNoContent, http.StatusResetContent, http.StatusNotModified:
		return nil
	}

	data, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read JSON response body: %w", err)
	}

	if len(data) == 0 {
		return nil
	}

	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("decode JSON response body: %w", err)
	}

	return nil
}

// APIError describes an API-level failure. It carries the parsed response
// Body, Status code, and Headers.
type APIError struct {
	Body    any
	Status  int
	Headers http.Header
	message string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return e.message
}

// NewAPIError builds an APIError. Its message prefers recognized structured
// body fields, then X-Error, then a plain-text body. Messages are normalized to
// one line and bounded in length; Body retains the original value.
func NewAPIError(body any, status int, headers http.Header) *APIError {
	message, ok := extractMessage(body, headers)
	if !ok {
		message = defaultAPIErrorMessage
	}

	return &APIError{
		Body:    body,
		Status:  status,
		Headers: headers,
		message: message,
	}
}

// NewAPIErrorFromResponse builds an APIError from an error response. It returns
// a transport error instead if the response body cannot be read.
func NewAPIErrorFromResponse(response *http.Response) error {
	data, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read API error response body: %w", err)
	}

	body := decodeErrorBody(data)

	return NewAPIError(body, response.StatusCode, response.Header)
}

func decodeErrorBody(data []byte) any {
	if len(data) == 0 {
		return nil
	}

	var body any
	if err := json.Unmarshal(data, &body); err != nil {
		return string(data)
	}

	return body
}

// extractMessage extracts a safe, non-empty human-readable message from a
// supported JSON-decoded error body or response header.
func extractMessage(body any, headers http.Header) (string, bool) {
	if object, ok := body.(map[string]any); ok {
		if message, ok := normalizedString(object["message"]); ok {
			return message, true
		}

		if message, ok := nestedErrorMessage(object["error"]); ok {
			return message, true
		}

		if message, ok := joinedErrorMessages(object["errors"]); ok {
			return message, true
		}
	}

	if message, ok := normalizeMessage(headers.Get("X-Error")); ok {
		return message, true
	}

	return normalizedString(body)
}

func nestedErrorMessage(value any) (string, bool) {
	if message, ok := normalizedString(value); ok {
		return message, true
	}

	object, ok := value.(map[string]any)
	if !ok {
		return "", false
	}

	return normalizedString(object["message"])
}

func joinedErrorMessages(value any) (string, bool) {
	errors, ok := value.([]any)
	if !ok {
		return "", false
	}

	messages := make([]string, 0, len(errors))

	for _, item := range errors {
		object, ok := item.(map[string]any)
		if !ok {
			continue
		}

		if message, ok := normalizedString(object["message"]); ok {
			messages = append(messages, message)
		}
	}

	if len(messages) == 0 {
		return "", false
	}

	return normalizeMessage(strings.Join(messages, ", "))
}

func normalizedString(value any) (string, bool) {
	message, ok := value.(string)
	if !ok {
		return "", false
	}

	return normalizeMessage(message)
}

func normalizeMessage(message string) (string, bool) {
	if !utf8.ValidString(message) {
		return "", false
	}

	message = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}

		return r
	}, message)

	message = strings.Join(strings.Fields(message), " ")
	if message == "" {
		return "", false
	}

	runes := []rune(message)
	if len(runes) > maxAPIErrorMessageRunes {
		message = string(runes[:maxAPIErrorMessageRunes-1]) + "…"
	}

	return message, true
}
