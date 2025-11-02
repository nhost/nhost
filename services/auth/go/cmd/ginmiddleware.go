package cmd

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

// ErrorHandler is called when there is an error in validation
type ErrorHandler func(c *gin.Context, err error, statusCode int)

// Options to customize request validation. These are passed through to
// openapi3filter.
type Options struct {
	Options      openapi3filter.Options
	ParamDecoder openapi3filter.ContentParameterDecoder
}

/*
	if errors.Is(err, controller.ErrElevatedClaimRequired) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Elevated claim required"})
		return
	}

	fmt.Printf("err %T\n", err)
	var securityErr *openapi3filter.SecurityRequirementsError
	if errors.As(err, &securityErr) {
		fmt.Println("Security error:", err.Error())
		fmt.Println("Status code: %d\n", statusCode)
		fmt.Println("requirements", securityErr.SecurityRequirements)
		c.AbortWithStatusJSON(statusCode, gin.H{"error": "Unauthorized"})
		return
	}

	fmt.Println("Validation error:", err.Error())
	fmt.Println("Status code: %d\n", statusCode)
	fmt.Println("err", c.Errors)
	c.AbortWithStatusJSON(statusCode, gin.H{"error": err.Error()})
*/

func HandleError(c *gin.Context, err error) {
	var reqErr *openapi3filter.RequestError
	var schemaErr *openapi3.SchemaError
	switch {
	case errors.Is(err, controller.ErrElevatedClaimRequired):
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Elevated claim required"})
	case errors.As(err, &schemaErr):
		fmt.Printf("schema %T\n", schemaErr)
		fmt.Println("field", schemaErr.SchemaField)
		fmt.Println("reason", schemaErr.Reason)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "schema-validation-error",
			"reason": schemaErr.Reason,
		})
	case errors.As(err, &reqErr):
		fmt.Printf("t %T\n", reqErr.Err)
		fmt.Println("Paramter:", reqErr.Parameter)
		fmt.Println("Reason:", reqErr.Reason)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "request-validation-error",
			"reason": reqErr.Reason,
		})
	default:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

// OapiRequestValidatorWithOptions creates a validator from a swagger object, with validation options
func OapiRequestValidatorWithOptions(swagger *openapi3.T, options *Options) gin.HandlerFunc {
	router, err := gorillamux.NewRouter(swagger)
	if err != nil {
		panic(err)
	}
	return func(c *gin.Context) {
		fmt.Println(123)
		err := ValidateRequestFromContext(c, router, options)
		fmt.Println(456, err)
		fmt.Println(999, c.Errors)
		if err != nil {
			HandleError(c, err)
			// // using errors.Is did not work
			// if options != nil && options.ErrorHandler != nil && err.Error() == routers.ErrPathNotFound.Error() {
			// 	options.ErrorHandler(c, err, http.StatusNotFound)
			// 	// in case the handler didn't internally call Abort, stop the chain
			// 	c.Abort()
			// } else if options != nil && options.ErrorHandler != nil {
			// 	options.ErrorHandler(c, err, http.StatusBadRequest)
			// 	// in case the handler didn't internally call Abort, stop the chain
			// 	c.Abort()
			// } else if err.Error() == routers.ErrPathNotFound.Error() {
			// 	// note: i am not sure if this is the best way to handle this
			// 	c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": err.Error()})
			// } else {
			// 	// note: i am not sure if this is the best way to handle this
			// 	c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			// }
		}
		c.Next()
	}
}

// ValidateRequestFromContext is called from the middleware above and actually does the work
// of validating a request.
func ValidateRequestFromContext(c *gin.Context, router routers.Router, options *Options) error {
	req := c.Request
	route, pathParams, err := router.FindRoute(req)
	// We failed to find a matching route for the request.
	if err != nil {
		switch e := err.(type) {
		case *routers.RouteError:
			// We've got a bad request, the path requested doesn't match
			// either server, or path, or something.
			return errors.New(e.Reason)
		default:
			// This should never happen today, but if our upstream code changes,
			// we don't want to crash the server, so handle the unexpected error.
			return fmt.Errorf("error validating route: %s", err.Error())
		}
	}

	validationInput := &openapi3filter.RequestValidationInput{
		Request:    req,
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
		switch e := err.(type) {
		case *openapi3filter.RequestError:
			// We've got a bad request
			// Split up the verbose error by lines and return the first one
			// openapi errors seem to be multi-line with a decent message on the first
			return fmt.Errorf("error in openapi3filter.RequestError: %w", e)
		case *openapi3filter.SecurityRequirementsError:
			return fmt.Errorf("error in openapi3filter.SecurityRequirementsError: %w", e)
		default:
			// This should never happen today, but if our upstream code changes,
			// we don't want to crash the server, so handle the unexpected error.
			return fmt.Errorf("error validating request: %w", err)
		}
	}
	return nil
}
