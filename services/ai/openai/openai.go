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

func New(apiKey, organization string) *Client {
	options := []option.RequestOption{option.WithAPIKey(apiKey)}
	if organization != "" {
		options = append(options, option.WithOrganization(organization))
	}

	client := oai.NewClient(options...)

	return &Client{
		embeddings: &client.Embeddings,
	}
}
