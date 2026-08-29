package middleware

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/golang-jwt/jwt/v5"
)

const adminRole = "admin"

var ErrNotAdmin = errors.New("not admin")

func isAuthorizationHeaderAnAdmin(authHeader, roleHeader string) (bool, error) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return false, errors.New("wrong auth header") //nolint:err113
	}

	p := jwt.NewParser()
	claims := jwt.MapClaims{}

	_, _, err := p.ParseUnverified(authHeader[7:], claims)
	if err != nil {
		return false, fmt.Errorf("error parsing jwt: %w", err)
	}

	claims, ok := claims["https://hasura.io/jwt/claims"].(map[string]any)
	if !ok {
		return false, errors.New("error parsing jwt claims") //nolint:err113
	}

	allowedRoles, ok := claims["x-hasura-allowed-roles"].([]any)
	if !ok {
		return false, errors.New("wrong allowed-roles") //nolint:err113
	}

	if !slices.Contains(allowedRoles, adminRole) {
		return false, ErrNotAdmin
	}

	defaultRole, ok := claims["x-hasura-default-role"].(string)
	if !ok {
		return false, errors.New("wrong default role") //nolint:err113
	}

	if roleHeader != "" {
		if roleHeader != adminRole {
			return false, ErrNotAdmin
		}
	} else {
		if defaultRole != adminRole {
			return false, ErrNotAdmin
		}
	}

	return true, nil
}

func IsAdminDirective(
	ctx context.Context,
	obj any,
	next graphql.Resolver,
) (any, error) {
	ginC := GinFromContext(ctx)
	headers := ginC.Request.Header

	authHeader := headers.Get("Authorization")
	if authHeader != "" {
		isAdmin, err := isAuthorizationHeaderAnAdmin(authHeader, headers.Get("X-Hasura-Role"))
		if err != nil {
			return obj, err
		}

		if !isAdmin {
			return obj, ErrNotAdmin
		}
	} else {
		roleHeader := headers.Get("X-Hasura-Role")
		if roleHeader != "" && roleHeader != adminRole {
			return obj, ErrNotAdmin
		}
	}

	return next(ctx)
}
