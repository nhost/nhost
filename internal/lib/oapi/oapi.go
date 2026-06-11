package oapi

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

var errNilOpenAPISchema = errors.New("OpenAPI schema is nil")

func surfaceErrorsMiddleWare(c *gin.Context) {
	// Renders a JSON body for errors recorded via c.Error() that no handler
	// turned into a response. Two cases reach here:
	//  1. the generated code fails to bind/decode the request (fed in through
	//     RecordError), and
	//  2. a handler returns an error instead of a response.
	// Errors that already aborted with their own body (e.g. the request
	// validator) set c.IsAborted() and are left untouched.
	c.Next()

	if len(c.Errors) == 0 || c.IsAborted() {
		return
	}

	// A recorded error under a non-error status means no error status was set on
	// the way out (gin defaults to 200, e.g. a multipart body that failed to
	// decode). Surface it as an internal error rather than an error body under a
	// success code.
	status := c.Writer.Status()
	if status < http.StatusBadRequest {
		status = http.StatusInternalServerError
	}

	errorCode := "internal-server-error"
	if status == http.StatusBadRequest {
		errorCode = "bad-request"
	}

	c.JSON(status, gin.H{"error": errorCode, "message": c.Errors[0].Error()})
}

// RecordError is the GinServerOptions.ErrorHandler shared by services. The
// generated request binders call it on a bind/decode failure; it records the
// error and status without writing a body so surfaceErrorsMiddleWare renders it
// in the same shape as handler-returned errors, instead of the codegen default
// ({"msg": ...}) that would otherwise diverge from every other error here.
func RecordError(c *gin.Context, err error, statusCode int) {
	c.Status(statusCode)
	_ = c.Error(err)
}

// NewRouter creates a Gin router with shared OpenAPI middleware and returns the
// per-route request validator middleware to mount with generated handlers.
func NewRouter(
	swagger *openapi3.T,
	apiPrefix string,
	authenticationFunc openapi3filter.AuthenticationFunc,
	corsOptions middleware.CORSOptions,
	logger *slog.Logger,
) (*gin.Engine, func(c *gin.Context), error) {
	if swagger == nil {
		return nil, nil, errNilOpenAPISchema
	}

	corsHandler, err := middleware.CORS(corsOptions)
	if err != nil {
		return nil, nil, fmt.Errorf("building CORS middleware: %w", err)
	}

	if apiPrefix != "" {
		swagger.AddServer(&openapi3.Server{ //nolint:exhaustruct
			URL: apiPrefix,
		})
	}

	router := gin.New()
	// ContextWithFallback lets the *gin.Context that strict handlers receive as
	// their context.Context delegate Value/Deadline/Done/Err to the underlying
	// request context, so request cancellation propagates into handlers.
	router.ContextWithFallback = true

	router.Use(
		gin.Recovery(),
		surfaceErrorsMiddleWare,
		middleware.Tracing(),
		middleware.Logger(logger),
		corsHandler,
	)

	validator, err := newRequestValidator(swagger, authenticationFunc)
	if err != nil {
		return nil, nil, err
	}

	return router, func(c *gin.Context) { validator(c) }, nil
}
