package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"

	"github.com/gin-gonic/gin"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

var (
	errTestBackground   = errors.New("background failed")
	errTestServiceBuild = errors.New("service build failed")
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

func TestNewMuxPreservesRedirectPrefix(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.GET("/v1/files", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	mux := newMux([]mounted{
		{
			name:   "storage",
			prefix: "/storage",
			svc:    &serveutil.Service{Handler: router},
		},
	})

	redirect := httptest.NewRecorder()
	mux.ServeHTTP(
		redirect,
		httptest.NewRequest(http.MethodGet, "/storage/v1/files/", nil),
	)

	if redirect.Code != http.StatusMovedPermanently {
		t.Fatalf("redirect status = %d, want %d", redirect.Code, http.StatusMovedPermanently)
	}

	location := redirect.Header().Get("Location")
	if location != "/storage/v1/files" {
		t.Fatalf("Location = %q, want %q", location, "/storage/v1/files")
	}

	followed := httptest.NewRecorder()
	mux.ServeHTTP(followed, httptest.NewRequest(http.MethodGet, location, nil))

	if followed.Code != http.StatusOK {
		t.Fatalf("follow-up status = %d, want %d", followed.Code, http.StatusOK)
	}
}

func TestNewMuxRewritesOnlyRootRelativeRedirects(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		status       int
		location     string
		secondStatus int
		wantLocation string
	}{
		{
			name:         "root-relative redirect",
			status:       http.StatusTemporaryRedirect,
			location:     "/v1/files?download=true",
			wantLocation: "/storage/v1/files?download=true",
		},
		{
			name:         "already-prefixed redirect",
			status:       http.StatusTemporaryRedirect,
			location:     "/storage/v1/files",
			wantLocation: "/storage/v1/files",
		},
		{
			name:         "absolute URL redirect",
			status:       http.StatusTemporaryRedirect,
			location:     "https://example.com/v1/files",
			wantLocation: "https://example.com/v1/files",
		},
		{
			name:         "network-path redirect",
			status:       http.StatusTemporaryRedirect,
			location:     "//example.com/v1/files",
			wantLocation: "//example.com/v1/files",
		},
		{
			name:         "non-redirect response",
			status:       http.StatusOK,
			location:     "/v1/files",
			wantLocation: "/v1/files",
		},
		{
			name:         "second WriteHeader is ignored",
			status:       http.StatusOK,
			location:     "/v1/files",
			secondStatus: http.StatusTemporaryRedirect,
			wantLocation: "/v1/files",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Location", tc.location)
				w.WriteHeader(tc.status)

				if tc.secondStatus != 0 {
					w.WriteHeader(tc.secondStatus)
				}
			})
			mux := newMux([]mounted{
				{
					name:   "storage",
					prefix: "/storage",
					svc:    &serveutil.Service{Handler: handler},
				},
			})

			recorder := httptest.NewRecorder()
			mux.ServeHTTP(
				recorder,
				httptest.NewRequest(http.MethodGet, "/storage/v1/files", nil),
			)

			if recorder.Header().Get("Location") != tc.wantLocation {
				t.Fatalf(
					"Location = %q, want %q",
					recorder.Header().Get("Location"), tc.wantLocation,
				)
			}
		})
	}
}

func TestNewMuxPreservesFlusher(t *testing.T) {
	t.Parallel()

	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "http.Flusher unavailable", http.StatusInternalServerError)

			return
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("chunk"))

		flusher.Flush()
	})
	mux := newMux([]mounted{
		{
			name:   "graphql",
			prefix: "/graphql",
			svc:    &serveutil.Service{Handler: handler},
		},
	})

	recorder := httptest.NewRecorder()
	mux.ServeHTTP(
		recorder,
		httptest.NewRequest(http.MethodGet, "/graphql/v1", nil),
	)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	if !recorder.Flushed {
		t.Fatal("http.Flusher did not reach the underlying response writer")
	}
}

func TestSuperviseSharedAttributesBackgroundErrors(t *testing.T) {
	t.Parallel()

	service := &serveutil.Service{
		Handler: http.NotFoundHandler(),
		Background: func(context.Context) error {
			return errTestBackground
		},
		Close: nil,
	}

	err := superviseShared(
		context.Background(),
		serveConfig{bind: "127.0.0.1:0"},
		http.NotFoundHandler(),
		[]mounted{{name: "auth", prefix: "/auth", svc: service}},
		slog.New(slog.DiscardHandler),
	)
	if err == nil {
		t.Fatal("superviseShared() error = nil, want background failure")
	}

	if !errors.Is(err, errTestBackground) {
		t.Fatalf("superviseShared() error = %v, want wrapped %v", err, errTestBackground)
	}

	const want = "running services: auth background: background failed"
	if err.Error() != want {
		t.Fatalf("superviseShared() error = %q, want %q", err, want)
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

func lifecycleDef(
	name string,
	attempted, closed *[]string,
	failAt string,
) serviceDef {
	return serviceDef{
		prefix: "/" + name,
		command: func() *cli.Command {
			return &cli.Command{}
		},
		newService: func(
			_ context.Context, _ *cli.Command, _ *slog.Logger,
		) (*serveutil.Service, error) {
			*attempted = append(*attempted, name)
			if name == failAt {
				return nil, errTestServiceBuild
			}

			return &serveutil.Service{
				Handler:    http.NotFoundHandler(),
				Background: nil,
				Close: func() {
					*closed = append(*closed, name)
				},
			}, nil
		},
		skip:   newSet(),
		hidden: newSet(),
	}
}

func TestBuildAll(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		order         []string
		disabled      map[string]bool
		failAt        string
		wantAttempted []string
		wantMounted   []string
		wantClosed    []string
		wantErr       error
		wantErrText   string
	}{
		{
			name:          "failure closes preceding service exactly once",
			order:         []string{"first", "second"},
			failAt:        "second",
			wantAttempted: []string{"first", "second"},
			wantMounted:   nil,
			wantClosed:    []string{"first"},
			wantErr:       errTestServiceBuild,
			wantErrText:   "initializing second: running second command: service build failed",
		},
		{
			name:          "failure closes in reverse construction order",
			order:         []string{"first", "second", "third"},
			failAt:        "third",
			wantAttempted: []string{"first", "second", "third"},
			wantMounted:   nil,
			wantClosed:    []string{"second", "first"},
			wantErr:       errTestServiceBuild,
			wantErrText:   "initializing third: running third command: service build failed",
		},
		{
			name:  "all services disabled",
			order: serviceOrder(),
			disabled: map[string]bool{
				"auth": true, "storage": true, "graphql": true,
			},
			wantAttempted: nil,
			wantMounted:   nil,
			wantClosed:    nil,
			wantErr:       errAllServicesDisabled,
			wantErrText:   errAllServicesDisabled.Error(),
		},
		{
			name:          "disabled service is skipped",
			order:         serviceOrder(),
			disabled:      map[string]bool{"storage": true},
			wantAttempted: []string{"auth", "graphql"},
			wantMounted:   []string{"auth", "graphql"},
			wantClosed:    nil,
			wantErr:       nil,
			wantErrText:   "",
		},
		{
			name:          "success transfers cleanup ownership",
			order:         serviceOrder(),
			wantAttempted: serviceOrder(),
			wantMounted:   serviceOrder(),
			wantClosed:    nil,
			wantErr:       nil,
			wantErrText:   "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var (
				attempted []string
				closed    []string
			)

			registry := make(map[string]serviceDef, len(tc.order))
			for _, name := range tc.order {
				registry[name] = lifecycleDef(name, &attempted, &closed, tc.failAt)
			}

			got, err := buildAll(
				context.Background(), registry, tc.order, &cli.Command{}, "test",
				slog.New(slog.DiscardHandler), serveConfig{disabled: tc.disabled},
			)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("buildAll() error = %v, want wrapped %v", err, tc.wantErr)
			}

			if tc.wantErrText != "" && err.Error() != tc.wantErrText {
				t.Fatalf("buildAll() error = %q, want %q", err, tc.wantErrText)
			}

			if err == nil {
				t.Cleanup(func() {
					shutdownMounted(got)
				})
			}

			mountedNames := make([]string, 0, len(got))
			for _, service := range got {
				mountedNames = append(mountedNames, service.name)
			}

			if !slices.Equal(attempted, tc.wantAttempted) {
				t.Errorf("construction attempts = %v, want %v", attempted, tc.wantAttempted)
			}

			if !slices.Equal(mountedNames, tc.wantMounted) {
				t.Errorf("mounted services = %v, want %v", mountedNames, tc.wantMounted)
			}

			if !slices.Equal(closed, tc.wantClosed) {
				t.Errorf("closed services = %v, want %v", closed, tc.wantClosed)
			}
		})
	}
}

func TestRunServeErrorsWhenAllServicesDisabled(t *testing.T) {
	t.Parallel()

	err := newApp("test").Run(
		context.Background(),
		[]string{
			"engine", "serve", "--disable-auth", "--disable-storage", "--disable-graphql",
		},
	)
	if !errors.Is(err, errAllServicesDisabled) {
		t.Fatalf("runServe() error = %v, want errAllServicesDisabled", err)
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

func TestBuildServiceSharedConfigPrecedence(t *testing.T) {
	tests := []struct {
		name         string
		flag         string
		env          string
		serviceValue string
		setEnv       bool
		slice        bool
		cfg          serveConfig
		want         []string
	}{
		{
			name:         "scalar service env wins",
			flag:         "hasura-graphql-admin-secret",
			env:          "NHOST_ENGINE_TEST_STORAGE_ADMIN_SECRET_SET",
			serviceValue: "service-secret",
			setEnv:       true,
			cfg:          serveConfig{adminSecret: "shared-secret"},
			want:         []string{"service-secret"},
		},
		{
			name: "scalar global fills unset env",
			flag: "hasura-graphql-admin-secret",
			env:  "NHOST_ENGINE_TEST_STORAGE_ADMIN_SECRET_UNSET",
			cfg:  serveConfig{adminSecret: "shared-secret"},
			want: []string{"shared-secret"},
		},
		{
			name:         "CORS slice service env wins",
			flag:         "cors-allow-origins",
			env:          "NHOST_ENGINE_TEST_STORAGE_CORS_SET",
			serviceValue: "https://service-a.example,https://service-b.example",
			setEnv:       true,
			slice:        true,
			cfg: serveConfig{
				corsOrigins: []string{"https://shared.example"},
			},
			want: []string{"https://service-a.example", "https://service-b.example"},
		},
		{
			name:  "CORS slice global fills unset env",
			flag:  "cors-allow-origins",
			env:   "NHOST_ENGINE_TEST_STORAGE_CORS_UNSET",
			slice: true,
			cfg: serveConfig{
				corsOrigins: []string{"https://shared-a.example", "https://shared-b.example"},
			},
			want: []string{"https://shared-a.example", "https://shared-b.example"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// t.Setenv also registers restoration of a pre-existing value. For an
			// unset-source case, remove the temporary value after registering that
			// cleanup so urfave observes the environment variable as absent.
			t.Setenv(tc.env, tc.serviceValue)

			if !tc.setEnv {
				if err := os.Unsetenv(tc.env); err != nil {
					t.Fatalf("unsetting service env %q: %v", tc.env, err)
				}
			}

			var got []string

			def := serviceDef{
				prefix: "/storage",
				command: func() *cli.Command {
					var flag cli.Flag = &cli.StringFlag{
						Name: tc.flag, Sources: cli.EnvVars(tc.env),
					}
					if tc.slice {
						flag = &cli.StringSliceFlag{
							Name: tc.flag, Sources: cli.EnvVars(tc.env),
						}
					}

					return &cli.Command{Flags: []cli.Flag{flag}}
				},
				newService: func(
					_ context.Context, c *cli.Command, _ *slog.Logger,
				) (*serveutil.Service, error) {
					if tc.slice {
						got = c.StringSlice(tc.flag)
					} else {
						got = []string{c.String(tc.flag)}
					}

					return echoService(), nil
				},
				skip:   newSet(tc.flag),
				hidden: newSet(),
			}

			svc, err := buildService(
				context.Background(), def, "storage", &cli.Command{},
				"test", slog.New(slog.DiscardHandler), tc.cfg,
			)
			if err != nil {
				t.Fatalf("buildService: %v", err)
			}

			if svc == nil {
				t.Fatal("buildService returned nil service")
			}

			if !slices.Equal(got, tc.want) {
				t.Fatalf("%s = %v, want %v", tc.flag, got, tc.want)
			}
		})
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
