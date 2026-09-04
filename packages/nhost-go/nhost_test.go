package nhost_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

func TestGenerateServiceURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		service   nhost.ServiceType
		subdomain string
		region    string
		customURL string
		want      string
	}{
		{
			name:      "cloud",
			service:   nhost.ServiceAuth,
			subdomain: "demo",
			region:    "eu-central-1",
			want:      "https://demo.auth.eu-central-1.nhost.run/v1",
		},
		{
			name:    "local",
			service: nhost.ServiceGraphQL,
			want:    "https://local.graphql.local.nhost.run/v1",
		},
		{
			name:      "custom",
			service:   nhost.ServiceStorage,
			customURL: "http://localhost:1337/v1/storage",
			want:      "http://localhost:1337/v1/storage",
		},
		{
			name:      "scheme-less loopback custom URL",
			service:   nhost.ServiceAuth,
			customURL: "localhost:1337/v1",
			want:      "http://localhost:1337/v1",
		},
		{
			name:      "scheme-less remote custom URL",
			service:   nhost.ServiceAuth,
			customURL: "auth.example.com/v1",
			want:      "https://auth.example.com/v1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := nhost.GenerateServiceURL(tt.service, tt.subdomain, tt.region, tt.customURL)
			if got != tt.want {
				t.Fatalf("GenerateServiceURL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestConfigUseAuthAppliesOnlyToAuth(t *testing.T) {
	t.Parallel()

	type observedRequest struct {
		path   string
		header string
	}

	observed := make(chan observedRequest, 2)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		observed <- observedRequest{path: req.URL.Path, header: req.Header.Get("X-Auth-Only")}

		w.Header().Set("Content-Type", "application/json")

		body := []byte(`{}`)
		if req.URL.Path == "/auth/v1/healthz" {
			body = []byte(`"OK"`)
		}

		if _, err := w.Write(body); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	client := nhost.NewBareClient(nhost.Options{
		AuthURL:      server.URL + "/auth/v1",
		StorageURL:   server.URL + "/storage/v1",
		GraphQLURL:   server.URL + "/graphql/v1",
		FunctionsURL: server.URL + "/functions/v1",
		HTTPClient:   server.Client(),
		Configure: []nhost.ConfigureFunc{
			func(config *nhost.Config) {
				config.UseAuth(func(next http.RoundTripper) http.RoundTripper {
					return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
						req = req.Clone(req.Context())
						req.Header.Set("X-Auth-Only", "yes")

						return next.RoundTrip(req)
					})
				})
			},
		},
	})

	if _, _, err := client.Auth.HealthCheckGet(context.Background(), nil); err != nil {
		t.Fatalf("auth health check: %v", err)
	}

	if _, _, err := client.Functions.Call(
		context.Background(),
		"echo",
		http.MethodGet,
		nil,
		nil,
	); err != nil {
		t.Fatalf("functions call: %v", err)
	}

	gotAuth := <-observed
	if gotAuth.path != "/auth/v1/healthz" || gotAuth.header != "yes" {
		t.Fatalf("auth request = %+v, want auth-only header", gotAuth)
	}

	gotFunctions := <-observed
	if gotFunctions.path != "/functions/v1/echo" || gotFunctions.header != "" {
		t.Fatalf("functions request = %+v, want no auth-only header", gotFunctions)
	}
}

func TestNewServerClientRequiresStorage(t *testing.T) {
	t.Parallel()

	if _, err := nhost.NewServerClient(nhost.Options{}); err == nil {
		t.Fatal("expected error when storage is nil")
	}

	if _, err := nhost.NewServerClient(nhost.Options{
		Storage: &session.MemoryStorage{},
	}); err != nil {
		t.Fatalf("unexpected error with storage: %v", err)
	}
}

func TestPKCERFC7636Vector(t *testing.T) {
	t.Parallel()

	// RFC 7636 Appendix B test vector.
	got := auth.GenerateCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
	if got != "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" {
		t.Fatalf("challenge = %q", got)
	}

	pair := auth.GeneratePKCEPair()
	if len(pair.Verifier) != 43 {
		t.Fatalf("verifier length = %d, want 43", len(pair.Verifier))
	}

	if auth.GenerateCodeChallenge(pair.Verifier) != pair.Challenge {
		t.Fatal("pair challenge does not match verifier")
	}
}
