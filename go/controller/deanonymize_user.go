package controller

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) postUserDeanonymizeValidateRequest( //nolint:cyclop
	ctx context.Context,
	request api.DeanonymizeUserRequestObject,
	logger *slog.Logger,
) (uuid.UUID, string, *api.SignUpOptions, *APIError) {
	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.ErrorContext(
			ctx,
			"jwt token not found in context, this should not be possilble due to middleware",
		)

		return uuid.UUID{}, "", nil, ErrInternalServerError
	}

	if !ctrl.wf.jwtGetter.IsAnonymous(jwtToken) {
		logger.ErrorContext(ctx, "user is not anonymous")
		return uuid.UUID{}, "", nil, ErrUserNotAnonymous
	}

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return uuid.UUID{}, "", nil, ErrInvalidRequest
	}

	var password string

	if request.Body.SignInMethod == api.EmailPassword && request.Body.Password == nil {
		logger.ErrorContext(ctx, "password is required for email/password sign in method")
		return uuid.UUID{}, "", nil, ErrInvalidRequest
	} else if request.Body.SignInMethod == api.EmailPassword {
		password = *request.Body.Password
		if apiErr := ctrl.wf.ValidatePassword(ctx, password, logger); apiErr != nil {
			return uuid.UUID{}, "", nil, apiErr
		}
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(
		ctx, request.Body.Options, string(request.Body.Email), logger,
	)
	if apiErr != nil {
		return uuid.UUID{}, "", nil, apiErr
	}

	if !ctrl.wf.ValidateEmail(string(request.Body.Email)) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return uuid.UUID{}, "", nil, ErrInvalidEmailPassword
	}

	exists, apiErr := ctrl.wf.UserByEmailExists(ctx, string(request.Body.Email), logger)
	if apiErr != nil {
		return uuid.UUID{}, "", nil, apiErr
	}

	if exists {
		logger.WarnContext(ctx, "email already exists")
		return uuid.UUID{}, "", nil, ErrEmailAlreadyInUse
	}

	return userID, password, options, nil
}

func (ctrl *Controller) DeanonymizeUser( //nolint:funlen
	ctx context.Context, request api.DeanonymizeUserRequestObject,
) (api.DeanonymizeUserResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	userID, password, options, apiError := ctrl.postUserDeanonymizeValidateRequest(
		ctx, request, logger,
	)
	if apiError != nil {
		return ctrl.sendError(apiError), nil
	}

	var (
		ticket          string
		ticketExpiresAt time.Time
		linkType        LinkType
		templateName    notifications.TemplateName
	)

	deleteRefreshTokens := false

	switch {
	case request.Body.SignInMethod == api.Passwordless:
		ticket = generateTicket(TicketTypePasswordLessEmail)
		ticketExpiresAt = time.Now().Add(time.Hour)
		linkType = LinkTypePasswordlessEmail
		templateName = notifications.TemplateNameSigninPasswordless
		deleteRefreshTokens = true
	case request.Body.SignInMethod == api.EmailPassword && ctrl.config.RequireEmailVerification:
		ticket = generateTicket(TicketTypeVerifyEmail)
		ticketExpiresAt = time.Now().Add(In30Days)
		linkType = LinkTypeEmailVerify
		templateName = notifications.TemplateNameEmailVerify
		deleteRefreshTokens = true
	}

	if apiError = ctrl.wf.DeanonymizeUser(
		ctx,
		userID,
		string(request.Body.Email),
		password,
		ticket,
		ticketExpiresAt,
		options,
		deleteRefreshTokens,
		logger,
	); apiError != nil {
		return ctrl.sendError(apiError), nil
	}

	if ticket != "" {
		if apiError = ctrl.wf.SendEmail(
			ctx,
			string(request.Body.Email),
			*options.Locale,
			linkType,
			ticket,
			deptr(options.RedirectTo),
			templateName,
			*options.DisplayName,
			string(request.Body.Email),
			"",
			logger,
		); apiError != nil {
			return ctrl.sendError(apiError), nil
		}
	}

	return api.DeanonymizeUser200JSONResponse(api.OK), nil
}
