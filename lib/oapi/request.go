package oapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/auth/go/controller"
)

type ContextKey string

const (
	GinContextKey ContextKey = "nhost-oapi/gin-context"
)

func handleError(c *gin.Context, err error) {
	var (
		errReq    *openapi3filter.RequestError
		errSchema *openapi3.SchemaError
		errAuth   *AuthenticatorError
		errSec    *openapi3filter.SecurityRequirementsError
	)
	switch {
	case errors.Is(err, controller.ErrElevatedClaimRequired):
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Elevated claim required"})
	case errors.As(err, &errSchema):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "schema-validation-error",
			"reason": errSchema.Reason,
		})
	case errors.As(err, &errReq):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "request-validation-error",
			"reason": errReq.Err.Error(),
		})
	case errors.As(err, &errAuth):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":          errAuth.Code,
			"reason":         errAuth.Message,
			"securityScheme": errAuth.Scheme,
		})
	case errors.As(err, &errSec):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":  "unauthorized",
			"reason": errSec.Error(),
		})
	default:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func requestValidatorWithOptions(
	swagger *openapi3.T,
	authFn openapi3filter.AuthenticationFunc,
) gin.HandlerFunc {
	router, err := gorillamux.NewRouter(swagger)
	if err != nil {
		panic(err)
	}

	return func(c *gin.Context) {
		if err := validateRequestFromContext(c, router, authFn); err != nil {
			handleError(c, err)
		}

		c.Next()
	}
}

func validateRequestFromContext(
	c *gin.Context,
	router routers.Router,
	authFn openapi3filter.AuthenticationFunc,
) error {
	route, pathParams, err := router.FindRoute(c.Request)
	if err != nil {
		var e *routers.RouteError
		switch {
		case errors.As(err, &e):
			return e
		default:
			return fmt.Errorf("error validating route: %w", err)
		}
	}

	validationInput := &openapi3filter.RequestValidationInput{ //nolint:exhaustruct
		Request:    c.Request,
		PathParams: pathParams,
		Route:      route,
		Options: &openapi3filter.Options{
			AuthenticationFunc:          authFn,
			ExcludeRequestBody:          false,
			ExcludeRequestQueryParams:   false,
			ExcludeResponseBody:         false,
			ExcludeReadOnlyValidations:  false,
			ExcludeWriteOnlyValidations: false,
			IncludeResponseStatus:       false,
			MultiError:                  false,
			RegexCompiler:               nil,
			SkipSettingDefaults:         false,
		},
	}

	requestContext := context.WithValue(c.Request.Context(), GinContextKey, c)
	if err := openapi3filter.ValidateRequest(requestContext, validationInput); err != nil {
		return err //nolint:wrapcheck
	}

	return nil
}
