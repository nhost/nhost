package nhostclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

type (
	ResponseValidator func(resp *http.Response) error
)

func MakeJSONRequest(
	ctx context.Context,
	client *http.Client,
	url string,
	method string,
	requestBody any,
	headers http.Header,
	response any,
	responseValidator ResponseValidator,
	retryer BasicRetryer,
) error {
	return retryer.Retry(func(attempt int) error {
		b, err := json.Marshal(requestBody)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}

		body := io.NopCloser(bytes.NewReader(b))

		req, err := http.NewRequestWithContext(ctx, method, url, body)
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}

		req.Header = headers
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Request-Attempt", strconv.Itoa(attempt))

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to make request: %w", err)
		}

		if responseValidator != nil {
			if err := responseValidator(resp); err != nil {
				return fmt.Errorf("request validation failed: %w", err)
			}
		}

		defer resp.Body.Close()

		b, err = io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read response body: %w", err)
		}

		if err := json.Unmarshal(b, &response); err != nil {
			return fmt.Errorf("failed to unmarshal response body: %w", err)
		}

		return nil
	})
}
