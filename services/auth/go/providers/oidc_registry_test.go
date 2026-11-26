package providers_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
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

	registry, err := providers.NewOIDCRegistry(config, serverURL, http.DefaultClient, slog.New(slog.DiscardHandler))
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
		{
			name:          "null",
			config:        "null",
			valid:         false,
			errorContains: "must be an object keyed by provider slug",
		},
		{
			name:          "array",
			config:        "[" + valid + "]",
			valid:         false,
			errorContains: "must be an object keyed by provider slug",
		},
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
			name:          "casing typo",
			config:        `{"idp":` + strings.Replace(valid, "clientId", "clientID", 1) + "}",
			valid:         false,
			errorContains: `provider "idp": AUTH_PROVIDER_OIDC contains an unknown, misnamed, or mistyped field (expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)`,
		},
		{
			name:          "trailing comma",
			config:        `{"idp":` + strings.TrimSuffix(valid, "}") + ",}}",
			valid:         false,
			errorContains: "AUTH_PROVIDER_OIDC is not valid JSON or contains an unknown or mistyped field",
		},
		{
			name:          "wrong value type",
			config:        `{"idp":` + strings.Replace(valid, `"web"`, "5", 1) + "}",
			valid:         false,
			errorContains: `provider "idp": AUTH_PROVIDER_OIDC contains an unknown, misnamed, or mistyped field (expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)`,
		},
		{
			name:          "type field",
			config:        `{"idp":` + strings.TrimSuffix(valid, "}") + `,"type":"oidc"}}`,
			valid:         false,
			errorContains: `provider "idp": AUTH_PROVIDER_OIDC contains an unknown, misnamed, or mistyped field (expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)`,
		},
		{
			name:          "string disableNonce",
			config:        `{"idp":` + strings.TrimSuffix(valid, "}") + `,"disableNonce":"sensitive-value"}}`,
			valid:         false,
			errorContains: `provider "idp": AUTH_PROVIDER_OIDC contains an unknown, misnamed, or mistyped field (expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)`,
		},
		{
			name:          "malformed slug with field error",
			config:        `{"sensitive-value/":{"disableNonce":"sensitive-value"}}`,
			valid:         false,
			errorContains: "invalid slug",
		},
		{
			name:          "first field error in slug order",
			config:        `{"zulu":{"type":"sensitive-value"},"alpha":{"disableNonce":"sensitive-value"}}`,
			valid:         false,
			errorContains: `provider "alpha"`,
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

			_, err := providers.NewOIDCRegistry(tt.config, serverURL, http.DefaultClient, slog.New(slog.DiscardHandler))
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

func TestOIDCRegistryEmailScopeWarning(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name        string
		scopes      string
		wantWarning bool
	}{
		{name: "default scopes include email", scopes: "", wantWarning: false},
		{name: "explicit email scope", scopes: `,"scopes":["openid","email"]`, wantWarning: false},
		{name: "email omitted", scopes: `,"scopes":["openid","profile"]`, wantWarning: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var logs bytes.Buffer

			logger := slog.New(slog.NewJSONHandler(&logs, nil))
			config := `{"example":{"issuer":"https://idp.example","clientId":"web","clientSecret":"sensitive-value"` + tt.scopes + `}}`

			registry, err := providers.NewOIDCRegistry(config,
				&url.URL{Scheme: "https", Host: "auth.example"}, http.DefaultClient, logger)
			if err != nil {
				t.Fatal(err)
			}

			if registry.Get("example") == nil {
				t.Fatal("provider must remain enabled without email scope")
			}

			if strings.Contains(logs.String(), "sensitive-value") {
				t.Fatal("warning exposed client secret")
			}

			if !tt.wantWarning {
				if logs.Len() != 0 {
					t.Fatal("unexpected scope warning")
				}

				return
			}

			var record struct {
				Level    string `json:"level"`
				Message  string `json:"msg"`
				Provider string `json:"provider"`
			}
			if err := json.Unmarshal(logs.Bytes(), &record); err != nil {
				t.Fatal(err)
			}

			if record.Level != "WARN" || record.Provider != "example" ||
				!strings.Contains(record.Message, "scopes omit email; new identities require an email claim") {
				t.Fatal("missing actionable email scope warning")
			}
		})
	}
}
