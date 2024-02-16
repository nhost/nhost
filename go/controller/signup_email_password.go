package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
)

func (a *Auth) PostSignupEmailPassword( //nolint:ireturn
	_ context.Context,
	_ api.PostSignupEmailPasswordRequestObject,
) (api.PostSignupEmailPasswordResponseObject, error) {
	return api.PostSignupEmailPassword200JSONResponse{}, nil //nolint:exhaustruct
}
