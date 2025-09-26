// Copyright 2021 DeepMap, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package ginmiddleware

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/gin-gonic/gin"
)

const (
	GinContextKey = "oapi-codegen/gin-context"
	UserDataKey   = "oapi-codegen/user-data"
)

// OapiValidatorFromYamlFile creates a validator middleware from a YAML file path
func OapiValidatorFromYamlFile(path string) (gin.HandlerFunc, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("error reading %s: %s", path, err)
	}

	swagger, err := openapi3.NewLoader().LoadFromData(data)
	if err != nil {
		return nil, fmt.Errorf("error parsing %s as Swagger YAML: %s",
			path, err)
	}
	return OapiRequestValidator(swagger), nil
}

// OapiRequestValidator is an gin middleware function which validates incoming HTTP requests
// to make sure that they conform to the given OAPI 3.0 specification. When
// OAPI validation fails on the request, we return an HTTP/400 with error message
func OapiRequestValidator(swagger *openapi3.T) gin.HandlerFunc {
	return OapiRequestValidatorWithOptions(swagger, nil)
}

// ErrorHandler is called when there is an error in validation
type ErrorHandler func(c *gin.Context, message string, statusCode int)

// MultiErrorHandler is called when oapi returns a MultiError type
type MultiErrorHandler func(openapi3.MultiError) error

// Options to customize request validation. These are passed through to
// openapi3filter.
type Options struct {
	ErrorHandler      ErrorHandler
	Options           openapi3filter.Options
	ParamDecoder      openapi3filter.ContentParameterDecoder
	UserData          interface{}
	MultiErrorHandler MultiErrorHandler
	// SilenceServersWarning allows silencing a warning for https://github.com/deepmap/oapi-codegen/issues/882 that reports when an OpenAPI spec has `spec.Servers != nil`
	SilenceServersWarning bool
}

// OapiRequestValidatorWithOptions creates a validator from a swagger object, with validation options
func OapiRequestValidatorWithOptions(swagger *openapi3.T, options *Options) gin.HandlerFunc {
	if swagger.Servers != nil && (options == nil || !options.SilenceServersWarning) {
		log.Println("WARN: OapiRequestValidatorWithOptions called with an OpenAPI spec that has `Servers` set. This may lead to an HTTP 400 with `no matching operation was found` when sending a valid request, as the validator performs `Host` header validation. If you're expecting `Host` header validation, you can silence this warning by setting `Options.SilenceServersWarning = true`. See https://github.com/deepmap/oapi-codegen/issues/882 for more information.")
	}

	router, err := gorillamux.NewRouter(swagger)
	if err != nil {
		panic(err)
	}
	return func(c *gin.Context) {
		err := ValidateRequestFromContext(c, router, options)
		if err != nil {
			// using errors.Is did not work
			if options != nil && options.ErrorHandler != nil && err.Error() == routers.ErrPathNotFound.Error() {
				options.ErrorHandler(c, err.Error(), http.StatusNotFound)
				// in case the handler didn't internally call Abort, stop the chain
				c.Abort()
			} else if options != nil && options.ErrorHandler != nil {
				options.ErrorHandler(c, err.Error(), http.StatusBadRequest)
				// in case the handler didn't internally call Abort, stop the chain
				c.Abort()
			} else if err.Error() == routers.ErrPathNotFound.Error() {
				// note: i am not sure if this is the best way to handle this
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": err.Error()})
			} else {
				// note: i am not sure if this is the best way to handle this
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			}
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
		requestContext = context.WithValue(requestContext, UserDataKey, options.UserData) //nolint:staticcheck
	}

	err = openapi3filter.ValidateRequest(requestContext, validationInput)
	if err != nil {
		me := openapi3.MultiError{}
		if errors.As(err, &me) {
			errFunc := getMultiErrorHandlerFromOptions(options)
			return errFunc(me)
		}

		switch e := err.(type) {
		case *openapi3filter.RequestError:
			// We've got a bad request
			// Split up the verbose error by lines and return the first one
			// openapi errors seem to be multi-line with a decent message on the first
			errorLines := strings.Split(e.Error(), "\n")
			return fmt.Errorf("error in openapi3filter.RequestError: %s", errorLines[0])
		case *openapi3filter.SecurityRequirementsError:
			return fmt.Errorf("error in openapi3filter.SecurityRequirementsError: %s", e.Error())
		default:
			// This should never happen today, but if our upstream code changes,
			// we don't want to crash the server, so handle the unexpected error.
			return fmt.Errorf("error validating request: %w", err)
		}
	}
	return nil
}

// GetGinContext gets the gin context from within requests. It returns
// nil if not found or wrong type.
func GetGinContext(c context.Context) *gin.Context {
	iface := c.Value(GinContextKey)
	if iface == nil {
		return nil
	}
	ginCtx, ok := iface.(*gin.Context)
	if !ok {
		return nil
	}
	return ginCtx
}

func GetUserData(c context.Context) interface{} {
	return c.Value(UserDataKey)
}

// attempt to get the MultiErrorHandler from the options. If it is not set,
// return a default handler
func getMultiErrorHandlerFromOptions(options *Options) MultiErrorHandler {
	if options == nil {
		return defaultMultiErrorHandler
	}

	if options.MultiErrorHandler == nil {
		return defaultMultiErrorHandler
	}

	return options.MultiErrorHandler
}

// defaultMultiErrorHandler returns a StatusBadRequest (400) and a list
// of all of the errors. This method is called if there are no other
// methods defined on the options.
func defaultMultiErrorHandler(me openapi3.MultiError) error {
	return fmt.Errorf("multiple errors encountered: %s", me)
}
