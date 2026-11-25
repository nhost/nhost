package providers_test

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/providers"
)

func TestOIDCRegistry(t *testing.T) {
	t.Parallel()

	config := `{
		"google":{"issuer":"https://issuer.example","clientId":"google","clientSecret":"test-only"},
		"authentik":{"issuer":"https://authentik.example","clientId":"web","clientSecret":"test-only",
			"discoveryUrl":"https://authentik.example/metadata","disableNonce":true}
	}`
	serverURL := &url.URL{Scheme: "https", Host: "auth.example"}

	registry, err := providers.NewOIDCRegistry(config, serverURL, http.DefaultClient)
	if err != nil {
		t.Fatal(err)
	}

	all := registry.All()
	if len(all) != 2 || all[0].ID() != "oidc:authentik" || all[1].ID() != "oidc:google" {
		t.Fatal("expected separate custom provider IDs in slug order")
	}

	if google := registry.Get("google"); google == nil ||
		google.Issuer() != "https://issuer.example" || google.ClientID() != "google" {
		t.Fatal("expected an independently configured custom provider named google")
	}

	if registry.Get("oidc:google") != nil || registry.Get("missing") != nil {
		t.Fatal("only configured bare slugs should resolve")
	}
}

func TestOIDCRegistryConfiguration(t *testing.T) {
	t.Parallel()

	valid := `{"issuer":"https://idp.example","clientId":"web","clientSecret":"sensitive-value"}`

	tests := []struct {
		name          string
		config        string
		valid         bool
		errorContains string
	}{
		{name: "unset", config: "", valid: true},
		{name: "empty object", config: "{}", valid: true},
		{name: "null", config: "null", valid: false},
		{name: "array", config: "[" + valid + "]", valid: false},
		{name: "duplicate slug", config: `{"one":` + valid + `,"one":` + valid + "}", valid: false},
		{name: "uppercase slug", config: `{"OIDC":` + valid + "}", valid: false},
		{
			name:          "secret in malformed slug",
			config:        `{"sensitive-value/":` + valid + "}",
			valid:         false,
			errorContains: "invalid slug",
		},
		{
			name: "identify invalid provider",
			config: `{"valid":` + valid + `,"broken":` + strings.Replace(
				valid,
				"https://",
				"http://",
				1,
			) + "}",
			valid:         false,
			errorContains: `provider "broken"`,
		},
		{
			name:          "first invalid provider in slug order",
			config:        `{"zulu":{},"alpha":{"clientSecret":"sensitive-value"}}`,
			valid:         false,
			errorContains: `provider "alpha"`,
		},
		{name: "one-letter slug", config: `{"a":` + valid + "}", valid: false},
		{name: "trailing hyphen", config: `{"a-":` + valid + "}", valid: false},
		{
			name:   "long slug",
			config: `{"` + strings.Repeat("a", 41) + `":` + valid + "}",
			valid:  false,
		},
		{
			name:   "non-HTTPS issuer",
			config: `{"idp":` + strings.Replace(valid, "https://", "http://", 1) + "}",
			valid:  false,
		},
		{
			name:   "issuer query",
			config: `{"idp":` + strings.Replace(valid, "idp.example", "idp.example?q=1", 1) + "}",
			valid:  false,
		},
		{
			name:   "issuer credentials",
			config: `{"idp":` + strings.Replace(valid, "idp.example", "user@idp.example", 1) + "}",
			valid:  false,
		},
		{
			name:   "type field",
			config: `{"idp":` + strings.TrimSuffix(valid, "}") + `,"type":"oidc"}}`,
			valid:  false,
		},
		{
			name: "non-HTTPS discovery",
			config: `{"idp":` + strings.TrimSuffix(
				valid,
				"}",
			) + `,"discoveryUrl":"http://idp.example"}}`,
			valid: false,
		},
		{
			name:   "scopes missing openid",
			config: `{"idp":` + strings.TrimSuffix(valid, "}") + `,"scopes":["email"]}}`,
			valid:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			serverURL := &url.URL{Scheme: "https", Host: "auth.example"}

			_, err := providers.NewOIDCRegistry(tt.config, serverURL, http.DefaultClient)
			if (err == nil) != tt.valid {
				t.Fatalf("validation error = %v, want valid = %t", err, tt.valid)
			}

			if tt.errorContains != "" &&
				(err == nil || !strings.Contains(err.Error(), tt.errorContains)) {
				t.Errorf("validation error = %v, want substring %q", err, tt.errorContains)
			}

			if err != nil && strings.Contains(err.Error(), "sensitive-value") {
				t.Error("configuration error exposed the client secret")
			}
		})
	}
}
