package controller

import (
	"context"

	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
)

const (
	securitySchemeAdminSecret = "AdminSecret"
	securitySchemeBearerAuth  = "BearerAuth"
)

// NewAuthFunc returns an openapi3filter.AuthenticationFunc that authorizes
// requests against the per-operation `security:` block declared in the spec.
//
// It does NOT verify credentials itself — middleware.Session must run first
// to resolve the request into a SessionVariables on the context. This
// function only checks whether the resolved session satisfies the spec's
// declared scheme(s). AND/OR/anonymous semantics are handled by
// openapi3filter, which calls this function once per scheme.
//
// Scheme mapping:
//   - AdminSecret: satisfied iff the resolved role is "admin".
//   - BearerAuth:  satisfied iff a non-public session was resolved (a valid
//     JWT or the admin secret was presented).
//
// Unknown schemes deny by default — adding a new scheme to the spec without
// updating this function must not silently pass.
func NewAuthFunc() openapi3filter.AuthenticationFunc {
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		c := oapi.GetGinContext(ctx)
		if c == nil {
			return &oapi.AuthenticatorError{
				Scheme:  input.SecuritySchemeName,
				Code:    "unauthorized",
				Message: "no gin context on request",
			}
		}

		session := middleware.SessionFromContext(ctx)
		if session == nil {
			return &oapi.AuthenticatorError{
				Scheme:  input.SecuritySchemeName,
				Code:    "unauthorized",
				Message: "no session resolved; Session middleware must run before request validation",
			}
		}

		switch input.SecuritySchemeName {
		case securitySchemeAdminSecret:
			if session.Role != "admin" {
				return &oapi.AuthenticatorError{
					Scheme:  input.SecuritySchemeName,
					Code:    "unauthorized",
					Message: "admin role required",
				}
			}
		case securitySchemeBearerAuth:
			if session.Role == "" || session.Role == "public" {
				return &oapi.AuthenticatorError{
					Scheme:  input.SecuritySchemeName,
					Code:    "unauthorized",
					Message: "authenticated session required",
				}
			}
		default:
			return &oapi.AuthenticatorError{
				Scheme:  input.SecuritySchemeName,
				Code:    "unauthorized",
				Message: "unsupported security scheme",
			}
		}

		return nil
	}
}
