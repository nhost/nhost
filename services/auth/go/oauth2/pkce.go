package oauth2

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"

	"github.com/nhost/nhost/services/auth/go/sql"
)

func ValidatePKCE(
	authReq sql.AuthOauth2AuthRequest,
	codeVerifier *string,
	isPublicClient bool,
) *Error {
	if !authReq.CodeChallenge.Valid || authReq.CodeChallenge.String == "" {
		if isPublicClient {
			return &Error{
				Err:         "invalid_request",
				Description: "PKCE code_challenge is required for public clients",
			}
		}

		return nil
	}

	if codeVerifier == nil || *codeVerifier == "" {
		return &Error{Err: "invalid_grant", Description: "Missing code_verifier"}
	}

	method := "S256"
	if authReq.CodeChallengeMethod.Valid {
		method = authReq.CodeChallengeMethod.String
	}

	if method != "S256" {
		return &Error{
			Err:         "invalid_request",
			Description: "Unsupported code_challenge_method, only S256 is supported",
		}
	}

	h := sha256.Sum256([]byte(*codeVerifier))
	encoded := base64.RawURLEncoding.EncodeToString(h[:])

	if subtle.ConstantTimeCompare([]byte(encoded), []byte(authReq.CodeChallenge.String)) != 1 {
		return &Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
	}

	return nil
}
