package cmd

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

func VerifyLicense(pubkey []byte, license string) error {
	if license == "" {
		return errors.New("license key is empty") //nolint:err113
	}

	p, err := jwt.ParseEdPublicKeyFromPEM(pubkey)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %w", err)
	}

	if _, err := jwt.Parse(
		license,
		func(_ *jwt.Token) (any, error) {
			return p, nil
		},
		jwt.WithValidMethods([]string{"EdDSA"}),
		jwt.WithAudience("GRAPHITE"),
		jwt.WithIssuer("https://nhost.io"),
		jwt.WithIssuedAt(),
		jwt.WithExpirationRequired(),
	); err != nil {
		return fmt.Errorf("failed to validate license: %w", err)
	}

	return nil
}
