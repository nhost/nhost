package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

// echoService returns a serve.Service whose handler writes back the request
// path it received, so tests can assert what the service sees after prefix
// stripping.
func echoService() *serveutil.Service {
	return &serveutil.Service{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(r.URL.Path))
		}),
		Background: nil,
		Close:      nil,
	}
}

func TestNewMuxStripsPrefixAndRoutes(t *testing.T) {
	t.Parallel()

	mux := newMux([]mounted{
		{name: "auth", prefix: "/auth", svc: echoService()},
		{name: "storage", prefix: "/storage", svc: echoService()},
		{name: "graphql", prefix: "/graphql", svc: echoService()},
	})

	tests := []struct {
		name     string
		path     string
		wantCode int
		wantBody string
	}{
		{
			name:     "auth request reaches auth with prefix stripped",
			path:     "/auth/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "storage request reaches storage with prefix stripped",
			path:     "/storage/v1/files",
			wantCode: http.StatusOK,
			wantBody: "/v1/files",
		},
		{
			name:     "graphql metadata request reaches constellation",
			path:     "/graphql/v1/metadata",
			wantCode: http.StatusOK,
			wantBody: "/v1/metadata",
		},
		{
			name:     "healthz is served by the engine",
			path:     "/healthz",
			wantCode: http.StatusOK,
			wantBody: "ok",
		},
		{
			name:     "unknown prefix is not found",
			path:     "/nope/v1",
			wantCode: http.StatusNotFound,
			wantBody: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)

			mux.ServeHTTP(rec, req)

			if rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantCode)
			}

			if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
				t.Fatalf("body = %q, want %q", rec.Body.String(), tc.wantBody)
			}
		})
	}
}

// graphqlLikeDef builds a serviceDef mirroring how the real "graphql" service
// is composed: its admin-secret and jwt-secret flags are Required by the
// service yet consolidated into engine globals (so they are in skip). It lets
// buildService be exercised end-to-end through app.Run, which enforces
// Required at parse time — the path applySharedConfig's own unit tests do not
// cover. newService records the value the shared global injected.
func graphqlLikeDef(t *testing.T, gotAdmin *string) serviceDef {
	t.Helper()

	return serviceDef{
		prefix: "/graphql",
		command: func() *cli.Command {
			return &cli.Command{
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "admin-secret", Required: true},
					&cli.StringFlag{Name: "jwt-secret", Required: true},
					&cli.StringFlag{Name: "metadata-database-url"},
					&cli.StringSliceFlag{Name: "cors-allowed-origins"},
				},
			}
		},
		newService: func(
			_ context.Context, c *cli.Command, _ *slog.Logger,
		) (*serveutil.Service, error) {
			*gotAdmin = c.String("admin-secret")

			return &serveutil.Service{
				Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
				}),
			}, nil
		},
		skip: newSet(
			"admin-secret", "jwt-secret", "metadata-database-url", "cors-allowed-origins",
		),
		hidden: newSet(),
	}
}

func TestBuildServiceFillsRequiredConsolidatedFlag(t *testing.T) {
	t.Parallel()

	var gotAdmin string

	def := graphqlLikeDef(t, &gotAdmin)
	cfg := serveConfig{
		adminSecret: "shared-admin",
		jwtSecret:   "shared-jwt",
		databaseURL: "postgres://shared",
	}

	svc, err := buildService(
		context.Background(), def, "graphql", &cli.Command{},
		"test", slog.New(slog.DiscardHandler), cfg,
	)
	if err != nil {
		t.Fatalf("buildService: %v (required consolidated flag not filled by global)", err)
	}

	if svc == nil {
		t.Fatal("buildService returned nil service")
	}

	if gotAdmin != "shared-admin" {
		t.Fatalf("admin-secret = %q, want %q (global not injected)", gotAdmin, "shared-admin")
	}
}

func TestBuildServiceErrorsWhenRequiredConsolidatedFlagUnset(t *testing.T) {
	t.Parallel()

	var gotAdmin string

	def := graphqlLikeDef(t, &gotAdmin)

	// No adminSecret in cfg and none in the environment: the engine must reject
	// it rather than silently starting the service without the required value.
	cfg := serveConfig{jwtSecret: "shared-jwt"}

	_, err := buildService(
		context.Background(), def, "graphql", &cli.Command{},
		"test", slog.New(slog.DiscardHandler), cfg,
	)
	if !errors.Is(err, errMissingRequired) {
		t.Fatalf("err = %v, want errMissingRequired", err)
	}
}
