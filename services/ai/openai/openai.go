package openai

import (
	"context"

	oai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

//go:generate mockgen -package mock -destination mock/embeddings_client.go --source=openai.go embeddingsClient
type embeddingsClient interface {
	New(
		ctx context.Context,
		params oai.EmbeddingNewParams,
		opts ...option.RequestOption,
	) (*oai.CreateEmbeddingResponse, error)
}

type Client struct {
	embeddings embeddingsClient
}

// New constructs an embeddings client pinned to OpenAI's production endpoint.
// Request options are applied last and must only contain trusted overrides.
func New(apiKey, organization string, opts ...option.RequestOption) *Client {
	options := []option.RequestOption{
		option.WithBaseURL("https://api.openai.com/v1/"),
		option.WithAPIKey(apiKey),
	}
	if organization != "" {
		options = append(options, option.WithOrganization(organization))
	}

	options = append(options, opts...)

	embeddings := oai.NewEmbeddingService(options...)

	return &Client{
		embeddings: &embeddings,
	}
}
