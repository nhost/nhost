package mintlify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AutocompleteRequest struct {
	Query          string `json:"query"`
	PageSize       int    `json:"page_size"`
	SearchType     string `json:"search_type"`
	ExtendResults  bool   `json:"extend_results"`
	ScoreThreshold int    `json:"score_treshold"`
}

type AutocompleteResponse struct {
	ScoreChunks     []ScoreChunk `json:"score_chunks"`
	CorrectedQuery  *string      `json:"corrected_query"`
	TotalChunkPages int          `json:"total_chunk_pages"`
}

type ScoreChunk struct {
	Metadata   []ChunkMetadata `json:"metadata"`
	Highlights *string         `json:"highlights"`
	Score      float64         `json:"score"`
}

type ChunkMetadata struct {
	ID         string      `json:"id"`
	Link       string      `json:"link"`
	CreatedAt  string      `json:"created_at"`
	UpdatedAt  string      `json:"updated_at"`
	ChunkHTML  string      `json:"chunk_html"`
	Metadata   DocMetadata `json:"metadata"`
	TrackingID *string     `json:"tracking_id"`
	TimeStamp  *string     `json:"time_stamp"`
	DatasetID  string      `json:"dataset_id"`
	Weight     float64     `json:"weight"`
	Location   *string     `json:"location"`
	ImageURLs  *string     `json:"image_urls"`
	TagSet     string      `json:"tag_set"`
	NumValue   *string     `json:"num_value"`
}

type DocMetadata struct {
	Breadcrumbs []string `json:"breadcrumbs"`
	Title       string   `json:"title"`
}

func (m *Mintlify) Autocomplete(
	ctx context.Context,
	body AutocompleteRequest,
) (*AutocompleteResponse, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request body: %w", err)
	}

	client := &http.Client{ //nolint:exhaustruct
		Timeout: 10 * time.Second, //nolint:mnd
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, apiBaseURL+"/api/chunk/autocomplete", bytes.NewBuffer(jsonBody),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Add required headers
	req.Header.Add("TR-Dataset", m.config.TrieveDatasetID)
	req.Header.Add("Authorization", m.config.TrieveAPIKey)
	req.Header.Add("Content-Type", "application/json")

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error executing request: %w", err)
	}
	defer resp.Body.Close()

	// Check the response status code
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)

		return nil, fmt.Errorf( //nolint:err113
			"unexpected status code: %d, body: %s", resp.StatusCode, string(bodyBytes),
		)
	}

	// Read the response body
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Parse the JSON response
	var autocompleteResp AutocompleteResponse
	if err := json.Unmarshal(b, &autocompleteResp); err != nil {
		return nil, fmt.Errorf("error parsing JSON response: %w", err)
	}

	for _, chunk := range autocompleteResp.ScoreChunks {
		for i, metadata := range chunk.Metadata {
			metadata.Link = nhostDocsBaseURL + "/" + metadata.Link
			chunk.Metadata[i] = metadata
		}
	}

	return &autocompleteResp, nil
}
