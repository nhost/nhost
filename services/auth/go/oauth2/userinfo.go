package oauth2

import (
	"context"
	"errors"
	"log/slog"
	"slices"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) GetUserinfo( //nolint:cyclop
	ctx context.Context,
	userID uuid.UUID,
	scopes []string,
	logger *slog.Logger,
) (*api.OAuth2UserinfoResponse, *Error) {
	user, err := p.db.GetUser(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &Error{Err: "invalid_token", Description: "User not found"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	var (
		email         *string
		emailVerified *bool
	)
	if slices.Contains(scopes, "email") && user.Email.Valid {
		email = &user.Email.String
		emailVerified = &user.EmailVerified
	}

	var (
		name    *string
		picture *string
		locale  *string
	)
	if slices.Contains(scopes, "profile") {
		if user.DisplayName != "" {
			name = &user.DisplayName
		}

		if user.AvatarUrl != "" {
			picture = &user.AvatarUrl
		}

		if user.Locale != "" {
			locale = &user.Locale
		}
	}

	var (
		phoneNumber         *string
		phoneNumberVerified *bool
	)
	if slices.Contains(scopes, "phone") && user.PhoneNumber.Valid {
		phoneNumber = &user.PhoneNumber.String
		phoneNumberVerified = &user.PhoneNumberVerified
	}

	return &api.OAuth2UserinfoResponse{
		Sub:                 userID.String(),
		Email:               email,
		EmailVerified:       emailVerified,
		Locale:              locale,
		Name:                name,
		PhoneNumber:         phoneNumber,
		PhoneNumberVerified: phoneNumberVerified,
		Picture:             picture,
	}, nil
}
