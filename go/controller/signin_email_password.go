package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
)

func (a *Auth) PostSigninEmailPassword( //nolint:ireturn
	_ context.Context,
	_ api.PostSigninEmailPasswordRequestObject,
) (api.PostSigninEmailPasswordResponseObject, error) {
	return api.PostSigninEmailPassword200JSONResponse{}, nil //nolint:exhaustruct
}
