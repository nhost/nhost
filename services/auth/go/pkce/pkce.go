package pkce

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
)

const (
	codeLength          = 32
	codeChallengeLength = 43
)

var (
	ErrMissingCodeVerifier       = errors.New("missing code_verifier")
	ErrInvalidCodeVerifier       = errors.New("invalid code_verifier")
	ErrInvalidCodeVerifierLength = errors.New(
		"code_verifier must be between 43 and 128 characters",
	)
	ErrInvalidCodeChallengeMethod = errors.New(
		"unsupported code_challenge_method, only S256 is supported",
	)
	ErrInvalidCodeChallengeFormat = errors.New(
		"code_challenge must be exactly 43 base64url characters",
	)

	codeChallengeRegex = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
)

// ValidateCodeChallengeFormat validates that a code challenge has the correct
// format for S256: exactly 43 characters of base64url encoding (no padding).
func ValidateCodeChallengeFormat(codeChallenge string) error {
	if !codeChallengeRegex.MatchString(codeChallenge) {
		return fmt.Errorf(
			"%w: got %d characters", ErrInvalidCodeChallengeFormat, len(codeChallenge),
		)
	}

	return nil
}

// ValidateS256 validates that codeVerifier matches codeChallenge using the S256 method.
// It enforces RFC 7636 length requirements (43-128 characters).
func ValidateS256(codeChallenge, codeVerifier string) error {
	if codeVerifier == "" {
		return ErrMissingCodeVerifier
	}

	if len(codeVerifier) < 43 || len(codeVerifier) > 128 {
		return fmt.Errorf("%w: got %d", ErrInvalidCodeVerifierLength, len(codeVerifier))
	}

	return validateS256Hash(codeChallenge, codeVerifier)
}

// ValidateS256NoLengthCheck validates that codeVerifier matches codeChallenge
// using the S256 method without enforcing length requirements.
func ValidateS256NoLengthCheck(codeChallenge, codeVerifier string) error {
	if codeVerifier == "" {
		return ErrMissingCodeVerifier
	}

	return validateS256Hash(codeChallenge, codeVerifier)
}

func validateS256Hash(codeChallenge, codeVerifier string) error {
	h := sha256.Sum256([]byte(codeVerifier))
	encoded := base64.RawURLEncoding.EncodeToString(h[:])

	if subtle.ConstantTimeCompare([]byte(encoded), []byte(codeChallenge)) != 1 {
		return ErrInvalidCodeVerifier
	}

	return nil
}

// HashCode returns the SHA-256 hash of an authorization code, encoded as base64url (no padding).
func HashCode(code string) string {
	h := sha256.Sum256([]byte(code))

	return base64.RawURLEncoding.EncodeToString(h[:])
}

// GenerateCode generates a cryptographically random authorization code.
func GenerateCode() (string, error) {
	b := make([]byte, codeLength)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random code: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}
