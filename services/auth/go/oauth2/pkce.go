package oauth2

import (
	"errors"

	"github.com/nhost/nhost/services/auth/go/pkce"
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

	if err := pkce.ValidateS256NoLengthCheck(
		authReq.CodeChallenge.String, *codeVerifier,
	); err != nil {
		if errors.Is(err, pkce.ErrInvalidCodeVerifierLength) {
			return &Error{Err: "invalid_grant", Description: err.Error()}
		}

		return &Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
	}

	return nil
}
