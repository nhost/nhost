package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
)

func (validator *Validator) PostUserEmailChange(
	ctx context.Context,
	request *api.PostUserEmailChangeRequestObject,
	jwtGetter *JWTGetter,
	logger *slog.Logger,
) (uuid.UUID, error) {
	jwtToken, ok := jwtGetter.FromContext(ctx)
	if !ok {
		logger.Error(
			"jwt token not found in context, this should not be possilble due to middleware",
		)
		return uuid.UUID{}, &APIError{api.InternalServerError}
	}

	sub, err := jwtToken.Claims.GetSubject()
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return uuid.UUID{}, &APIError{api.InvalidRequest}
	}
	logger = logger.With(slog.String("user_id", sub))

	userID, err := uuid.Parse(sub)
	if err != nil {
		logger.Error("error parsing user id from jwt token's subject", logError(err))
		return uuid.UUID{}, &APIError{api.InvalidRequest}
	}

	isAnonymous := jwtGetter.GetCustomClaim(jwtToken, "x-hasura-user-isAnonymous")
	if isAnonymous == "" || isAnonymous != "false" {
		logger.Error("user is anonymous")
		return uuid.UUID{}, &APIError{api.ForbiddenAnonymous}
	}

	options := request.Body.Options
	if options == nil {
		o := deptr(request.Body.Options)
		options = &o
		request.Body.Options = options
	}

	if options.RedirectTo == nil {
		options.RedirectTo = ptr(validator.cfg.ClientURL.String())
	} else if !validator.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.Warn("redirect URL not allowed", slog.String("redirectTo", deptr(options.RedirectTo)))
		return uuid.UUID{}, &APIError{api.RedirecToNotAllowed}
	}

	_, err = validator.db.GetUserByEmail(ctx, sql.Text(string(request.Body.NewEmail)))
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, &APIError{api.EmailAlreadyInUse}
	}

	return userID, nil
}

func (ctrl *Controller) sendEmail(
	to string,
	locale string,
	linkType LinkType,
	ticket string,
	redirectTo string,
	templateName notifications.TemplateName,
	displayName string,
	email string,
	newEmail string,
	logger *slog.Logger,
) error {
	link, err := GenLink(
		*ctrl.config.ServerURL,
		linkType,
		ticket,
		redirectTo,
	)
	if err != nil {
		logger.Error("problem generating email verification link", logError(err))
		return fmt.Errorf("problem generating email verification link: %w", err)
	}

	if err := ctrl.email.SendEmail(
		to,
		locale,
		templateName,
		notifications.TemplateData{
			Link:        link,
			DisplayName: displayName,
			Email:       email,
			NewEmail:    newEmail,
			Ticket:      ticket,
			RedirectTo:  redirectTo,
			Locale:      locale,
			ServerURL:   ctrl.config.ServerURL.String(),
			ClientURL:   ctrl.config.ClientURL.String(),
		},
	); err != nil {
		logger.Error("problem sending email", logError(err))
		return fmt.Errorf("problem sending email: %w", err)
	}

	return nil
}

func (ctrl *Controller) PostUserEmailChange( //nolint:ireturn
	ctx context.Context, request api.PostUserEmailChangeRequestObject,
) (api.PostUserEmailChangeResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	userID, err := ctrl.validator.PostUserEmailChange(ctx, &request, ctrl.jwtGetter, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	ticket := newTicket(TicketTypeEmailConfirmChange)
	ticketExpiresAt := time.Now().Add(time.Hour)

	user, err := ctrl.db.UpdateUserChangeEmail(
		ctx,
		sql.UpdateUserChangeEmailParams{
			ID:              userID,
			Ticket:          sql.Text(ticket),
			TicketExpiresAt: sql.TimestampTz(ticketExpiresAt),
			NewEmail:        sql.Text(string(request.Body.NewEmail)),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Error("user not found")
		return ctrl.sendError(api.InvalidRequest), nil
	}
	if err != nil {
		logger.Error("error updating user ticket", logError(err))
		return ctrl.sendError(api.InternalServerError), nil
	}

	if err := ctrl.sendEmail(
		string(request.Body.NewEmail),
		user.Locale,
		LinkTypeEmailConfirmChange,
		ticket,
		deptr(request.Body.Options.RedirectTo),
		notifications.TemplateNameEmailConfirmChange,
		user.DisplayName,
		user.Email.String,
		string(request.Body.NewEmail),
		logger,
	); err != nil {
		return nil, err
	}

	return api.PostUserEmailChange200JSONResponse(api.OK), nil
}
