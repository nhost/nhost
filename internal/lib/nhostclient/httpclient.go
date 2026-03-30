package nhostclient

import (
	"io"
	"net/http"
	"time"
)

const (
	DefaultMaxRetries = 3
	DefaultBaseDelay  = 2 * time.Second
)

// RetryDoer wraps an HTTP client with retry logic for transient failures.
// It implements auth.HttpRequestDoer and can be passed to the generated
// clients via WithHTTPClient.
type RetryDoer struct {
	client     HTTPClient
	maxRetries int
	baseDelay  time.Duration
}

// HTTPClient is the interface satisfied by *http.Client. It covers both
// the oapi-codegen generated clients (Do) and the gqlgenc GraphQL client
// (Do + Post).
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
	Post(url, contentType string, body io.Reader) (*http.Response, error)
}

type RetryDoerOption func(*RetryDoer)

func WithMaxRetries(n int) RetryDoerOption {
	return func(r *RetryDoer) {
		r.maxRetries = n
	}
}

func WithBaseDelay(d time.Duration) RetryDoerOption {
	return func(r *RetryDoer) {
		r.baseDelay = d
	}
}

// NewRetryDoer creates an HTTP client wrapper that retries on transport
// errors with linear backoff. If client is nil, http.DefaultClient is used.
func NewRetryDoer(client HTTPClient, opts ...RetryDoerOption) *RetryDoer {
	if client == nil {
		client = http.DefaultClient
	}

	r := &RetryDoer{
		client:     client,
		maxRetries: DefaultMaxRetries,
		baseDelay:  DefaultBaseDelay,
	}

	for _, opt := range opts {
		opt(r)
	}

	return r
}

func (r *RetryDoer) Do(req *http.Request) (*http.Response, error) {
	resp, err := r.client.Do(req)
	if err == nil {
		return resp, nil
	}

	for i := range r.maxRetries {
		time.Sleep(time.Duration(i+1) * r.baseDelay)

		resp, err = r.client.Do(req)
		if err == nil {
			return resp, nil
		}
	}

	return resp, err
}

func (r *RetryDoer) Post(
	url, contentType string,
	body io.Reader,
) (*http.Response, error) {
	resp, err := r.client.Post(url, contentType, body)
	if err == nil {
		return resp, nil
	}

	for i := range r.maxRetries {
		time.Sleep(time.Duration(i+1) * r.baseDelay)

		resp, err = r.client.Post(url, contentType, body)
		if err == nil {
			return resp, nil
		}
	}

	return resp, err
}
