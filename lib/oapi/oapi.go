package oapi

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/lib/oapi/example/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func surfaceErrorsMiddleWare(c *gin.Context) {
	// this captures two cases as far as I can see:
	// 1. request validation errors where the strict generated code fails
	//    to bind the request to the struct (i.e. "invalid param" test)
	// 2. when a handler returns an error instead of a response
	c.Next()

	if len(c.Errors) > 0 && !c.IsAborted() {
		var errorCode string
		switch c.Writer.Status() {
		case http.StatusBadRequest:
			errorCode = "bad-request"
		default:
			errorCode = "internal-server-error"
		}

		c.JSON(
			c.Writer.Status(),
			gin.H{"errors": errorCode, "message": c.Errors[0].Error()},
		)
	}
}

func NewRouter[T any](
	schema []byte,
	apiPrefix string,
	handler T,
	registerHandlerFn func(gin.IRouter, T, api.GinServerOptions),
	authenticationFunc openapi3filter.AuthenticationFunc,
	logger *slog.Logger,
) (*gin.Engine, error) {
	router := gin.New()

	loader := openapi3.NewLoader()

	doc, err := loader.LoadFromData(schema)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI schema: %w", err)
	}

	doc.AddServer(&openapi3.Server{ //nolint:exhaustruct
		URL: apiPrefix,
	})

	router.Use(
		gin.Recovery(),
		middleware.Logger(logger),
		surfaceErrorsMiddleWare,
	)

	mw := api.MiddlewareFunc(requestValidatorWithOptions(doc, authenticationFunc))

	registerHandlerFn(
		router,
		handler,
		api.GinServerOptions{
			BaseURL:      apiPrefix,
			Middlewares:  []api.MiddlewareFunc{mw},
			ErrorHandler: nil,
		},
	)

	return router, nil
}
