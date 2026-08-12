package oidc

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// profileOptions collects the ProfileOption values applied to one call.
type profileOptions struct {
	optionalEmail bool
}

// ProfileOption configures ProfileFromToken.
type ProfileOption func(*profileOptions)

// WithOptionalEmail tolerates an id_token that carries no email claim.
// Custom OIDC providers pass it because some IdPs expose the email only from
// the userinfo endpoint — the caller is then responsible for filling the
// field in (and for refusing to link an account without a verified email).
func WithOptionalEmail() ProfileOption {
	return func(o *profileOptions) {
		o.optionalEmail = true
	}
}

// ProfileFromToken extracts the standard OIDC profile claims from a validated
// id_token: sub and email are required (see WithOptionalEmail for the
// latter), email_verified is tri-state — absent means Unknown, never
// verified — and name and picture are optional.
func ProfileFromToken(token *jwt.Token, opts ...ProfileOption) (Profile, error) {
	var options profileOptions

	for _, opt := range opts {
		opt(&options)
	}

	sub, err := GetClaim[string](token, "sub")
	if err != nil {
		return Profile{}, fmt.Errorf("failed to get sub claim from token: %w", err)
	}

	// A missing email is an error unless the caller opted into supplying it
	// from elsewhere; any other claim failure always is.
	email, err := GetClaim[string](token, "email")
	if err != nil && (!options.optionalEmail || !errors.Is(err, ErrClaimNotFound)) {
		return Profile{}, fmt.Errorf("failed to get email claim from token: %w", err)
	}

	emailVerifiedStatus := EmailVerificationStatusUnknown

	emailVerified, err := GetClaim[bool](token, "email_verified")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get email_verified claim from token: %w", err)
	}

	if err == nil {
		emailVerifiedStatus = EmailVerificationFromBool(emailVerified)
	}

	name, err := GetClaim[string](token, "name")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get name claim from token: %w", err)
	}

	picture, err := GetClaim[string](token, "picture")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get picture claim from token: %w", err)
	}

	return Profile{
		ProviderUserID: sub,
		Email:          email,
		EmailVerified:  emailVerifiedStatus,
		Name:           name,
		Picture:        picture,
	}, nil
}
