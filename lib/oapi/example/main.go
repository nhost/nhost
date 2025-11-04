package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/lmittmann/tint"
	"github.com/nhost/nhost/lib/oapi"
	"github.com/nhost/nhost/lib/oapi/example/api"
	"github.com/nhost/nhost/lib/oapi/example/controller"
	"github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/docs"
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

	router, mw, err := oapi.NewRouter(
		docs.OpenAPISchema,
		apiPrefix,
		authFn,
		middleware.CORSOptions{ //nolint:exhaustruct
			AllowedOrigins: []string{"*"},
		},
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create oapi router: %w", err)
	}

	api.RegisterHandlersWithOptions(
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
