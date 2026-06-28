package controller

import (
	"bytes"
	"context"
	_ "embed"

	"github.com/nhost/nhost/services/storage/api"
)

//go:embed openapi.yaml
var OpenAPISchema []byte

func (ctrl *Controller) GetOpenAPISpec( //nolint:ireturn
	_ context.Context,
	_ api.GetOpenAPISpecRequestObject,
) (api.GetOpenAPISpecResponseObject, error) {
	return api.GetOpenAPISpec200ApplicationxYamlResponse{
		Body:          bytes.NewReader(OpenAPISchema),
		ContentLength: int64(len(OpenAPISchema)),
	}, nil
}
