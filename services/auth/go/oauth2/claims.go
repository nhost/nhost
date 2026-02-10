package oauth2

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) addScopedIDTokenClaims(
	ctx context.Context,
	claims map[string]any,
	scopes []string,
	userID uuid.UUID,
) error {
	needsUser := slices.Contains(scopes, "profile") ||
		slices.Contains(scopes, "email") ||
		slices.Contains(scopes, "phone")
	if !needsUser {
		return nil
	}

	user, err := p.db.GetUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("error getting user: %w", err)
	}

	if slices.Contains(scopes, "profile") {
		addProfileClaims(claims, user)
	}

	if slices.Contains(scopes, "email") && user.Email.Valid {
		claims["email"] = user.Email.String
		claims["email_verified"] = user.EmailVerified
	}

	if slices.Contains(scopes, "phone") && user.PhoneNumber.Valid {
		claims["phone_number"] = user.PhoneNumber.String
		claims["phone_number_verified"] = user.PhoneNumberVerified
	}

	return nil
}

func addProfileClaims(claims map[string]any, user sql.AuthUser) {
	if user.DisplayName != "" {
		claims["name"] = user.DisplayName
	}

	if user.AvatarUrl != "" {
		claims["picture"] = user.AvatarUrl
	}

	if user.Locale != "" {
		claims["locale"] = user.Locale
	}
}
