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

func (p *Provider) GetUserinfo( //nolint:cyclop,funlen
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

	resp := &api.OAuth2UserinfoResponse{
		Sub:                  userID.String(),
		Email:                email,
		EmailVerified:        emailVerified,
		Locale:               locale,
		Name:                 name,
		PhoneNumber:          phoneNumber,
		PhoneNumberVerified:  phoneNumberVerified,
		Picture:              picture,
		AdditionalProperties: nil,
	}

	if slices.Contains(scopes, "graphql") {
		userRoles, err := p.db.GetUserRoles(ctx, userID)
		if err != nil {
			logger.ErrorContext(ctx, "error getting user roles", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		allowedRoles := make([]string, 0, len(userRoles))
		for _, role := range userRoles {
			allowedRoles = append(allowedRoles, role.Role)
		}

		if !slices.Contains(allowedRoles, user.DefaultRole) {
			allowedRoles = append(allowedRoles, user.DefaultRole)
		}

		ns, c, err := p.signer.RawGraphQLClaims(
			ctx, userID, user.IsAnonymous, allowedRoles, user.DefaultRole, nil, logger,
		)
		if err != nil {
			logger.ErrorContext(ctx, "error creating GraphQL claims", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		resp.Set(ns, c)
	}

	return resp, nil
}
