package openai

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/nhost/nhost/services/ai/openai/api"
	"github.com/oapi-codegen/runtime/types"
)

func (cl *Client) FilesDelete(
	ctx context.Context,
	id string,
	logger *slog.Logger,
) error {
	logger = logger.With("component", "openai.files")
	logger.InfoContext(ctx, "deleting file from openai")

	_, err := cl.oai.DeleteFileWithResponse(ctx, id)
	if err != nil {
		return fmt.Errorf("error deleting file from openai: %w", err)
	}

	return nil
}

func (cl *Client) FilesCreate(
	ctx context.Context,
	r io.Reader,
	filename string,
	logger *slog.Logger,
) (*api.CreateFileR, error) {
	logger = logger.With("component", "openai.files")
	logger.InfoContext(ctx, "uploading file")

	ff := types.File{}

	b, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("error reading file: %w", err)
	}

	ff.InitFromBytes(b, filename)

	f, err := cl.coai.CreateFileWithResponse(
		ctx,
		api.CreateFileRequest{
			File:    ff,
			Purpose: "assistant",
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error uploading file to openai: %w", err)
	}

	return f, nil
}
