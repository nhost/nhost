package mintlify

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const configURL = "https://leaves.mintlify.com/api/mcp/config/nhost"

type ConfigResponse struct {
	Name            string   `json:"name"`
	TrieveDatasetID string   `json:"trieveDatasetId"`
	TrieveAPIKey    string   `json:"trieveApiKey"`
	Tools           []Tools  `json:"tools"`
	OpenAPIUrls     []string `json:"openApiUrls"`
}
type Tool struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}
type Tools struct {
	Tool Tool `json:"tool"`
}

func GetMcpConfig(ctx context.Context) (*ConfigResponse, error) {
	client := &http.Client{ //nolint:exhaustruct
		Timeout: 10 * time.Second, //nolint:mnd
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode) //nolint:err113
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Parse the JSON response
	var config ConfigResponse
	if err := json.Unmarshal(body, &config); err != nil {
		return nil, fmt.Errorf("error parsing JSON response: %w", err)
	}

	return &config, nil
}
