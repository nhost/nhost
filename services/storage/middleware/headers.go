package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3filter"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

const HeadersContextKey = "request.headers"

var ErrUnauthorized = errors.New("unauthorized")

func SessionHeadersFromContext(ctx context.Context) http.Header {
	headers, _ := ctx.Value(HeadersContextKey).(http.Header)

	sessionHeaders := http.Header{}
	if headers == nil {
		return sessionHeaders
	}

	for key, values := range headers {
		if strings.HasPrefix(key, "X-Hasura-") || key == "Authorization" {
			for _, value := range values {
				sessionHeaders.Add(key, value)
			}
		}
	}

	return sessionHeaders
}

func AcceptHeaderFromContext(ctx context.Context) []string {
	headers, _ := ctx.Value(HeadersContextKey).(http.Header)
	if headers == nil {
		return nil
	}

	return headers.Values("Accept")
}

func AuthenticationFunc(adminSecret string) openapi3filter.AuthenticationFunc {
	return func(ctx context.Context,
		input *openapi3filter.AuthenticationInput,
	) error {
		if input.SecuritySchemeName == "X-Hasura-Admin-Secret" {
			adminSecretHeader := input.RequestValidationInput.Request.Header.Get(
				"X-Hasura-Admin-Secret",
			)
			if adminSecretHeader != adminSecret {
				return ErrUnauthorized
			}
		}

		c := ginmiddleware.GetGinContext(ctx)
		c.Set(HeadersContextKey, input.RequestValidationInput.Request.Header)

		return nil
	}
}
