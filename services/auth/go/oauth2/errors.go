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
	case "invalid_request", "invalid_scope", "unsupported_response_type",
		"unsupported_grant_type", "invalid_client_metadata":
		return http.StatusBadRequest
	case "invalid_client":
		return http.StatusUnauthorized
	case "invalid_grant":
		return http.StatusBadRequest
	case "invalid_token":
		return http.StatusUnauthorized
	case "server_error":
		return http.StatusInternalServerError
	case "authorization_pending", "slow_down", "expired_token", "access_denied":
		return http.StatusBadRequest
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
