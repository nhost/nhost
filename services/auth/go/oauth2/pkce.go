package oauth2

import (
	"crypto/sha256"
	"encoding/base64"

	"github.com/nhost/nhost/services/auth/go/sql"
)

func ValidatePKCE( //nolint:cyclop
	authReq sql.AuthOauth2AuthRequest,
	codeVerifier *string,
) *Error {
	if !authReq.CodeChallenge.Valid || authReq.CodeChallenge.String == "" {
		return nil
	}

	if codeVerifier == nil || *codeVerifier == "" {
		return &Error{Err: "invalid_grant", Description: "Missing code_verifier"}
	}

	method := "plain"
	if authReq.CodeChallengeMethod.Valid {
		method = authReq.CodeChallengeMethod.String
	}

	switch method {
	case "S256":
		h := sha256.Sum256([]byte(*codeVerifier))
		encoded := base64.RawURLEncoding.EncodeToString(h[:])

		if encoded != authReq.CodeChallenge.String {
			return &Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
		}
	case "plain":
		if *codeVerifier != authReq.CodeChallenge.String {
			return &Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
		}
	default:
		return &Error{
			Err:         "invalid_request",
			Description: "Unsupported code_challenge_method",
		}
	}

	return nil
}
