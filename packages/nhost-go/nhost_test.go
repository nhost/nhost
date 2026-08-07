package nhost_test

import (
	"testing"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
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

func TestCreateServerClientRequiresStorage(t *testing.T) {
	t.Parallel()

	if _, err := nhost.CreateServerClient(nhost.Options{}); err == nil {
		t.Fatal("expected error when storage is nil")
	}

	if _, err := nhost.CreateServerClient(nhost.Options{
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
