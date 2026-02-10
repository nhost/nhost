package oauth2

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"strings"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) GetUserinfo( //nolint:cyclop
	ctx context.Context,
	userID uuid.UUID,
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

	resp := &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
		Sub: userID.String(),
	}

	scopes := p.GetScopesFromJWT(ctx)

	if slices.Contains(scopes, "email") && user.Email.Valid {
		resp.Email = &user.Email.String
		resp.EmailVerified = &user.EmailVerified
	}

	if slices.Contains(scopes, "profile") {
		if user.DisplayName != "" {
			resp.Name = &user.DisplayName
		}

		if user.AvatarUrl != "" {
			resp.Picture = &user.AvatarUrl
		}

		if user.Locale != "" {
			resp.Locale = &user.Locale
		}
	}

	if slices.Contains(scopes, "phone") && user.PhoneNumber.Valid {
		resp.PhoneNumber = &user.PhoneNumber.String
		resp.PhoneNumberVerified = &user.PhoneNumberVerified
	}

	return resp, nil
}

func (p *Provider) GetScopesFromJWT(ctx context.Context) []string {
	jwtToken, ok := p.jwtContextReader.FromContext(ctx)
	if !ok {
		return nil
	}

	claims, ok := jwtToken.Claims.(jwtlib.MapClaims)
	if !ok {
		return nil
	}

	scopeStr, ok := claims["scope"].(string)
	if !ok || scopeStr == "" {
		return nil
	}

	return strings.Split(scopeStr, " ")
}
