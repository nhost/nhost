package controller

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) postSignupEmailPasswordValidateRequest(
	ctx context.Context, req api.PostSignupEmailPasswordRequestObject, logger *slog.Logger,
) (api.PostSignupEmailPasswordRequestObject, *APIError) {
	if ctrl.config.DisableSignup {
		logger.Warn("signup disabled")
		return api.PostSignupEmailPasswordRequestObject{}, ErrSignupDisabled
	}

	if err := ctrl.wf.ValidateSignupEmail(req.Body.Email, logger); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	if err := ctrl.wf.ValidatePassword(ctx, req.Body.Password, logger); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	options, err := ctrl.wf.ValidateSignUpOptions(
		req.Body.Options, string(req.Body.Email), logger,
	)
	if err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	req.Body.Options = options

	return req, nil
}

func (ctrl *Controller) PostSignupEmailPassword( //nolint:ireturn
	ctx context.Context,
	req api.PostSignupEmailPasswordRequestObject,
) (api.PostSignupEmailPasswordResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).With(slog.String("email", string(req.Body.Email)))

	req, apiError := ctrl.postSignupEmailPasswordValidateRequest(ctx, req, logger)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	if ctrl.config.RequireEmailVerification || ctrl.config.DisableNewUsers {
		return ctrl.postSignupEmailPasswordWithEmailVerificationOrUserDisabled(
			ctx,
			string(req.Body.Email),
			req.Body.Password,
			req.Body.Options,
			logger,
		)
	}

	return ctrl.postSignupEmailPasswordWithoutEmailVerification(
		ctx,
		string(req.Body.Email),
		req.Body.Password,
		req.Body.Options,
		logger,
	)
}

func (ctrl *Controller) postSignupEmailPasswordWithEmailVerificationOrUserDisabled( //nolint:ireturn
	ctx context.Context,
	email string,
	password string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (api.PostSignupEmailPasswordResponseObject, error) {
	ticket := generateTicket(TicketTypeVerifyEmail)

	if _, err := ctrl.wf.SignUpUser(
		ctx,
		email,
		options,
		logger,
		SignupUserWithTicket(ticket, time.Now().Add(InAMonth)),
		SignupUserWithPassword(password),
	); err != nil {
		return ctrl.respondWithError(err), nil
	}

	if ctrl.config.DisableNewUsers {
		return api.PostSignupEmailPassword200JSONResponse{Session: nil}, nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		email,
		deptr(options.Locale),
		LinkTypeEmailVerify,
		ticket,
		deptr(options.RedirectTo),
		notifications.TemplateNameEmailVerify,
		deptr(options.DisplayName),
		email,
		"",
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.PostSignupEmailPassword200JSONResponse{Session: nil}, nil
}

func (ctrl *Controller) postSignupEmailPasswordWithoutEmailVerification( //nolint:ireturn
	ctx context.Context,
	email string,
	password string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (api.PostSignupEmailPasswordResponseObject, error) {
	refreshToken := uuid.New()
	expiresAt := time.Now().Add(time.Duration(ctrl.config.RefreshTokenExpiresIn) * time.Second)

	userSession, resp, apiErr := ctrl.wf.SignupUserWithRefreshToken(
		ctx, email, password, refreshToken, expiresAt, options, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	accessToken, expiresIn, err := ctrl.wf.jwtGetter.GetToken(
		ctx, resp.UserID, false, deptr(options.AllowedRoles), *options.DefaultRole, logger,
	)
	if err != nil {
		logger.Error("error getting jwt", logError(err))
		return nil, fmt.Errorf("error getting jwt: %w", err)
	}

	return api.PostSignupEmailPassword200JSONResponse{
		Session: &api.Session{
			AccessToken:          accessToken,
			AccessTokenExpiresIn: expiresIn,
			RefreshTokenId:       resp.RefreshTokenID.String(),
			RefreshToken:         refreshToken.String(),
			User:                 userSession,
		},
	}, nil
}
