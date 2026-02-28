package controller

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"strings"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func getTicketType(
	ctx context.Context, ticket string, logger *slog.Logger) (TicketType, *APIError,
) {
	switch {
	case strings.HasPrefix(ticket, "emailConfirmChange:"):
		return TicketTypeEmailConfirmChange, nil
	case strings.HasPrefix(ticket, "passwordlessEmail:"):
		return TicketTypePasswordLessEmail, nil
	case strings.HasPrefix(ticket, "verifyEmail:"):
		return TicketTypeVerifyEmail, nil
	case strings.HasPrefix(ticket, "passwordReset:"):
		return TicketTypePasswordReset, nil
	case strings.HasPrefix(ticket, "otp:"):
		return TicketTypeOTP, nil
	default:
		logger.ErrorContext(ctx, "unknown ticket type", slog.String("ticket", ticket))
		return "", ErrInvalidTicket
	}
}

func (ctrl *Controller) getVerifyHandleTicketType(
	ctx context.Context, user sql.AuthUser, ticketType TicketType, logger *slog.Logger,
) *APIError {
	var apiErr *APIError

	switch ticketType {
	case TicketTypeEmailConfirmChange:
		apiErr = ctrl.getVerifyEmailConfirmChange(ctx, user, logger)
	case TicketTypePasswordLessEmail:
		apiErr = ctrl.getVerifyEmailPasswordLessEmail(ctx, user, logger)
	case TicketTypePasswordReset:
		// noop, just redirecting the user to the client (as signed-in).
		// this isn't great, but it is for historical reasons.
	case TicketTypeVerifyEmail:
		apiErr = ctrl.getVerifyEmail(ctx, user, logger)
	case TicketTypeOTP:
		logger.ErrorContext(ctx, "OTP verification is not supported in this context")

		apiErr = ErrInvalidRequest
	}

	return apiErr
}

func (ctrl *Controller) VerifyTicket( //nolint:ireturn
	ctx context.Context, req api.VerifyTicketRequestObject,
) (api.VerifyTicketResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	user, ticketType, redirectTo, apiErr := ctrl.getVerifyValidateRequest(ctx, req, logger)
	switch {
	case apiErr != nil && redirectTo == nil:
		return ctrl.sendError(apiErr), nil
	case apiErr != nil:
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	apiErr = ctrl.getVerifyHandleTicketType(ctx, user, ticketType, logger)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	redirectTo = appendURLValues(redirectTo, map[string]string{
		"refreshToken": session.RefreshToken,
		"type":         string(ticketType),
	})

	return api.VerifyTicket302Response{
		Headers: api.VerifyTicket302ResponseHeaders{
			Location: redirectTo.String(),
		},
	}, nil
}

func (ctrl *Controller) getVerifyValidateRequest(
	ctx context.Context, req api.VerifyTicketRequestObject, logger *slog.Logger,
) (sql.AuthUser, TicketType, *url.URL, *APIError) {
	redirectTo, err := url.Parse(req.Params.RedirectTo)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing redirect URL",
			slog.String("redirectTo", req.Params.RedirectTo), logError(err))

		return sql.AuthUser{}, "", nil, ErrInvalidRequest
	}

	options := &api.OptionsRedirectTo{
		RedirectTo: &req.Params.RedirectTo,
	}

	_, apiErr := ctrl.wf.ValidateOptionsRedirectTo(ctx, options, logger)
	if apiErr != nil {
		return sql.AuthUser{}, "", ctrl.config.ClientURL, apiErr
	}

	ticketType, apiErr := getTicketType(ctx, req.Params.Ticket, logger)
	if apiErr != nil {
		return sql.AuthUser{}, "", redirectTo, apiErr
	}

	user, apiErr := ctrl.wf.GetUserByTicket(ctx, req.Params.Ticket, logger)
	switch {
	case errors.Is(apiErr, ErrUnverifiedUser) &&
		(ticketType == TicketTypeVerifyEmail || ticketType == TicketTypePasswordLessEmail):
		// this isn't an error
	case apiErr != nil:
		return user, ticketType, redirectTo, apiErr
	}

	return user, ticketType, redirectTo, nil
}

func (ctrl *Controller) getVerifyEmailConfirmChange(
	ctx context.Context, user sql.AuthUser, logger *slog.Logger,
) *APIError {
	if _, apiErr := ctrl.wf.UpdateUserConfirmChangeEmail(ctx, user.ID, logger); apiErr != nil {
		return apiErr
	}

	return nil
}

func (ctrl *Controller) getVerifyEmailPasswordLessEmail(
	ctx context.Context, user sql.AuthUser, logger *slog.Logger,
) *APIError {
	if !user.EmailVerified {
		if _, apiErr := ctrl.wf.UpdateUserVerifyEmail(ctx, user.ID, logger); apiErr != nil {
			return apiErr
		}
	}

	return nil
}

func (ctrl *Controller) getVerifyEmail(
	ctx context.Context, user sql.AuthUser, logger *slog.Logger,
) *APIError {
	if !user.EmailVerified {
		if _, apiErr := ctrl.wf.UpdateUserVerifyEmail(ctx, user.ID, logger); apiErr != nil {
			return apiErr
		}
	}

	return nil
}
