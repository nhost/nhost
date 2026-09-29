package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	authcmd "github.com/nhost/nhost/services/auth/go/cmd"
	"github.com/urfave/cli/v3"
)

var (
	errTestServiceBuild    = errors.New("service build failed")
	errHijackerUnavailable = errors.New("http.Hijacker unavailable")
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

func mustNewMux(
	t *testing.T,
	services []serveutil.Mounted,
	compatAuthHosts []string,
	mountPrefixHosts []string,
) http.Handler {
	t.Helper()

	mux, err := newMux(
		services, compatAuthHosts, mountPrefixHosts, slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("newMux: %v", err)
	}

	return mux
}

func TestNewMuxRoutesEnginePathsAndCompatAuthHosts(t *testing.T) {
	t.Parallel()

	mux := mustNewMux(t, []serveutil.Mounted{
		{Name: "auth", Prefix: "/auth", Service: echoService()},
		{Name: "storage", Prefix: "/storage", Service: echoService()},
		{Name: "graphql", Prefix: "/graphql", Service: echoService()},
	}, []string{
		"hasura-auth-service",
		"",
		" hasura-auth-service ",
		"hasura-auth-service.nhost-project.svc.cluster.local",
	}, nil)

	tests := []struct {
		name     string
		host     string
		path     string
		wantCode int
		wantBody string
	}{
		{
			name:     "compat short host reaches auth with path unchanged",
			host:     "hasura-auth-service",
			path:     "/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "compat short host with legacy port reaches auth",
			host:     "hasura-auth-service:4000",
			path:     "/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "mixed-case compat short host reaches auth",
			host:     "Hasura-Auth-Service",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "mixed-case compat short host with port reaches auth",
			host:     "HASURA-AUTH-SERVICE:4000",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "root-anchored compat short host reaches auth",
			host:     "hasura-auth-service.",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "root-anchored compat short host with port reaches auth",
			host:     "hasura-auth-service.:4000",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "compat host keeps engine auth route",
			host:     "hasura-auth-service",
			path:     "/auth/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "compat host keeps engine storage route",
			host:     "hasura-auth-service",
			path:     "/storage/v1/files",
			wantCode: http.StatusOK,
			wantBody: "/v1/files",
		},
		{
			name:     "compat host keeps engine graphql route",
			host:     "hasura-auth-service",
			path:     "/graphql/v1",
			wantCode: http.StatusOK,
			wantBody: "/v1",
		},
		{
			name:     "compat host keeps engine health route",
			host:     "hasura-auth-service",
			path:     "/healthz",
			wantCode: http.StatusOK,
			wantBody: "ok",
		},
		{
			name:     "explicit compat FQDN reaches auth",
			host:     "hasura-auth-service.nhost-project.svc.cluster.local:4000",
			path:     "/v1/token",
			wantCode: http.StatusOK,
			wantBody: "/v1/token",
		},
		{
			name:     "root-anchored compat FQDN reaches auth",
			host:     "hasura-auth-service.nhost-project.svc.cluster.local.",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "mixed-case root-anchored compat FQDN reaches auth",
			host:     "Hasura-Auth-Service.Nhost-Project.Svc.Cluster.Local.",
			path:     "/v1/version",
			wantCode: http.StatusOK,
			wantBody: "/v1/version",
		},
		{
			name:     "unsupplied FQDN is not routed",
			host:     "hasura-auth-service.other.svc.cluster.local:4000",
			path:     "/v1/token",
			wantCode: http.StatusNotFound,
		},
		{
			name:     "engine auth route remains prefix stripped",
			path:     "/auth/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "engine storage route remains prefix stripped",
			path:     "/storage/v1/files",
			wantCode: http.StatusOK,
			wantBody: "/v1/files",
		},
		{
			name:     "engine graphql route remains prefix stripped",
			path:     "/graphql/v1/metadata",
			wantCode: http.StatusOK,
			wantBody: "/v1/metadata",
		},
		{
			name:     "engine healthz route remains available",
			path:     "/healthz",
			wantCode: http.StatusOK,
			wantBody: "ok",
		},
		{
			name:     "unknown prefix is not found",
			path:     "/nope/v1",
			wantCode: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tc.path, nil)

			if tc.host != "" {
				request.Host = tc.host
			}

			mux.ServeHTTP(recorder, request)

			if recorder.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", recorder.Code, tc.wantCode)
			}

			if tc.wantBody != "" && recorder.Body.String() != tc.wantBody {
				t.Fatalf("body = %q, want %q", recorder.Body.String(), tc.wantBody)
			}
		})
	}
}

func TestEngineDefaultsAuthToV1OnRealMux(t *testing.T) {
	const authPrefixEnv = "AUTH_API_PREFIX"

	for _, tc := range []struct {
		name          string
		presentEnv    bool
		envValue      string
		wantPrefix    string
		wantRoute     string
		unwantedRoute string
	}{
		{
			name:          "native environment absent",
			wantPrefix:    defaultAuthAPIPrefix,
			wantRoute:     "/auth/v1/signin/email-password",
			unwantedRoute: "/auth/signin/email-password",
		},
		{
			name:          "native environment present but empty",
			presentEnv:    true,
			wantPrefix:    defaultAuthAPIPrefix,
			wantRoute:     "/auth/v1/signin/email-password",
			unwantedRoute: "/auth/signin/email-password",
		},
		{
			name:          "native environment custom",
			presentEnv:    true,
			envValue:      "/custom",
			wantPrefix:    "/custom",
			wantRoute:     "/auth/custom/signin/email-password",
			unwantedRoute: "/auth/v1/signin/email-password",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Isolate the engine default from a developer's ambient auth
			// configuration while preserving any prior value for cleanup.
			t.Setenv(authPrefixEnv, tc.envValue)

			if !tc.presentEnv {
				if err := os.Unsetenv(authPrefixEnv); err != nil {
					t.Fatalf("unsetting %s: %v", authPrefixEnv, err)
				}
			}

			def := serviceRegistry()["auth"]

			var effectivePrefix string

			def.newService = func(
				_ context.Context, cmd *cli.Command, _ *slog.Logger,
			) (*serveutil.Service, error) {
				effectivePrefix = cmd.String("api-prefix")
				serviceMux := http.NewServeMux()
				serviceMux.HandleFunc(effectivePrefix+"/signin/email-password", func(
					w http.ResponseWriter, _ *http.Request,
				) {
					w.WriteHeader(http.StatusNoContent)
				})

				return &serveutil.Service{Handler: serviceMux}, nil
			}

			prefixed := servicePrefixedFlags(
				"auth", def.command().Flags, def.skip, def.hidden,
			)
			runParsed(
				t, prefixed, []string{"--auth-encryption-key", "test-key"},
				func(cmd *cli.Command) {
					svc, err := buildService(
						context.Background(), def, "auth", cmd,
						slog.New(slog.DiscardHandler), serveConfig{},
					)
					if err != nil {
						t.Fatalf("buildService: %v", err)
					}

					mux := mustNewMux(
						t,
						[]serveutil.Mounted{{Name: "auth", Prefix: def.prefix, Service: svc}},
						nil,
						nil,
					)

					for _, route := range []struct {
						path     string
						wantCode int
					}{
						{path: tc.wantRoute, wantCode: http.StatusNoContent},
						{path: tc.unwantedRoute, wantCode: http.StatusNotFound},
					} {
						recorder := httptest.NewRecorder()
						request := httptest.NewRequest(http.MethodPost, route.path, nil)
						mux.ServeHTTP(recorder, request)

						if recorder.Code != route.wantCode {
							t.Errorf(
								"POST %s status = %d, want %d",
								route.path, recorder.Code, route.wantCode,
							)
						}
					}
				},
			)

			if effectivePrefix != tc.wantPrefix {
				t.Fatalf(
					"effective auth api-prefix = %q, want %q",
					effectivePrefix, tc.wantPrefix,
				)
			}
		})
	}
}

func TestEngineDefaultsGraphQLPlaygroundEndpointOnRealMux(t *testing.T) {
	const endpointEnv = "CONSTELLATION_PLAYGROUND_GRAPHQL_ENDPOINT"

	// Isolate the engine-owned endpoint from a developer's ambient
	// Constellation configuration while preserving any prior value for cleanup.
	t.Setenv(endpointEnv, "")

	if err := os.Unsetenv(endpointEnv); err != nil {
		t.Fatalf("unsetting %s: %v", endpointEnv, err)
	}

	def := serviceRegistry()["graphql"]

	var effectiveEndpoint string

	def.newService = func(
		_ context.Context, cmd *cli.Command, _ *slog.Logger,
	) (*serveutil.Service, error) {
		effectiveEndpoint = cmd.String("playground-graphql-endpoint")

		serviceMux := http.NewServeMux()
		if cmd.Bool("enable-playground") {
			serviceMux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(effectiveEndpoint))
			})
		}

		return &serveutil.Service{Handler: serviceMux}, nil
	}

	prefixed := servicePrefixedFlags(
		"graphql", def.command().Flags, def.skip, def.hidden,
	)
	runParsed(t, prefixed, []string{"--graphql-enable-playground"}, func(cmd *cli.Command) {
		svc, err := buildService(
			context.Background(), def, "graphql", cmd,
			slog.New(slog.DiscardHandler), serveConfig{
				adminSecret: "test-admin-secret",
				jwtSecret:   "test-jwt-secret",
			},
		)
		if err != nil {
			t.Fatalf("buildService: %v", err)
		}

		mux := mustNewMux(
			t, []serveutil.Mounted{{Name: "graphql", Prefix: def.prefix, Service: svc}}, nil, nil,
		)
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/graphql/", nil)
		mux.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusOK {
			t.Fatalf("GET /graphql/ status = %d, want %d", recorder.Code, http.StatusOK)
		}

		if got := recorder.Body.String(); got != defaultGraphQLPlaygroundEndpoint {
			t.Fatalf(
				"playground endpoint = %q, want %q",
				got, defaultGraphQLPlaygroundEndpoint,
			)
		}
	})

	if effectiveEndpoint != defaultGraphQLPlaygroundEndpoint {
		t.Fatalf(
			"effective playground endpoint = %q, want %q",
			effectiveEndpoint, defaultGraphQLPlaygroundEndpoint,
		)
	}
}

func TestNormalizeRequestHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		requestHost string
		want        string
	}{
		{name: "host", requestHost: "h", want: "h"},
		{name: "mixed-case host", requestHost: "Example.COM", want: "example.com"},
		{name: "root-anchored host", requestHost: "h.", want: "h"},
		{name: "root-anchored host with port", requestHost: "h.:4000", want: "h:4000"},
		{name: "host with port", requestHost: "h:4000", want: "h:4000"},
		{
			name:        "mixed-case host with port",
			requestHost: "Example.COM:4000",
			want:        "example.com:4000",
		},
		{name: "IPv6 with port", requestHost: "[::1]:8080", want: "[::1]:8080"},
		{name: "root anchor only", requestHost: ".", want: ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := normalizeRequestHost(tc.requestHost); got != tc.want {
				t.Fatalf("normalizeRequestHost(%q) = %q, want %q", tc.requestHost, got, tc.want)
			}
		})
	}
}

func TestNewMuxCompatAuthHostDoesNotRewriteRedirect(t *testing.T) {
	t.Parallel()

	auth := &serveutil.Service{Handler: http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/v1/verify", http.StatusTemporaryRedirect)
		},
	)}
	mux := mustNewMux(t, []serveutil.Mounted{
		{Name: "auth", Prefix: "/auth", Service: auth},
	}, []string{"hasura-auth-service"}, []string{"hasura-auth-service"})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/signin", nil)
	request.Host = "hasura-auth-service:4000"

	mux.ServeHTTP(recorder, request)

	if location := recorder.Header().Get("Location"); location != "/v1/verify" {
		t.Fatalf("Location = %q, want %q", location, "/v1/verify")
	}
}

func TestNewMuxCompatAuthHostsWithAuthDisabled(t *testing.T) {
	t.Parallel()

	mux := mustNewMux(t, []serveutil.Mounted{
		{Name: "storage", Prefix: "/storage", Service: echoService()},
		{Name: "graphql", Prefix: "/graphql", Service: echoService()},
	}, []string{"hasura-auth-service"}, nil)

	tests := []struct {
		name     string
		host     string
		path     string
		wantCode int
		wantBody string
	}{
		{
			name:     "compat host is not registered",
			host:     "hasura-auth-service:4000",
			path:     "/v1/token",
			wantCode: http.StatusNotFound,
		},
		{
			name:     "enabled service remains routed",
			path:     "/storage/v1/files",
			wantCode: http.StatusOK,
			wantBody: "/v1/files",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tc.path, nil)

			if tc.host != "" {
				request.Host = tc.host
			}

			mux.ServeHTTP(recorder, request)

			if recorder.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", recorder.Code, tc.wantCode)
			}

			if tc.wantBody != "" && recorder.Body.String() != tc.wantBody {
				t.Fatalf("body = %q, want %q", recorder.Body.String(), tc.wantBody)
			}
		})
	}
}

func TestNewMuxSkipsMalformedCompatAuthHosts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		host string
	}{
		{name: "port", host: "hasura-auth-service:4000"},
		{name: "scheme", host: "http://hasura-auth-service"},
		{name: "path", host: "hasura-auth-service/auth"},
		{name: "empty DNS label", host: "hasura-auth-service..svc"},
		{name: "over-length DNS label", host: strings.Repeat("a", 64) + ".example"},
		{name: "over-length hostname", host: strings.Repeat("a", 254)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var logs bytes.Buffer

			mux, err := newMux(
				[]serveutil.Mounted{{Name: "auth", Prefix: "/auth", Service: echoService()}},
				[]string{tc.host, "valid-auth.example"},
				nil,
				slog.New(slog.NewTextHandler(&logs, nil)),
			)
			if err != nil {
				t.Fatalf("newMux() error = %v, want malformed host to be skipped", err)
			}

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/v1/token", nil)
			request.Host = "valid-auth.example:4000"
			mux.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusOK {
				t.Fatalf(
					"valid host status = %d, want %d after malformed host",
					recorder.Code,
					http.StatusOK,
				)
			}

			if !strings.Contains(logs.String(), "level=WARN") ||
				!strings.Contains(logs.String(), tc.host) {
				t.Fatalf("warning log = %q, want WARN containing %q", logs.String(), tc.host)
			}
		})
	}
}

func TestNewMuxReturnsErrorForCompatAuthHostConflict(t *testing.T) {
	t.Parallel()

	_, err := newMux(
		[]serveutil.Mounted{
			{Name: "storage", Prefix: "hasura-auth-service", Service: echoService()},
			{Name: "auth", Prefix: "/auth", Service: echoService()},
		},
		[]string{"hasura-auth-service"},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err == nil {
		t.Fatal("newMux() error = nil, want route conflict error")
	}
}

func TestNewMuxPreservesRedirectPrefix(t *testing.T) {
	t.Parallel()

	// The root-anchored form names the same host as the bare one, so a client
	// that fully qualifies the service name must have the prefix restored too.
	for _, host := range []string{
		"nhost-engine-service:8080",
		"nhost-engine-service.:8080",
		"Nhost-Engine-Service:8080",
	} {
		t.Run(host, func(t *testing.T) {
			t.Parallel()

			assertRedirectPrefixPreserved(t, host)
		})
	}
}

func assertRedirectPrefixPreserved(t *testing.T, host string) {
	t.Helper()

	router := gin.New()
	router.GET("/v1/files", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	mux := mustNewMux(t, []serveutil.Mounted{
		{
			Name:    "storage",
			Prefix:  "/storage",
			Service: &serveutil.Service{Handler: router},
		},
	}, nil, []string{"nhost-engine-service"})

	redirect := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/storage/v1/files/", nil)
	request.Host = host
	mux.ServeHTTP(redirect, request)

	if redirect.Code != http.StatusMovedPermanently {
		t.Fatalf("redirect status = %d, want %d", redirect.Code, http.StatusMovedPermanently)
	}

	location := redirect.Header().Get("Location")
	if location != "/storage/v1/files" {
		t.Fatalf("Location = %q, want %q", location, "/storage/v1/files")
	}

	followed := httptest.NewRecorder()
	followRequest := httptest.NewRequest(http.MethodGet, location, nil)
	followRequest.Host = host
	mux.ServeHTTP(followed, followRequest)

	if followed.Code != http.StatusOK {
		t.Fatalf("follow-up status = %d, want %d", followed.Code, http.StatusOK)
	}
}

func TestNewMuxLeavesRedirectUnprefixedByDefault(t *testing.T) {
	t.Parallel()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/v1/files", http.StatusTemporaryRedirect)
	})
	mux := mustNewMux(t, []serveutil.Mounted{
		{
			Name:    "storage",
			Prefix:  "/storage",
			Service: &serveutil.Service{Handler: handler},
		},
	}, nil, nil)

	recorder := httptest.NewRecorder()
	mux.ServeHTTP(
		recorder,
		httptest.NewRequest(http.MethodGet, "/storage/v1/files/", nil),
	)

	if location := recorder.Header().Get("Location"); location != "/v1/files" {
		t.Fatalf("Location = %q, want %q", location, "/v1/files")
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
			mux := mustNewMux(t, []serveutil.Mounted{
				{
					Name:    "storage",
					Prefix:  "/storage",
					Service: &serveutil.Service{Handler: handler},
				},
			}, nil, []string{"nhost-engine-service"})

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/storage/v1/files", nil)
			request.Host = "nhost-engine-service:8080"
			mux.ServeHTTP(recorder, request)

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
	mux := mustNewMux(t, []serveutil.Mounted{
		{
			Name:    "graphql",
			Prefix:  "/graphql",
			Service: &serveutil.Service{Handler: handler},
		},
	}, nil, nil)

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

func TestNewMuxPreservesHijacker(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		mountPrefixHosts []string
	}{
		{name: "without redirect rewriting"},
		{
			name:             "with redirect rewriting",
			mountPrefixHosts: []string{"nhost-engine-service"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			assertNewMuxPreservesHijacker(t, tc.mountPrefixHosts)
		})
	}
}

func assertNewMuxPreservesHijacker(t *testing.T, mountPrefixHosts []string) {
	t.Helper()

	hijackResult := make(chan error, 1)
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			hijackResult <- errHijackerUnavailable

			http.Error(w, errHijackerUnavailable.Error(), http.StatusInternalServerError)

			return
		}

		conn, readWriter, err := hijacker.Hijack()
		if err != nil {
			hijackResult <- err

			return
		}

		_, writeErr := readWriter.WriteString(
			"HTTP/1.1 101 Switching Protocols\r\n" +
				"Connection: Upgrade\r\n" +
				"Upgrade: websocket\r\n\r\n",
		)
		flushErr := readWriter.Flush()

		closeErr := conn.Close()
		hijackResult <- errors.Join(writeErr, flushErr, closeErr)
	})

	mux := mustNewMux(t, []serveutil.Mounted{
		{
			Name:    "graphql",
			Prefix:  "/graphql",
			Service: &serveutil.Service{Handler: handler},
		},
	}, nil, mountPrefixHosts)

	server := httptest.NewServer(mux)
	defer server.Close()

	conn, err := net.Dial("tcp", server.Listener.Addr().String())
	if err != nil {
		t.Fatalf("dialing test server: %v", err)
	}
	defer func() {
		if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Errorf("closing client connection: %v", err)
		}
	}()

	_, err = conn.Write([]byte(
		"GET /graphql/v1 HTTP/1.1\r\n" +
			"Host: nhost-engine-service\r\n" +
			"Connection: Upgrade\r\n" +
			"Upgrade: websocket\r\n\r\n",
	))
	if err != nil {
		t.Fatalf("writing WebSocket upgrade: %v", err)
	}

	response, err := http.ReadResponse(
		bufio.NewReader(conn), &http.Request{Method: http.MethodGet},
	)
	if err != nil {
		t.Fatalf("reading WebSocket upgrade: %v", err)
	}

	if err := response.Body.Close(); err != nil {
		t.Errorf("closing response body: %v", err)
	}

	if response.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf(
			"upgrade status = %d, want %d",
			response.StatusCode, http.StatusSwitchingProtocols,
		)
	}

	select {
	case err := <-hijackResult:
		if err != nil {
			t.Fatalf("hijacking connection: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not complete WebSocket upgrade")
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
					&cli.StringFlag{Name: "playground-graphql-endpoint"},
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
			"playground-graphql-endpoint",
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
			switch name {
			case "auth":
				return &cli.Command{Flags: []cli.Flag{&cli.StringFlag{Name: "api-prefix"}}}
			case "graphql":
				return &cli.Command{Flags: []cli.Flag{
					&cli.StringFlag{Name: "playground-graphql-endpoint"},
				}}
			default:
				return &cli.Command{}
			}
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
				Close: serveutil.CloseFunc(func() {
					*closed = append(*closed, name)
				}),
			}, nil
		},
		skip:   newSet(),
		hidden: newSet(),
	}
}

func TestEnabledDefinitions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		order        []string
		disabled     map[string]bool
		wantNames    []string
		wantPrefixes []string
	}{
		{
			name:         "every service gets a definition in mount order",
			order:        serviceOrder(),
			disabled:     nil,
			wantNames:    serviceOrder(),
			wantPrefixes: []string{"/auth", "/storage", "/graphql"},
		},
		{
			name:         "disabled service is skipped",
			order:        serviceOrder(),
			disabled:     map[string]bool{"storage": true},
			wantNames:    []string{"auth", "graphql"},
			wantPrefixes: []string{"/auth", "/graphql"},
		},
		{
			name:  "all services disabled leaves nothing to run",
			order: serviceOrder(),
			disabled: map[string]bool{
				"auth": true, "storage": true, "graphql": true,
			},
			wantNames:    nil,
			wantPrefixes: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var attempted, closed []string

			registry := make(map[string]serviceDef, len(tc.order))
			for _, name := range tc.order {
				registry[name] = lifecycleDef(name, &attempted, &closed, "")
			}

			definitions := enabledDefinitions(
				context.Background(), registry, tc.order, &cli.Command{},
				serveConfig{disabled: tc.disabled}, slog.New(slog.DiscardHandler),
			)

			gotNames := make([]string, 0, len(definitions))
			gotPrefixes := make([]string, 0, len(definitions))

			for _, definition := range definitions {
				gotNames = append(gotNames, definition.Name)
				gotPrefixes = append(gotPrefixes, definition.Prefix)
			}

			if !slices.Equal(gotNames, tc.wantNames) {
				t.Errorf("definition names = %v, want %v", gotNames, tc.wantNames)
			}

			if !slices.Equal(gotPrefixes, tc.wantPrefixes) {
				t.Errorf("definition prefixes = %v, want %v", gotPrefixes, tc.wantPrefixes)
			}

			// Each definition must defer to buildService, which is what actually
			// reparses the service's flags and injects the shared globals.
			for _, definition := range definitions {
				service, err := definition.Build(
					context.Background(), slog.New(slog.DiscardHandler),
				)
				if err != nil {
					t.Fatalf("Build(%s): %v", definition.Name, err)
				}

				if err := service.Close(context.Background()); err != nil {
					t.Fatalf("Close(%s): %v", definition.Name, err)
				}
			}

			if !slices.Equal(attempted, tc.wantNames) {
				t.Errorf("construction attempts = %v, want %v", attempted, tc.wantNames)
			}

			if !slices.Equal(closed, tc.wantNames) {
				t.Errorf("closed services = %v, want %v", closed, tc.wantNames)
			}
		})
	}
}

func TestLogStartupReportsVersionBeforeRedactedFlags(t *testing.T) {
	t.Parallel()

	const rawSecret = "must-not-appear"

	runParsed(
		t,
		[]cli.Flag{
			&cli.StringFlag{Name: "auth-client-secret"},
			&cli.StringFlag{Name: "auth-api-prefix"},
		},
		[]string{
			"--auth-client-secret", rawSecret,
			"--auth-api-prefix", "/v1",
		},
		func(cmd *cli.Command) {
			var logs bytes.Buffer

			logStartup(
				context.Background(), slog.New(slog.NewTextHandler(&logs, nil)), cmd, "test",
			)

			got := logs.String()
			versionAt := strings.Index(got, "engine vtest")
			flagsAt := strings.Index(got, "starting program")

			if versionAt < 0 || flagsAt < 0 || versionAt > flagsAt {
				t.Fatalf("startup logs = %q, want version before resolved flags", got)
			}

			if strings.Contains(got, rawSecret) {
				t.Fatalf("startup logs contain prefixed secret: %q", got)
			}

			if !strings.Contains(got, "flags.auth-client-secret=********") {
				t.Fatalf("startup logs = %q, want redacted prefixed secret", got)
			}

			if !strings.Contains(got, "flags.auth-api-prefix=/v1") {
				t.Fatalf("startup logs = %q, want resolved non-secret flag", got)
			}
		},
	)
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
		slog.New(slog.DiscardHandler), cfg,
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
		required     bool
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
			name:         "scalar global replaces empty required service env",
			flag:         "postgres-migrations-source",
			env:          "NHOST_ENGINE_TEST_STORAGE_MIGRATIONS_EMPTY",
			serviceValue: "",
			setEnv:       true,
			required:     true,
			cfg:          serveConfig{migrationsURL: "postgres://shared/db"},
			want:         []string{"postgres://shared/db"},
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
		{
			name:         "CORS slice global replaces empty service env",
			flag:         "cors-allow-origins",
			env:          "NHOST_ENGINE_TEST_STORAGE_CORS_EMPTY",
			serviceValue: "",
			setEnv:       true,
			slice:        true,
			cfg: serveConfig{
				corsOrigins: []string{"https://shared.example"},
			},
			want: []string{"https://shared.example"},
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
						Name: tc.flag, Sources: cli.EnvVars(tc.env), Required: tc.required,
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
				slog.New(slog.DiscardHandler), tc.cfg,
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

func TestBuildServiceEmptyPrefixedAuthEnvMatchesStandalone(t *testing.T) {
	tests := []struct {
		name string
		env  string
	}{
		{"empty uint", "AUTH_SMTP_PORT"},
		{"empty enum", "AUTH_GRAVATAR_DEFAULT"},
		{"empty duration", "AUTH_SMS_GENERIC_TIMEOUT"},
		{"empty renamed string", "AUTH_DEFAULT_ROLE"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("AUTH_ENCRYPTION_KEY", "k")
			t.Setenv("AUTH_USER_DEFAULT_ROLE", "member")
			t.Setenv(tc.env, "")

			var standalone authcmd.Options

			app := &cli.Command{
				Name:  "auth",
				Flags: authcmd.CommandServe().Flags,
				Action: func(_ context.Context, cmd *cli.Command) error {
					standalone = authcmd.OptionsFromCommand(cmd)

					return nil
				},
			}
			if err := app.Run(context.Background(), []string{
				"auth", "--api-prefix", defaultAuthAPIPrefix,
			}); err != nil {
				t.Fatalf("parsing standalone auth flags: %v", err)
			}

			def := serviceRegistry()["auth"]

			var engine authcmd.Options

			def.newService = func(
				_ context.Context, cmd *cli.Command, _ *slog.Logger,
			) (*serveutil.Service, error) {
				engine = authcmd.OptionsFromCommand(cmd)

				return echoService(), nil
			}

			runParsed(
				t, servicePrefixedFlags("auth", def.command().Flags, def.skip, def.hidden), nil,
				func(cmd *cli.Command) {
					if _, err := buildService(
						context.Background(), def, "auth", cmd,
						slog.New(slog.DiscardHandler), serveConfig{},
					); err != nil {
						t.Fatalf("buildService: %v", err)
					}
				},
			)

			if diff := cmp.Diff(standalone, engine); diff != "" {
				t.Fatalf("auth Options differ from standalone (-standalone +engine):\n%s", diff)
			}
		})
	}
}

func TestBuildServiceRealCORSSourcePrecedence(t *testing.T) {
	tests := []struct {
		name       string
		service    string
		flag       string
		env        string
		serviceEnv string
		setEnv     bool
		cfg        serveConfig
		want       []string
	}{
		{
			name:       "graphql explicit empty preserves deny all",
			service:    "graphql",
			flag:       "cors-allowed-origins",
			env:        "CONSTELLATION_CORS_ALLOWED_ORIGINS",
			serviceEnv: "",
			setEnv:     true,
			cfg: serveConfig{
				adminSecret: "shared-admin", jwtSecret: "shared-jwt",
				corsOrigins: []string{"https://global.example"},
			},
			want: []string{},
		},
		{
			name:       "storage empty source does not retain wildcard default",
			service:    "storage",
			flag:       "cors-allow-origins",
			env:        "CORS_ALLOW_ORIGINS",
			serviceEnv: "",
			setEnv:     true,
			cfg: serveConfig{
				migrationsURL: "postgres://shared/db",
				corsOrigins:   []string{"https://global.example"},
			},
			want: []string{"https://global.example"},
		},
		{
			name:    "storage absent source does not retain wildcard default",
			service: "storage",
			flag:    "cors-allow-origins",
			env:     "CORS_ALLOW_ORIGINS",
			cfg: serveConfig{
				migrationsURL: "postgres://shared/db",
				corsOrigins:   []string{"https://global.example"},
			},
			want: []string{"https://global.example"},
		},
		{
			name:       "storage non-empty source wins",
			service:    "storage",
			flag:       "cors-allow-origins",
			env:        "CORS_ALLOW_ORIGINS",
			serviceEnv: "https://storage.example",
			setEnv:     true,
			cfg: serveConfig{
				migrationsURL: "postgres://shared/db",
				corsOrigins:   []string{"https://global.example"},
			},
			want: []string{"https://storage.example"},
		},
		{
			name:       "graphql non-empty source wins",
			service:    "graphql",
			flag:       "cors-allowed-origins",
			env:        "CONSTELLATION_CORS_ALLOWED_ORIGINS",
			serviceEnv: "https://graphql.example",
			setEnv:     true,
			cfg: serveConfig{
				adminSecret: "shared-admin", jwtSecret: "shared-jwt",
				corsOrigins: []string{"https://global.example"},
			},
			want: []string{"https://graphql.example"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(tc.env, tc.serviceEnv)

			if !tc.setEnv {
				if err := os.Unsetenv(tc.env); err != nil {
					t.Fatalf("unsetting service env %q: %v", tc.env, err)
				}
			}

			var got []string

			def := serviceRegistry()[tc.service]
			def.newService = func(
				_ context.Context, cmd *cli.Command, _ *slog.Logger,
			) (*serveutil.Service, error) {
				got = cmd.StringSlice(tc.flag)

				return echoService(), nil
			}

			svc, err := buildService(
				context.Background(), def, tc.service, &cli.Command{},
				slog.New(slog.DiscardHandler), tc.cfg,
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

func TestBuildServiceRealEmptySecretSource(t *testing.T) {
	const adminEnv = "HASURA_GRAPHQL_ADMIN_SECRET"

	t.Run("shared global replaces empty source", func(t *testing.T) {
		t.Setenv(adminEnv, "")

		var got string

		def := serviceRegistry()["storage"]
		def.newService = func(
			_ context.Context, cmd *cli.Command, _ *slog.Logger,
		) (*serveutil.Service, error) {
			got = cmd.String("hasura-graphql-admin-secret")

			return echoService(), nil
		}

		_, err := buildService(
			context.Background(), def, "storage", &cli.Command{},
			slog.New(slog.DiscardHandler), serveConfig{
				adminSecret: "shared-secret", migrationsURL: "postgres://shared/db",
			},
		)
		if err != nil {
			t.Fatalf("buildService: %v", err)
		}

		if got != "shared-secret" {
			t.Fatalf("hasura-graphql-admin-secret = %q, want shared-secret", got)
		}
	})

	t.Run("required empty source without global fails", func(t *testing.T) {
		t.Setenv(adminEnv, "")

		def := serviceRegistry()["storage"]
		baseCommand := def.command
		def.command = func() *cli.Command {
			command := baseCommand()
			for _, flag := range command.Flags {
				if slices.Contains(flag.Names(), "hasura-graphql-admin-secret") {
					adminFlag, ok := flag.(*cli.StringFlag)
					if !ok {
						t.Fatal("hasura-graphql-admin-secret is not a StringFlag")
					}

					adminFlag.Required = true

					return command
				}
			}

			t.Fatal("hasura-graphql-admin-secret flag not found")

			return nil
		}

		_, err := buildService(
			context.Background(), def, "storage", &cli.Command{},
			slog.New(slog.DiscardHandler),
			serveConfig{migrationsURL: "postgres://shared/db"},
		)
		if !errors.Is(err, errMissingRequired) {
			t.Fatalf("err = %v, want errMissingRequired", err)
		}
	})
}

func TestBuildServiceErrorsWhenRequiredConsolidatedFlagUnset(t *testing.T) {
	const adminEnv = "NHOST_ENGINE_TEST_GRAPHQL_ADMIN_SECRET"

	tests := []struct {
		name       string
		presentEnv bool
	}{
		{name: "environment variable absent"},
		{name: "environment variable present but empty", presentEnv: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(adminEnv, "")

			if !tc.presentEnv {
				if err := os.Unsetenv(adminEnv); err != nil {
					t.Fatalf("unsetting service env %q: %v", adminEnv, err)
				}
			}

			var gotAdmin string

			def := graphqlLikeDef(t, &gotAdmin)
			baseCommand := def.command
			def.command = func() *cli.Command {
				command := baseCommand()

				adminFlag, ok := command.Flags[0].(*cli.StringFlag)
				if !ok {
					t.Fatal("test admin-secret flag is not a StringFlag")
				}

				adminFlag.Sources = cli.EnvVars(adminEnv)

				return command
			}

			// No adminSecret in cfg: even a present-but-empty native environment
			// variable must fail the engine's post-injection required check.
			cfg := serveConfig{jwtSecret: "shared-jwt"}

			_, err := buildService(
				context.Background(), def, "graphql", &cli.Command{},
				slog.New(slog.DiscardHandler), cfg,
			)
			if !errors.Is(err, errMissingRequired) {
				t.Fatalf("err = %v, want errMissingRequired", err)
			}
		})
	}
}
