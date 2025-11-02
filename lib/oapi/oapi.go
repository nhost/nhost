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

const (
	GinContextKey = "oapi-codegen/gin-context"
	UserDataKey   = "oapi-codegen/user-data"
)

// ErrorHandler is called when there is an error in validation.
type ErrorHandler func(c *gin.Context, err error, statusCode int)

// Options to customize request validation. These are passed through to
// openapi3filter.
type Options struct {
	Options      openapi3filter.Options
	ParamDecoder openapi3filter.ContentParameterDecoder
}

func HandleError(c *gin.Context, err error) {
	var (
		reqErr      *openapi3filter.RequestError
		schemaErr   *openapi3.SchemaError
		authErr     *AuthenticatorError
		securityErr *openapi3filter.SecurityRequirementsError
	)
	switch {
	case errors.Is(err, controller.ErrElevatedClaimRequired):
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Elevated claim required"})
	case errors.As(err, &schemaErr):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "schema-validation-error",
			"reason": schemaErr.Reason,
		})
	case errors.As(err, &reqErr):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "request-validation-error",
			"reason": reqErr.Err.Error(),
		})
	case errors.As(err, &authErr):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":          authErr.Code,
			"reason":         authErr.Message,
			"securityScheme": authErr.Scheme,
		})
	case errors.As(err, &securityErr):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":  "unauthorized",
			"reason": securityErr.Error(),
		})
	default:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func OapiRequestValidatorWithOptions(swagger *openapi3.T, options *Options) gin.HandlerFunc {
	router, err := gorillamux.NewRouter(swagger)
	if err != nil {
		panic(err)
	}

	return func(c *gin.Context) {
		if err := ValidateRequestFromContext(c, router, options); err != nil {
			HandleError(c, err)
		}

		c.Next()
	}
}

func ValidateRequestFromContext(c *gin.Context, router routers.Router, options *Options) error {
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
	}

	// Pass the gin context into the request validator, so that any callbacks
	// which it invokes make it available.
	requestContext := context.WithValue(context.Background(), GinContextKey, c) //nolint:staticcheck

	if options != nil {
		validationInput.Options = &options.Options
		validationInput.ParamDecoder = options.ParamDecoder
	}

	err = openapi3filter.ValidateRequest(requestContext, validationInput)
	if err != nil {
		{
			var e *openapi3filter.RequestError
			var e1 *openapi3filter.SecurityRequirementsError
			switch {
			case errors.As(err, &e):
				return fmt.Errorf("error in openapi3filter.RequestError: %w", e)
			case errors.As(err, &e1):
				return fmt.Errorf("error in openapi3filter.SecurityRequirementsError: %w", e1)
			default:
				return fmt.Errorf("error validating request: %w", err)
			}
		}
	}

	return nil
}
