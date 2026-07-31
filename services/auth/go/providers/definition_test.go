package providers_test

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/providers"
)

const testServerURL = "https://auth.example.com"

func TestDecodeDefinitionsValid(t *testing.T) {
	t.Parallel()

	raw := `{
		"okta": {
			"type": "oidc",
			"clientId": "okta-client-id",
			"clientSecret": "okta-client-secret",
			"issuer": "https://acme.okta.com",
			"audiences": ["native-app-client-id"]
		},
		"legacy": {
			"type": "oauth2",
			"clientId": "legacy-client-id",
			"clientSecret": "legacy-client-secret",
			"authorizationUrl": "https://idp.example.com/authorize",
			"tokenUrl": "https://idp.example.com/token",
			"userinfoUrl": "https://idp.example.com/userinfo",
			"scopes": ["read:user"],
			"claims": {"id": "user_id", "email": "mail"}
		}
	}`

	defs, invalid, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(invalid) != 0 {
		t.Fatalf("expected no invalid entries, got %v", invalid)
	}

	if len(defs) != 2 {
		t.Fatalf("expected 2 definitions, got %d", len(defs))
	}

	okta, ok := defs["okta"].(*providers.OIDCDefinition)
	if !ok {
		t.Fatalf("expected okta to be an OIDCDefinition, got %T", defs["okta"])
	}

	if okta.ID() != "c:okta" {
		t.Errorf("expected ID c:okta, got %q", okta.ID())
	}

	if okta.Issuer() != "https://acme.okta.com" {
		t.Errorf("unexpected issuer: %q", okta.Issuer())
	}

	if okta.RedirectURL != testServerURL+"/signin/provider/c:okta/callback" {
		t.Errorf("unexpected redirect URL: %q", okta.RedirectURL)
	}

	// No scopes configured: the OIDC defaults apply.
	if !slices.Equal(okta.Scopes, []string{"openid", "email", "profile"}) {
		t.Errorf("unexpected default scopes: %v", okta.Scopes)
	}

	legacy, ok := defs["legacy"].(*providers.OAuth2Definition)
	if !ok {
		t.Fatalf("expected legacy to be an OAuth2Definition, got %T", defs["legacy"])
	}

	if legacy.ID() != "c:legacy" {
		t.Errorf("expected ID c:legacy, got %q", legacy.ID())
	}

	if legacy.Issuer() != "" {
		t.Errorf("expected empty issuer for oauth2 type, got %q", legacy.Issuer())
	}

	if legacy.Claims.ID != "user_id" || legacy.Claims.Email != "mail" {
		t.Errorf("unexpected claim mapping: %+v", legacy.Claims)
	}
}

func TestDecodeDefinitionsScopesForceOpenID(t *testing.T) {
	t.Parallel()

	raw := `{
		"okta": {
			"type": "oidc",
			"clientId": "id", "clientSecret": "secret",
			"issuer": "https://acme.okta.com",
			"scopes": ["email"]
		}
	}`

	defs, _, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	okta, ok := defs["okta"].(*providers.OIDCDefinition)
	if !ok {
		t.Fatalf("expected an OIDCDefinition, got %T", defs["okta"])
	}

	if !slices.Contains(okta.Scopes, "openid") {
		t.Errorf("expected openid to be force-added, got %v", okta.Scopes)
	}
}

func TestDecodeDefinitionsBuildIsNetworkFree(t *testing.T) {
	t.Parallel()

	raw := `{
		"okta": {
			"type": "oidc",
			"clientId": "id", "clientSecret": "secret",
			"issuer": "https://acme.okta.com"
		},
		"legacy": {
			"type": "oauth2",
			"clientId": "id", "clientSecret": "secret",
			"authorizationUrl": "https://idp.example.com/authorize",
			"tokenUrl": "https://idp.example.com/token",
			"userinfoUrl": "https://idp.example.com/userinfo"
		}
	}`

	defs, _, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Build must not perform I/O: the issuer above does not resolve, so any
	// network attempt would fail or hang.
	client := &http.Client{}

	provider, validator, err := defs["okta"].Build(t.Context(), client)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if provider == nil || !provider.IsOauth2() {
		t.Error("expected an oauth2 provider")
	}

	if validator == nil {
		t.Error("expected a validator for the oidc type")
	}

	provider, validator, err = defs["legacy"].Build(t.Context(), client)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if provider == nil || !provider.IsOauth2() {
		t.Error("expected an oauth2 provider")
	}

	if validator != nil {
		t.Error("expected no validator for the oauth2 type")
	}
}

func TestDecodeDefinitionsEnvelopeError(t *testing.T) {
	t.Parallel()

	if _, _, err := providers.DecodeDefinitions(
		[]byte(`{not json`),
		testServerURL,
		false,
	); err == nil {
		t.Error("expected envelope error, got nil")
	}

	if _, _, err := providers.DecodeDefinitions(
		[]byte(`["array"]`),
		testServerURL,
		false,
	); err == nil {
		t.Error("expected envelope error, got nil")
	}
}

// TestDecodeDefinitionsAllowInsecureURLs pins the development escape hatch:
// the plaintext authorizationUrl rejected above is accepted when the operator
// has turned on the private-IP flag, so a local IdP stays usable.
func TestDecodeDefinitionsAllowInsecureURLs(t *testing.T) {
	t.Parallel()

	raw := `{"legacy": {"type": "oauth2", "clientId": "id", "clientSecret": "secret",
		"authorizationUrl": "http://localhost:8080/authorize",
		"tokenUrl": "http://localhost:8080/token",
		"userinfoUrl": "http://localhost:8080/userinfo"}}`

	defs, invalid, err := providers.DecodeDefinitions([]byte(raw), testServerURL, true)
	if err != nil {
		t.Fatalf("unexpected envelope error: %v", err)
	}

	if len(invalid) != 0 {
		t.Fatalf("expected the entry to be accepted under the dev flag, got %v", invalid)
	}

	def, ok := defs["legacy"]
	if !ok {
		t.Fatalf("expected the legacy definition, got %v", defs)
	}

	// The stored flag is what decodeOAuth2Definition validates against, so it
	// has to be asserted or the assignment could be dropped unnoticed.
	oauth2Def, ok := def.(*providers.OAuth2Definition)
	if !ok {
		t.Fatalf("expected an *OAuth2Definition, got %T", def)
	}

	if !oauth2Def.AllowInsecureURLs {
		t.Error("expected the decoded definition to carry AllowInsecureURLs")
	}
}

func TestDecodeDefinitionsInvalidEntries(t *testing.T) {
	t.Parallel()

	oidcEntry := func(overrides string) string {
		return `{"type": "oidc", "clientId": "id", "clientSecret": "sup3r-s3cret-value",
			"issuer": "https://acme.okta.com"` + overrides + `}`
	}

	// Slug rules are covered by TestCustomSlugRulesMatchOpenAPIPattern.
	tests := []struct {
		name    string
		slug    string
		entry   string
		wantErr error
	}{
		{
			name:    "unknown type",
			slug:    "okta",
			entry:   `{"type": "saml", "clientId": "id", "clientSecret": "sup3r-s3cret-value"}`,
			wantErr: providers.ErrUnknownProviderType,
		},
		{
			name:    "unknown field",
			slug:    "okta",
			entry:   oidcEntry(`, "unexpected": true`),
			wantErr: nil, // json decode error, no sentinel
		},
		{
			name: "missing client secret",
			slug: "okta",
			entry: `{"type": "oidc", "clientId": "id",
				"issuer": "https://acme.okta.com"}`,
			wantErr: providers.ErrMissingField,
		},
		{
			name: "invalid issuer URL",
			slug: "okta",
			entry: `{"type": "oidc", "clientId": "id", "clientSecret": "sup3r-s3cret-value",
				"issuer": "not-a-url"}`,
			wantErr: providers.ErrInvalidURL,
		},
		{
			name: "oauth2 missing token url",
			slug: "legacy",
			entry: `{"type": "oauth2", "clientId": "id", "clientSecret": "sup3r-s3cret-value",
				"authorizationUrl": "https://idp.example.com/authorize",
				"userinfoUrl": "https://idp.example.com/userinfo"}`,
			wantErr: providers.ErrMissingField,
		},
		{
			// authorizationUrl is never fetched — it becomes a Location
			// header carrying the state JWT — so nothing downstream can
			// enforce the scheme for it.
			name: "oauth2 plaintext authorization url",
			slug: "legacy",
			entry: `{"type": "oauth2", "clientId": "id", "clientSecret": "sup3r-s3cret-value",
				"authorizationUrl": "http://idp.example.com/authorize",
				"tokenUrl": "https://idp.example.com/token",
				"userinfoUrl": "https://idp.example.com/userinfo"}`,
			wantErr: providers.ErrInvalidURL,
		},
		{
			name: "oauth2 relative authorization url",
			slug: "legacy",
			entry: `{"type": "oauth2", "clientId": "id", "clientSecret": "sup3r-s3cret-value",
				"authorizationUrl": "/authorize",
				"tokenUrl": "https://idp.example.com/token",
				"userinfoUrl": "https://idp.example.com/userinfo"}`,
			wantErr: providers.ErrInvalidURL,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			raw := `{"` + tc.slug + `": ` + tc.entry + `}`

			defs, invalid, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
			if err != nil {
				t.Fatalf("unexpected envelope error: %v", err)
			}

			if len(defs) != 0 {
				t.Fatalf("expected no valid definitions, got %v", defs)
			}

			entryErr, ok := invalid[tc.slug]
			if !ok {
				t.Fatalf("expected %q in invalid entries, got %v", tc.slug, invalid)
			}

			if tc.wantErr != nil && !errors.Is(entryErr, tc.wantErr) {
				t.Errorf("expected %v, got: %v", tc.wantErr, entryErr)
			}

			// Redaction: entry errors are logged at startup — they must
			// never carry secret material.
			if strings.Contains(entryErr.Error(), "sup3r-s3cret-value") {
				t.Errorf("entry error leaks the client secret: %v", entryErr)
			}
		})
	}
}

// TestDecodeDefinitionsReportsFirstMissingFieldDeterministically pins the
// field order of the oauth2 URL checks. Ranging over a map literal here made
// an entry missing both URLs name tokenUrl on one boot and userinfoUrl on the
// next, which is unusable both as operator guidance and as a log-alert match.
func TestDecodeDefinitionsReportsFirstMissingFieldDeterministically(t *testing.T) {
	t.Parallel()

	raw := `{"legacy": {"type": "oauth2", "clientId": "id", "clientSecret": "secret",
		"authorizationUrl": "https://idp.example.com/authorize"}}`

	for range 20 {
		_, invalid, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
		if err != nil {
			t.Fatalf("unexpected envelope error: %v", err)
		}

		entryErr, ok := invalid["legacy"]
		if !ok {
			t.Fatalf("expected the entry to be invalid, got %v", invalid)
		}

		if !strings.Contains(entryErr.Error(), "tokenUrl") {
			t.Fatalf("expected the error to name tokenUrl, got: %v", entryErr)
		}
	}
}
