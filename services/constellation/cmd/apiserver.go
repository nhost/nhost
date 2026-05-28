package cmd

import (
	"context"

	"github.com/nhost/nhost/services/constellation/api"
)

// apiServer implements the generated api.StrictServerInterface for the
// non-GraphQL HTTP surface (health checks and version). Everything not
// described in the OpenAPI spec is reverse-proxied to Hasura by the router.
type apiServer struct {
	version string
}

func (s *apiServer) HealthzGet( //nolint:ireturn
	_ context.Context, _ api.HealthzGetRequestObject,
) (api.HealthzGetResponseObject, error) {
	return api.HealthzGet200TextResponse("ok"), nil
}

func (s *apiServer) HealthzHead( //nolint:ireturn
	_ context.Context, _ api.HealthzHeadRequestObject,
) (api.HealthzHeadResponseObject, error) {
	return api.HealthzHead200Response{}, nil
}

func (s *apiServer) GetVersion( //nolint:ireturn
	_ context.Context, _ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{Version: s.version}, nil
}
