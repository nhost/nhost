// Package transport provides the HTTP middleware shared by the generated and
// hand-written Nhost clients.
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
	"errors"
	"io"
	"net/http"
	"strings"
)

const defaultMaxRedirects = 10

var errTooManyRedirects = errors.New("stopped after 10 redirects")

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
// different host; redirects otherwise retain the base client's behavior.
func NewHTTPClient(base *http.Client, middleware ...Middleware) *http.Client {
	var client http.Client
	if base != nil {
		client = *base
	}

	checkRedirect := client.CheckRedirect
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		var err error
		if checkRedirect != nil {
			err = checkRedirect(req, via)
		} else if len(via) >= defaultMaxRedirects {
			err = errTooManyRedirects
		}

		if len(via) > 0 && !strings.EqualFold(req.URL.Host, via[0].URL.Host) {
			req.Header.Del("Authorization")
			req.Header.Del("x-hasura-admin-secret")
		}

		return err
	}
	client.Transport = Chain(client.Transport, middleware...)

	return &client
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
		return err //nolint:wrapcheck
	}

	if len(data) == 0 {
		return nil
	}

	return json.Unmarshal(data, v) //nolint:wrapcheck
}

// APIError is returned when a request completes with a non-2xx/3xx status. It
// carries the parsed response Body, Status code, and Headers.
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

// NewAPIError builds an APIError, extracting a human-readable message from
// common Nhost error response shapes.
func NewAPIError(body any, status int, headers http.Header) *APIError {
	return &APIError{
		Body:    body,
		Status:  status,
		Headers: headers,
		message: extractMessage(body),
	}
}

// NewAPIErrorFromResponse builds an APIError from an error response.
func NewAPIErrorFromResponse(response *http.Response) *APIError {
	var body any

	if response.StatusCode != http.StatusPreconditionFailed {
		data, err := io.ReadAll(response.Body)
		if err == nil && len(data) > 0 {
			var parsed any
			if json.Unmarshal(data, &parsed) == nil {
				body = parsed
			} else {
				body = string(data)
			}
		}
	}

	return NewAPIError(body, response.StatusCode, response.Header)
}

// extractMessage is a best-effort extraction of a human-readable message from
// an error body.
func extractMessage(body any) string {
	switch b := body.(type) {
	case string:
		if b != "" {
			return b
		}
	case map[string]any:
		if msg, ok := b["message"].(string); ok {
			return msg
		}

		switch e := b["error"].(type) {
		case string:
			return e
		case map[string]any:
			if msg, ok := e["message"].(string); ok {
				return msg
			}
		}

		if errs, ok := b["errors"].([]any); ok {
			messages := make([]string, 0, len(errs))

			for _, item := range errs {
				if m, ok := item.(map[string]any); ok {
					if msg, ok := m["message"].(string); ok {
						messages = append(messages, msg)
					}
				}
			}

			if len(messages) > 0 {
				return strings.Join(messages, ", ")
			}
		}
	}

	return "An unexpected error occurred"
}
