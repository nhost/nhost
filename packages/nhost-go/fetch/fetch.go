// Package fetch provides the HTTP pipeline shared by the generated and
// hand-written Nhost clients.
//
// The pipeline mirrors @nhost/nhost-js's fetch module: a chain of middleware
// functions wraps a base fetch backed by an *http.Client. Each middleware can
// inspect/modify the outgoing *http.Request and the returned *http.Response,
// which is how session refresh, access-token attachment, and role/header
// injection are implemented.
package fetch

import (
	"encoding/json"
	"io"
	"net/http"
	"slices"
	"strings"
)

// FetchFunc takes a prepared request and returns a response. The name mirrors
// the equivalent type across the Nhost SDKs (nhost-js / nhost-python).
type FetchFunc func(req *http.Request) (*http.Response, error) //nolint:revive // cross-SDK name parity

// ChainFunction takes the next fetch in the chain and returns a wrapping fetch.
type ChainFunction func(next FetchFunc) FetchFunc

// CreateEnhancedFetch composes chainFunctions around a base fetch backed by
// client. The chain executes in slice order: the first middleware wraps the
// second, and so on, with the base fetch (client.Do) at the center. This
// matches the reduceRight composition used by the JS SDK.
func CreateEnhancedFetch(client *http.Client, chainFunctions []ChainFunction) FetchFunc {
	if client == nil {
		client = &http.Client{} //nolint:exhaustruct
	}

	fetch := FetchFunc(func(req *http.Request) (*http.Response, error) {
		return client.Do(req) //nolint:gosec // the SDK issues requests to caller-provided URLs by design
	})

	for _, chainFunction := range slices.Backward(chainFunctions) {
		fetch = chainFunction(fetch)
	}

	return fetch
}

// FetchResponse is a structured API response: the parsed body plus status and
// headers.
type FetchResponse[T any] struct { //nolint:revive // cross-SDK name parity
	Body    T
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

// FetchError is returned when a request completes with a non-2xx/3xx status.
// It carries the parsed response Body, Status code, and Headers.
type FetchError struct { //nolint:revive // cross-SDK name parity
	Body    any
	Status  int
	Headers http.Header
	message string
}

func (e *FetchError) Error() string {
	return e.message
}

// NewFetchError builds a FetchError, extracting a human-readable message from
// common Nhost error response shapes.
func NewFetchError(body any, status int, headers http.Header) *FetchError {
	return &FetchError{
		Body:    body,
		Status:  status,
		Headers: headers,
		message: extractMessage(body),
	}
}

// NewFetchErrorFromResponse builds a FetchError from an error response.
func NewFetchErrorFromResponse(response *http.Response) *FetchError {
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

	return NewFetchError(body, response.StatusCode, response.Header)
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
