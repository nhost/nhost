package cmd

import (
	"context"
	"encoding/json/jsontext"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/urfave/cli/v3"
)

const routerTestAdminSecret = "router-test-admin-secret"

// newRouterTestController builds a real *controller.Controller backed by an
// in-memory connector that serves the canned `users` query. This lets a
// POST /v1/graphql request reach the controller's GraphQL handler and produce
// a real `{"data":...}` response, so the assertion that the per-route OpenAPI
// validator does NOT block /v1/graphql is exercised against the production
// handler — not a stub that would 200 regardless.
func newRouterTestController(t *testing.T) *controller.Controller {
	t.Helper()

	usersResponse := jsontext.Value(`[{"id":"1","name":"Alice"}]`)

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	ctrl, err := controller.NewFromConnectors(
		routerTestAdminSecret,
		map[string]connector.Connector{"mem": conn},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("controller.NewFromConnectors: %v", err)
	}

	return ctrl
}

// buildRealServeRouter drives the production getRouter through a real
// cli.Command so the test exercises the exact middleware wiring serve() uses:
// the per-route validatorMW + CaptureRawBody installed via
// RegisterHandlersWithOptions over the full embedded spec, plus the
// engine-mounted /v1/graphql routes that bypass that validator. Unlike the
// hand-maintained buildServeRouter mirror, this catches drift between the
// mirror and getRouter because it calls getRouter itself.
func buildRealServeRouter(t *testing.T, ctrl *controller.Controller) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var router *gin.Engine

	cmd := &cli.Command{
		Name:  "serve",
		Flags: serveFlags(),
		Action: func(ctx context.Context, cmd *cli.Command) error {
			built, err := getRouter(
				ctx,
				cmd,
				ctrl,
				middleware.NewNoOpJWTAuthenticator(),
				nil, // no hasura proxy: unhandled routes 404, validator-gated routes 401
				slog.New(slog.DiscardHandler),
			)
			if err != nil {
				return err
			}

			router = built

			return nil
		},
	}

	err := cmd.Run(context.Background(), []string{
		"serve",
		"--" + flagAdminSecret, routerTestAdminSecret,
		// jwt-secret is required by serveFlags; getRouter does not read it (the
		// authenticator is injected) but the command will not run without it.
		"--" + flagJWTSecret, `{"type":"HS256","key":"router-test-jwt-secret-32-bytes-long!"}`,
		"--" + flagCORSAllowedOrigins, "https://app.example.com",
	})
	if err != nil {
		t.Fatalf("running serve command to build router: %v", err)
	}

	if router == nil {
		t.Fatal("getRouter returned a nil router")
	}

	return router
}

// TestGetRouter_GraphQLNotBlockedByValidator is the regression guarding the
// load-bearing invariant the buildServeRouter mirror cannot cover: the
// embedded OpenAPI spec INCLUDES POST/GET /v1/graphql (with a required
// GraphQLRequest body), yet because getRouter mounts /v1/graphql directly on
// the gin engine — outside the RegisterHandlersWithOptions validator wrapper —
// the per-route validator must never reject a /v1/graphql request. A
// representative GraphQL body must reach the controller handler and return a
// real {"data":...} response. If anyone ever mounts the validator engine-wide,
// this fails loudly in the standard unit run instead of only in gated
// integration tests.
func TestGetRouter_GraphQLNotBlockedByValidator(t *testing.T) {
	t.Parallel()

	router := buildRealServeRouter(t, newRouterTestController(t))

	for _, path := range []string{"/v1/graphql", "/v1"} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(
				http.MethodPost, path,
				strings.NewReader(`{"query":"{ users { id name } }"}`),
			)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Hasura-Admin-Secret", routerTestAdminSecret)

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf(
					"POST %s rejected (validator must not gate it): status = %d, body = %s",
					path, rec.Code, rec.Body.String(),
				)
			}

			if !strings.Contains(rec.Body.String(), `"data"`) {
				t.Errorf(
					"POST %s did not reach the GraphQL handler: body = %s",
					path, rec.Body.String(),
				)
			}
		})
	}
}

// TestGetRouter_MetadataGatedByValidator is the other half of the invariant:
// POST /v1/metadata IS registered through RegisterHandlersWithOptions, so it
// runs through CaptureRawBody + validatorMW + NewAuthFunc. An unauthenticated
// request must be rejected by the auth function (401) rather than reaching the
// metadata handler. This proves the validator/auth wiring is actually
// installed by getRouter on the generated routes — the property buildServeRouter
// (Middlewares: nil) silently disables.
func TestGetRouter_MetadataGatedByValidator(t *testing.T) {
	t.Parallel()

	router := buildRealServeRouter(t, newRouterTestController(t))

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata","args":{}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	// No admin secret, no JWT: the AdminSecret security scheme must reject this.

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf(
			"unauthenticated POST /v1/metadata must be gated by the validator/auth path: "+
				"status = %d, body = %s",
			rec.Code, rec.Body.String(),
		)
	}
}
