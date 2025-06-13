package controller

import (
	"context"
	"log/slog"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostSigninOtpEmailVerify( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninOtpEmailVerifyRequestObject,
) (api.PostSigninOtpEmailVerifyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	user, apiErr := ctrl.wf.GetUserByEmailAndTicket(
		ctx, string(request.Body.Email), request.Body.Otp, logger)

	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSigninOtpEmailVerify200JSONResponse{
		Session: session,
	}, nil
}
