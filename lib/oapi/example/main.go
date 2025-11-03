package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/lmittmann/tint"
	"github.com/nhost/nhost/lib/oapi"
	"github.com/nhost/nhost/lib/oapi/example/api"
	"github.com/nhost/nhost/lib/oapi/example/controller"
	"github.com/nhost/nhost/services/auth/docs"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

const apiPrefix = "/"

func getLogger() *slog.Logger {
	handler := tint.NewHandler(os.Stdout, &tint.Options{
		AddSource:   true,
		Level:       slog.LevelDebug,
		TimeFormat:  time.StampMilli,
		NoColor:     false,
		ReplaceAttr: nil,
	})

	return slog.New(handler)
}

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

func asd[T any](
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

	mw := api.MiddlewareFunc(oapi.OapiRequestValidatorWithOptions(
		doc, &oapi.Options{ //nolint:exhaustruct
			Options: openapi3filter.Options{ //nolint:exhaustruct
				AuthenticationFunc: authenticationFunc,
			},
		},
	))

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

func authFn(
	ctx context.Context,
	input *openapi3filter.AuthenticationInput,
) error {
	_, ok := ctx.Value(oapi.GinContextKey).(*gin.Context)
	if !ok {
		return &oapi.AuthenticatorError{
			Scheme:  input.SecuritySchemeName,
			Code:    "unauthorized",
			Message: "unable to get context",
		}
	}

	return &oapi.AuthenticatorError{
		Scheme:  input.SecuritySchemeName,
		Code:    "unauthorized",
		Message: "your access token is invalid",
	}
}

func setupRouter(logger *slog.Logger) (*gin.Engine, error) {
	ctrl := controller.NewController()
	handler := api.NewStrictHandler(ctrl, []api.StrictMiddlewareFunc{})

	return asd(
		docs.OpenAPISchema, apiPrefix, handler, api.RegisterHandlersWithOptions, authFn, logger,
	)
}

func run(ctx context.Context) error {
	logger := getLogger()

	router, err := setupRouter(logger) //nolint:contextcheck
	if err != nil {
		return err
	}

	server := &http.Server{ //nolint:exhaustruct
		Addr:              ":8080",
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
	}

	if err := server.ListenAndServe(); err != nil {
		logger.ErrorContext(ctx, "server failed", slog.String("error", err.Error()))
	}

	return nil
}

func main() {
	if err := run(context.Background()); err != nil {
		panic(err)
	}
}
