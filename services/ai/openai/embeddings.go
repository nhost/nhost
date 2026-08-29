package openai

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai/api"
)

func (cl *Client) EmbeddingsGenerate(
	ctx context.Context,
	object string,
	embeddingsModel string,
) (*model.GraphiteGenerateEmbeddingsResponse, error) {
	input := api.CreateEmbeddingRequest_Input{}
	if err := input.FromCreateEmbeddingRequestInput0(object); err != nil {
		return nil, fmt.Errorf("error creating input: %w", err)
	}

	m := api.CreateEmbeddingRequest_Model{}
	if err := m.FromCreateEmbeddingRequestModel0(embeddingsModel); err != nil {
		return nil, fmt.Errorf("error creating model: %w", err)
	}

	resp, err := cl.oai.CreateEmbeddingWithResponse(
		ctx,
		api.CreateEmbeddingJSONRequestBody{
			Input:          input,
			Model:          m,
			EncodingFormat: nil,
			User:           nil,
			Dimensions:     nil,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error generating embeddings: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return &model.GraphiteGenerateEmbeddingsResponse{
		Embeddings: resp.JSON200.Data[0].Embedding,
	}, nil
}
