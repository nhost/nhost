package oauth1

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"time"
)

var ErrRequestFailed = errors.New("request failed")

const defaultTimeout = 10 * time.Second

// GetOptions contains options for OAuth 1.0a GET requests.
type GetOptions struct {
	URL         string
	OAuthToken  string
	TokenSecret string
	Headers     map[string]string
	Params      map[string]string
	Timeout     time.Duration
}

// PostFormOptions contains options for OAuth 1.0a POST requests that return form data.
type PostFormOptions struct {
	URL         string
	OAuthToken  string
	TokenSecret string
	Headers     map[string]string
	Params      map[string]string
	Body        io.Reader
	Timeout     time.Duration
}

// GetJSON performs an OAuth 1.0a signed GET request and decodes the JSON response.
func (c *Config) GetJSON(ctx context.Context, opts GetOptions, result any) error {
	if opts.Timeout == 0 {
		opts.Timeout = defaultTimeout
	}

	headers := make(map[string]string)
	maps.Copy(headers, opts.Headers)
	headers["Accept"] = "application/json"

	resp, err := c.SignedRequest(ctx, SignedRequestOptions{ //nolint:exhaustruct
		Method:      http.MethodGet,
		URL:         opts.URL,
		OAuthToken:  opts.OAuthToken,
		TokenSecret: opts.TokenSecret,
		Headers:     headers,
		ExtraParams: opts.Params,
		Timeout:     opts.Timeout,
	})
	if err != nil {
		return fmt.Errorf("failed to make GET request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%w: status %d: %s", ErrRequestFailed, resp.StatusCode, string(body))
	}

	if result == nil {
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

// PostForm performs an OAuth 1.0a signed POST request and returns the form-encoded response as url.Values.
func (c *Config) PostForm(ctx context.Context, opts PostFormOptions) (url.Values, error) {
	if opts.Timeout == 0 {
		opts.Timeout = defaultTimeout
	}

	headers := make(map[string]string)
	maps.Copy(headers, opts.Headers)

	resp, err := c.SignedRequest(ctx, SignedRequestOptions{ //nolint:exhaustruct
		Method:      http.MethodPost,
		URL:         opts.URL,
		Body:        opts.Body,
		OAuthToken:  opts.OAuthToken,
		TokenSecret: opts.TokenSecret,
		Headers:     headers,
		ExtraParams: opts.Params,
		Timeout:     opts.Timeout,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to make POST request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: status %d: %s", ErrRequestFailed, resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fmt.Errorf("failed to parse form response: %w", err)
	}

	return values, nil
}
