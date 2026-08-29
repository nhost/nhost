package openai

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/openai/api"
)

func (cl *Client) VectorStoresCreate(
	ctx context.Context,
	bucket string,
) (*api.VectorStoreObject, error) {
	vs, err := cl.oai.CreateVectorStoreWithResponse(
		ctx,
		api.CreateVectorStoreJSONRequestBody{ //nolint:exhaustruct
			Name: new("file-store-" + bucket),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error creating vector store: %w", err)
	}

	return vs.JSON200, nil
}

func (cl *Client) VectorStoresFilesCreate(
	ctx context.Context,
	vectorStoreID string,
	fileID string,
) (*api.VectorStoreFileObject, error) {
	s, err := cl.oai.CreateVectorStoreFileWithResponse(
		ctx,
		vectorStoreID,
		api.CreateVectorStoreFileJSONRequestBody{ //nolint: exhaustruct
			FileId: fileID,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error creating vector store file: %w", err)
	}

	return s.JSON200, nil
}

func (cl *Client) VectorStoreDelete(
	ctx context.Context,
	vectorStoreID string,
) error {
	_, err := cl.oai.DeleteVectorStoreWithResponse(
		ctx,
		vectorStoreID,
	)
	if err != nil {
		return fmt.Errorf("error deleting vector store: %w", err)
	}

	return nil
}
