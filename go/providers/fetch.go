package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
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

	client := &http.Client{ //nolint:exhaustruct
		Timeout: fetchProfileTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error making API request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf( //nolint:goerr113
			"API error (status %d): %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("error parsing response data: %w", err)
	}

	return nil
}
