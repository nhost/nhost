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
	default:
		return http.StatusBadRequest
	}
}

func ErrorRedirectURL(redirectURI, state string, oauthErr *Error) string {
	u, _ := url.Parse(redirectURI)

	q := u.Query()
	q.Set("error", oauthErr.Err)
	q.Set("error_description", oauthErr.Description)

	if state != "" {
		q.Set("state", state)
	}

	u.RawQuery = q.Encode()

	return u.String()
}
