package controller

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func GetUserSession(headers http.Header) map[string]any {
	session := map[string]any{
		"access_token_claims": make(map[string]any),
		"hasura_headers":      make(map[string]any),
	}

	authHeader, ok := headers["Authorization"]
	if ok && strings.HasPrefix(authHeader[0], "Bearer ") {
		p := jwt.NewParser()
		claims := jwt.MapClaims{}

		_, _, err := p.ParseUnverified(authHeader[0][7:], claims)
		if err != nil {
			claims["error"] = "error parsing jwt: " + err.Error()
		}

		session["access_token_claims"] = claims
	}

	if headers.Get("X-Hasura-Admin-Secret") != "" {
		//nolint:forcetypeassert
		session["hasura_headers"].(map[string]any)["X-Hasura-Admin-Secret-Present"] = true
	}

	for k, v := range headers {
		if strings.HasPrefix(k, "X-Hasura-") && k != "X-Hasura-Admin-Secret" {
			//nolint:forcetypeassert
			session["hasura_headers"].(map[string]any)[k] = v
		}
	}

	return session
}
