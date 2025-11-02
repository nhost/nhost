package controller

import (
	"context"
	"errors"
	"net/http"

	"github.com/nhost/nhost/lib/oapi/example/api"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (c *Controller) SignInEmailPassword( //nolint:ireturn
	_ context.Context, req api.SignInEmailPasswordRequestObject,
) (api.SignInEmailPasswordResponseObject, error) {
	switch req.Body.Email {
	case "bad@email.com":
		return api.SignInEmailPassworddefaultJSONResponse{
			Body: api.ErrorResponse{
				Error:   api.DisabledUser,
				Message: "The user account is disabled.",
				Status:  http.StatusConflict,
			},
			StatusCode: http.StatusConflict,
		}, nil
	case "crash@email.com":
		return nil, errors.New("simulated server crash") //nolint:err113
	}

	return api.SignInEmailPassword200JSONResponse{
		Session: &api.Session{
			AccessToken:          "access_token_example",
			AccessTokenExpiresIn: 900, //nolint:mnd
			RefreshToken:         "refresh_token_example",
			RefreshTokenId:       "refresh_token_id_example",
		},
	}, nil
}

func (c *Controller) ChangeUserEmail( //nolint:ireturn
	_ context.Context,
	_ api.ChangeUserEmailRequestObject,
) (api.ChangeUserEmailResponseObject, error) {
	return api.ChangeUserEmail200JSONResponse(api.OK), nil
}
