package openai

import (
	"context"
	"errors"
	"fmt"

	oai "github.com/openai/openai-go"
	"github.com/openai/openai-go/packages/param"
)

var errEmptyEmbeddingResponse = errors.New("OpenAI returned no embeddings")

func (cl *Client) EmbeddingsGenerate(
	ctx context.Context,
	input string,
	embeddingsModel string,
) ([]float64, error) {
	response, err := cl.embeddings.New(
		ctx,
		oai.EmbeddingNewParams{ //nolint:exhaustruct // Optional SDK fields use zero values.
			Input: oai.EmbeddingNewParamsInputUnion{ //nolint:exhaustruct // One input variant is required.
				OfString: param.NewOpt(input),
			},
			Model: embeddingsModel,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("generating embeddings: %w", err)
	}

	if response == nil || len(response.Data) == 0 {
		return nil, errEmptyEmbeddingResponse
	}

	return response.Data[0].Embedding, nil
}
