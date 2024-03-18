package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/sql"
)

type TicketType string

const (
	TicketTypeEmailConfirmChange TicketType = "emailConfirmChange"
	TicketTypePasswordLessEmail  TicketType = "passwordlessEmail"
	TicketTypeVerifyEmail        TicketType = "verifyEmail"
	TicketTypePasswordReset      TicketType = "passwordReset"
)

func generateTicket(ticketType TicketType) string {
	return fmt.Sprintf("%s:%s", ticketType, uuid.NewString())
}

func (wf *Workflows) SetTicket(
	ctx context.Context,
	userID uuid.UUID,
	ticket string,
	expiresAt time.Time,
	logger *slog.Logger,
) *APIError {
	_, err := wf.db.UpdateUserTicket(
		ctx,
		sql.UpdateUserTicketParams{
			ID:              userID,
			Ticket:          sql.Text(ticket),
			TicketExpiresAt: sql.TimestampTz(expiresAt),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Error("user not found")
		return ErrInvalidRequest
	}
	if err != nil {
		logger.Error("error updating user ticket", logError(err))
		return ErrInternalServerError
	}

	return nil
}

type LinkType string

const (
	LinkTypeEmailVerify        LinkType = "emailVerify"
	LinkTypeEmailConfirmChange LinkType = "emailConfirmChange"
	LinkTypePasswordlessEmail  LinkType = "passwordlessEmail"
	LinkTypePasswordReset      LinkType = "passwordReset"
)

func GenLink(serverURL url.URL, typ LinkType, ticket, redirectTo string) (string, error) {
	path, err := url.JoinPath(serverURL.Path, "verify")
	if err != nil {
		return "", fmt.Errorf("problem appending /verify to server url: %w", err)
	}
	serverURL.Path = path

	query := serverURL.Query()
	query.Add("type", string(typ))
	query.Add("ticket", ticket)
	query.Add("redirectTo", redirectTo)
	serverURL.RawQuery = query.Encode()

	return serverURL.String(), nil
}
