package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/auth/go/safehttp"
)

const fetchProfileTimeout = 10 * time.Second

type RequestInterceptor func(*http.Request) error

func WithHeaders(headers map[string]string) RequestInterceptor {
	return func(req *http.Request) error {
		for key, value := range headers {
			req.Header.Set(key, value)
		}

		return nil
	}
}

func fetchOAuthProfile(
	ctx context.Context,
	url string,
	accessToken string,
	result any,
	interceptors ...RequestInterceptor,
) error {
	client := &http.Client{ //nolint:exhaustruct
		Timeout: fetchProfileTimeout,
	}

	return fetchOAuthProfileWithClient(ctx, client, url, accessToken, result, interceptors...)
}

// fetchOAuthProfileWithClient is fetchOAuthProfile with a caller-supplied
// client — custom providers pass a hardened (SSRF-safe) client because their
// userinfo URL is owner-supplied rather than hardcoded.
func fetchOAuthProfileWithClient(
	ctx context.Context,
	client *http.Client,
	url string,
	accessToken string,
	result any,
	interceptors ...RequestInterceptor,
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	// Apply request interceptors
	for _, interceptor := range interceptors {
		if err := interceptor(req); err != nil {
			return fmt.Errorf("error applying request interceptor: %w", err)
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error making API request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := safehttp.ReadAllLimited(resp.Body, safehttp.DefaultMaxResponseSize)

		return fmt.Errorf( //nolint:err113
			"API error (status %d): %s", resp.StatusCode, string(body),
		)
	}

	b, err := safehttp.ReadAllLimited(resp.Body, safehttp.DefaultMaxResponseSize)
	if err != nil {
		return fmt.Errorf("error reading response body: %w", err)
	}

	if err := json.Unmarshal(b, result); err != nil {
		return fmt.Errorf("error unmarshalling response data: %w", err)
	}

	return nil
}
