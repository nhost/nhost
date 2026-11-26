package main

import (
	"os"
	"strings"
	"testing"
)

func TestGenerateOIDCProvider(t *testing.T) {
	t.Parallel()

	const schemaPath = "../../vendor/github.com/nhost/be/services/mimir/schema/schema.cue"

	src, err := os.ReadFile(schemaPath)
	if err != nil {
		t.Fatalf("read vendored schema: %v", err)
	}

	got, err := generate(schemaPath, src)
	if err != nil {
		t.Fatalf("generate() error = %v", err)
	}

	_, section, ok := strings.Cut(got, "### OIDCProvider\n\n")
	if !ok {
		t.Fatal("OIDCProvider section missing")
	}

	section, _, _ = strings.Cut(section, "\n### ")

	for _, alias := range []string{"httpsURL", "oauthValue", "_openidScopePresent", "_clientSecretPresent"} {
		if strings.Contains(section, alias) {
			t.Errorf("OIDCProvider section contains internal schema identifier %q", alias)
		}
	}

	tests := []struct {
		name string
		want string
	}{
		{"HTTPS constraints", "must use HTTPS without user info or a fragment"},
		{"issuer query", "`issuer` must also have no query string"},
		{
			"discovery fallback",
			"Omit `discoveryUrl` to derive the discovery endpoint from the issuer.",
		},
		{
			"OAuth characters",
			"non-empty printable ASCII without spaces, double quotes, or backslashes",
		},
		{
			"required scope",
			"A non-empty `scopes` list must include `openid`; an empty list is allowed",
		},
		{"non-blank secret", "`clientSecret` must not be empty or contain only whitespace"},
		{"issuer type", "| `issuer` | HTTPS URL |"},
		{"optional discovery type", "| `discoveryUrl?` | HTTPS URL or empty string |"},
		{"client ID type", "| `clientId` | OAuth token string |"},
		{"scope list type", "| `scopes?` | list of OAuth token strings |"},
		{"audience list type", "| `audiences?` | list of OAuth token strings |"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if !strings.Contains(section, tt.want) {
				t.Errorf("OIDCProvider section does not contain %q", tt.want)
			}
		})
	}
}

func TestGenerate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		schema  string
		want    string
		wantErr string
	}{
		{
			name:    "invalid cue",
			schema:  "#Config: {",
			wantErr: "parse cue",
		},
		{
			name:    "missing root",
			schema:  "#Other: {}",
			wantErr: errMissingConfig.Error(),
		},
		{
			name:    "non-struct root",
			schema:  "#Config: string",
			wantErr: errInvalidConfig.Error(),
		},
		{
			name: "valid root",
			schema: `#Config: { auth: #Auth }
#Auth: { enabled: bool | *true }
`,
			want: "| [`auth`](#auth) |",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := generate("schema.cue", []byte(tt.schema))
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("generate() error = %v, want to contain %q", err, tt.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("generate() error = %v", err)
			}

			if !strings.Contains(got, tt.want) {
				t.Errorf("generate() output does not contain %q", tt.want)
			}
		})
	}
}
