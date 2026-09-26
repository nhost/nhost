package controller

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
)

// VerificationTicketReuseWindow is how long a verification ticket keeps being
// reused across resends before a fresh one is minted.
const VerificationTicketReuseWindow = 10 * time.Minute

// reusableVerificationTicket reports whether the user's current ticket can back
// another verification email instead of being replaced.
//
// auth.users holds a single ticket column, so minting a new ticket on every
// resend silently invalidated the link in every message already delivered. A
// user waiting on a slow or greylisted email would click an older link, get a
// failure, ask for another email, and invalidate the message that was in flight
// -- a loop that sustains itself for as long as the user keeps trying.
//
// That column is shared with every other ticket flow (password reset, MFA
// challenge, email change), so the type prefix has to match before anything is
// reused: handing out a mfaTotp: ticket behind an emailVerify link produces a
// link that fails the type check in verifyTicket.
//
// The table records no issued-at, so it is derived from the expiry. Every path
// that mints or refreshes a verifyEmail ticket uses VerificationTicketTTL:
// Workflows.SignupUserWithouthSession, DeanonymizeUser, and
// SendVerificationEmail. When a ticket is reused, its expiry is refreshed with
// the same TTL, making the reuse window slide from the most recent send. The
// tradeoff is that a user who keeps resending within the reuse window can keep
// one ticket alive indefinitely, beyond the 30 days granted by a single mint.
func reusableVerificationTicket(user sql.AuthUser, now time.Time) (string, bool) {
	if !user.Ticket.Valid || !user.TicketExpiresAt.Valid {
		return "", false
	}

	if !strings.HasPrefix(user.Ticket.String, string(TicketTypeVerifyEmail)+":") {
		return "", false
	}

	expiresAt := user.TicketExpiresAt.Time
	if !expiresAt.After(now) {
		return "", false
	}

	issuedAt := expiresAt.Add(-VerificationTicketTTL)
	if issuedAt.After(now) || issuedAt.Before(now.Add(-VerificationTicketReuseWindow)) {
		return "", false
	}

	return user.Ticket.String, true
}

func (ctrl *Controller) SendVerificationEmail( //nolint:ireturn
	ctx context.Context,
	request api.SendVerificationEmailRequestObject,
) (api.SendVerificationEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(ctx, request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	request.Body.Options = options

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	switch {
	case errors.Is(apiErr, ErrUnverifiedUser):
	case apiErr == nil && !user.EmailVerified:
	case apiErr != nil:
		return ctrl.respondWithError(apiErr), nil
	default:
		return ctrl.respondWithError(ErrEmailAlreadyVerified), nil
	}

	now := time.Now()

	ticket, reused := reusableVerificationTicket(user, now)
	if reused {
		// Keeps the link in any message already delivered working.
		logger.InfoContext(ctx, "reusing recent verification ticket")
	} else {
		ticket = generateTicket(TicketTypeVerifyEmail)
	}

	expireAt := now.Add(VerificationTicketTTL)
	if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, expireAt, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		user.Email.String,
		user.Locale,
		LinkTypeEmailVerify,
		ticket,
		deptr(options.RedirectTo),
		notifications.TemplateNameEmailVerify,
		user.DisplayName,
		user.Email.String,
		"",
		deptr(request.Body.CodeChallenge),
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.SendVerificationEmail200JSONResponse(api.OK), nil
}
