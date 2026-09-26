package oauth2

import (
	"net/http"
	"net/url"
)

type Error struct {
	Err         string
	Description string
}

func ErrorStatusCode(errCode string) int {
	switch errCode {
	case invalidRequest, invalidScope, "unsupported_response_type",
		"unsupported_grant_type", "invalid_client_metadata":
		return http.StatusBadRequest
	case accessDenied:
		return http.StatusForbidden
	case invalidClient:
		return http.StatusUnauthorized
	case invalidGrant:
		return http.StatusBadRequest
	case "invalid_token":
		return http.StatusUnauthorized
	case serverError:
		return http.StatusInternalServerError
	default:
		return http.StatusBadRequest
	}
}

func ErrorRedirectURL(redirectURI, state, issuer string, oauthErr *Error) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		u = &url.URL{} //nolint:exhaustruct
	}

	q := u.Query()
	q.Set("error", oauthErr.Err)
	q.Set("error_description", oauthErr.Description)

	if issuer != "" {
		q.Set("iss", issuer)
	}

	if state != "" {
		q.Set("state", state)
	}

	u.RawQuery = q.Encode()

	return u.String()
}

// OAuth2/OIDC error codes, scopes, claims and messages.
const (
	clientIDIsRequired              = "Client ID is required"
	internalServerError             = "Internal server error"
	pkceS256                        = "S256"
	unknownClient                   = "Unknown client"
	userDoesNotHaveTheRequestedRole = "User does not have the requested role"
	accessDenied                    = "access_denied"
	scopeEmail                      = "email"
	invalidClient                   = "invalid_client"
	invalidGrant                    = "invalid_grant"
	invalidRequest                  = "invalid_request"
	invalidScope                    = "invalid_scope"
	openid                          = "openid"
	serverError                     = "server_error"
	claimSub                        = "sub"
)
