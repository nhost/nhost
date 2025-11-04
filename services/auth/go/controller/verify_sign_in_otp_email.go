package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifySignInOTPEmail( //nolint:ireturn
	ctx context.Context,
	request api.VerifySignInOTPEmailRequestObject,
) (api.VerifySignInOTPEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	user, apiErr := ctrl.wf.GetUserByEmailAndTicket(
		ctx, string(request.Body.Email), request.Body.Otp, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifySignInOTPEmail200JSONResponse{
		Session: session,
	}, nil
}
