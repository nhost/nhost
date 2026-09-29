package cmd

import (
	"bytes"
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

// buildRealServeRouter drives the production getRouter so the test exercises
// the exact middleware wiring NewService uses:
// the per-route validatorMW + CaptureRawBody installed via
// RegisterHandlersWithOptions over the full embedded spec, plus the
// engine-mounted /v1/graphql routes that bypass that validator. Unlike the
// hand-maintained buildServeRouter mirror, this catches drift between the
// mirror and getRouter because it calls getRouter itself.
func buildRealServeRouter(t *testing.T, ctrl *controller.Controller) *gin.Engine {
	t.Helper()

	opts := validTestOptions()
	opts.AdminSecret = routerTestAdminSecret

	return buildRouterWithOptions(t, ctrl, opts, slog.New(slog.DiscardHandler))
}

func buildRouterWithOptions(
	t *testing.T, ctrl *controller.Controller, opts Options, logger *slog.Logger,
) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router, err := getRouter(
		context.Background(),
		opts,
		ctrl,
		middleware.NewNoOpJWTAuthenticator(),
		nil, // no hasura proxy: unhandled routes 404, validator-gated routes 401
		logger,
	)
	if err != nil {
		t.Fatalf("getRouter: %v", err)
	}

	if router == nil {
		t.Fatal("getRouter returned a nil router")
	}

	return router
}

// The empty allow-list is the fail-safe default, but it silently breaks
// deployments that relied on the previous permissive "*" CORS, so getRouter
// warns about it exactly once at startup.
func TestGetRouter_WarnsWhenNoCORSOrigins(t *testing.T) {
	t.Parallel()

	const warning = "all cross-origin requests will be denied"

	for _, tt := range []struct {
		name         string
		origins      []string
		wantWarnings int
	}{
		{name: "no origins", origins: nil, wantWarnings: 1},
		{name: "explicit origins", origins: []string{"https://app.example.com"}, wantWarnings: 0},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			opts := validTestOptions()
			opts.CORSAllowedOrigins = tt.origins

			buildRouterWithOptions(
				t, newRouterTestController(t), opts, slog.New(slog.NewTextHandler(&buf, nil)),
			)

			if got := strings.Count(buf.String(), warning); got != tt.wantWarnings {
				t.Errorf(
					"deny-all warning logged %d times, want %d (log: %q)",
					got, tt.wantWarnings, buf.String(),
				)
			}
		})
	}
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
