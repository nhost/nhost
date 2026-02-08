package controller

import "net/http"

func oauth2ErrorStatusCode(errCode string) int {
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
