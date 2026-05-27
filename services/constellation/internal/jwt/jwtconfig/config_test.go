package jwtconfig_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

func TestJWTSecretValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		secret  jwtconfig.Secret
		wantErr bool
	}{
		{
			name:    "valid HS256 with key",
			secret:  jwtconfig.Secret{Type: jwtconfig.AlgorithmHS256, Key: "my-secret-key"},
			wantErr: false,
		},
		{
			name: "valid RS256 with key",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmRS256,
				Key:  "-----BEGIN PUBLIC KEY-----\n...",
			},
			wantErr: false,
		},
		{
			name:    "valid JWK URL",
			secret:  jwtconfig.Secret{JWKURL: "https://example.com/.well-known/jwks.json"},
			wantErr: false,
		},
		{
			name:    "missing type+key and jwk_url",
			secret:  jwtconfig.Secret{},
			wantErr: true,
		},
		{
			name: "both type+key and jwk_url",
			secret: jwtconfig.Secret{
				Type:   jwtconfig.AlgorithmHS256,
				Key:    "key",
				JWKURL: "https://example.com/jwks",
			},
			wantErr: true,
		},
		{
			name:    "unsupported algorithm",
			secret:  jwtconfig.Secret{Type: "ES256", Key: "key"},
			wantErr: true,
		},
		{
			name: "both claims_namespace and claims_namespace_path",
			secret: jwtconfig.Secret{
				Type:                jwtconfig.AlgorithmHS256,
				Key:                 "key",
				ClaimsNamespace:     "https://hasura.io/jwt/claims",
				ClaimsNamespacePath: "$.hasura.claims",
			},
			wantErr: true,
		},
		{
			name: "invalid claims_format",
			secret: jwtconfig.Secret{
				Type:         jwtconfig.AlgorithmHS256,
				Key:          "key",
				ClaimsFormat: "invalid",
			},
			wantErr: true,
		},
		{
			name: "cookie header without name",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "key",
				Header: &jwtconfig.HeaderJSON{
					HeaderConfig: jwtconfig.HeaderConfig{Type: jwtconfig.HeaderTypeCookie},
				},
			},
			wantErr: true,
		},
		{
			name: "cookie header with name",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "key",
				Header: &jwtconfig.HeaderJSON{
					HeaderConfig: jwtconfig.HeaderConfig{
						Type: jwtconfig.HeaderTypeCookie,
						Name: "jwt",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "custom header without name",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "key",
				Header: &jwtconfig.HeaderJSON{
					HeaderConfig: jwtconfig.HeaderConfig{Type: jwtconfig.HeaderTypeCustomHeader},
				},
			},
			wantErr: true,
		},
		{
			name:    "type without key",
			secret:  jwtconfig.Secret{Type: jwtconfig.AlgorithmHS256},
			wantErr: true,
		},
		{
			name:    "key without type",
			secret:  jwtconfig.Secret{Key: "my-key"},
			wantErr: true,
		},
		{
			name: "unsupported header type",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "key",
				Header: &jwtconfig.HeaderJSON{
					HeaderConfig: jwtconfig.HeaderConfig{Type: "InvalidType"},
				},
			},
			wantErr: true,
		},
		{
			name: "valid claims_map",
			secret: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "key",
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-allowed-roles": {Path: "$.roles"},
					"x-hasura-default-role":  {Path: "$.role"},
					"x-hasura-user-id":       {Path: "$.sub"},
				},
			},
			wantErr: false,
		},
		{
			name: "claims_map with claims_namespace",
			secret: jwtconfig.Secret{
				Type:            jwtconfig.AlgorithmHS256,
				Key:             "key",
				ClaimsNamespace: "https://hasura.io/jwt/claims",
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				},
			},
			wantErr: true,
		},
		{
			name: "claims_map with claims_namespace_path",
			secret: jwtconfig.Secret{
				Type:                jwtconfig.AlgorithmHS256,
				Key:                 "key",
				ClaimsNamespacePath: "$.hasura",
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				},
			},
			wantErr: true,
		},
		{
			name: "claims_map with claims_format",
			secret: jwtconfig.Secret{
				Type:         jwtconfig.AlgorithmHS256,
				Key:          "key",
				ClaimsFormat: jwtconfig.ClaimsFormatStringifiedJSON,
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.secret.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestParseConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		raw     []string
		want    int // number of secrets
		wantErr bool
	}{
		{
			name:    "single HS256 object",
			raw:     []string{`{"type":"HS256","key":"my-secret-key"}`},
			want:    1,
			wantErr: false,
		},
		{
			name:    "array of secrets",
			raw:     []string{`[{"type":"HS256","key":"key1"},{"type":"HS384","key":"key2"}]`},
			want:    2,
			wantErr: false,
		},
		{
			name:    "multiple strings",
			raw:     []string{`{"type":"HS256","key":"key1"}`, `{"type":"HS384","key":"key2"}`},
			want:    2,
			wantErr: false,
		},
		{
			name:    "empty strings skipped",
			raw:     []string{"", `{"type":"HS256","key":"key1"}`, "  "},
			want:    1,
			wantErr: false,
		},
		{
			name:    "invalid JSON",
			raw:     []string{`not json`},
			wantErr: true,
		},
		{
			name:    "valid JSON but invalid config",
			raw:     []string{`{"type":"HS256"}`},
			wantErr: true,
		},
		{
			name:    "JWK URL secret",
			raw:     []string{`{"jwk_url":"https://example.com/.well-known/jwks.json"}`},
			want:    1,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg, err := jwtconfig.ParseConfig(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseConfig() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && len(cfg.Secrets) != tt.want {
				t.Errorf("ParseConfig() got %d secrets, want %d", len(cfg.Secrets), tt.want)
			}
		})
	}
}

func TestParseConfigPEMNewlines(t *testing.T) {
	t.Parallel()

	pemKey := "-----BEGIN PUBLIC KEY-----\nMIIBIjANB\nAAAAAAAA\n-----END PUBLIC KEY-----"

	t.Run("key with literal newlines", func(t *testing.T) {
		t.Parallel()

		// Simulate env var with literal newlines inside the JSON value
		raw := `{"type":"RS256","key":"` + pemKey + `"}`

		cfg, err := jwtconfig.ParseConfig([]string{raw})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if cfg.Secrets[0].Key != pemKey {
			t.Errorf("got key %q, want %q", cfg.Secrets[0].Key, pemKey)
		}
	})

	t.Run("key with escaped newlines", func(t *testing.T) {
		t.Parallel()

		// JSON with properly escaped \n sequences
		raw := `{"type":"RS256","key":"-----BEGIN PUBLIC KEY-----\\nMIIBIjANB\\nAAAAAAAA\\n-----END PUBLIC KEY-----"}`

		cfg, err := jwtconfig.ParseConfig([]string{raw})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if cfg.Secrets[0].Key != pemKey {
			t.Errorf("got key %q, want %q", cfg.Secrets[0].Key, pemKey)
		}
	})
}

func TestParseConfigAudience(t *testing.T) {
	t.Parallel()

	t.Run("audience as string", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig(
			[]string{`{"type":"HS256","key":"k","audience":"my-app"}`},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := jwtconfig.StringOrList{"my-app"}
		if diff := cmp.Diff(want, cfg.Secrets[0].Audience); diff != "" {
			t.Errorf("audience mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("audience as array", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig(
			[]string{`{"type":"HS256","key":"k","audience":["a","b"]}`},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := jwtconfig.StringOrList{"a", "b"}
		if diff := cmp.Diff(want, cfg.Secrets[0].Audience); diff != "" {
			t.Errorf("audience mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestParseConfigHeaderJSON(t *testing.T) {
	t.Parallel()

	t.Run("header as nested object", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","header":{"type":"Cookie","name":"jwt"}}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		h := cfg.Secrets[0].Header
		if h == nil {
			t.Fatal("expected header to be set")
		}

		if h.Type != jwtconfig.HeaderTypeCookie || h.Name != "jwt" {
			t.Errorf("got header %+v, want Cookie/jwt", h.HeaderConfig)
		}
	})

	t.Run("header as JSON string", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","header":"{\"type\":\"Cookie\",\"name\":\"jwt\"}"}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		h := cfg.Secrets[0].Header
		if h == nil {
			t.Fatal("expected header to be set")
		}

		if h.Type != jwtconfig.HeaderTypeCookie || h.Name != "jwt" {
			t.Errorf("got header %+v, want Cookie/jwt", h.HeaderConfig)
		}
	})
}

func TestParseConfigClaimsMap(t *testing.T) {
	t.Parallel()

	t.Run("path objects", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","claims_map":{` +
				`"x-hasura-allowed-roles":{"path":"$.roles"},` +
				`"x-hasura-default-role":{"path":"$.role"},` +
				`"x-hasura-user-id":{"path":"$.sub"}` +
				`}}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		cm := cfg.Secrets[0].ClaimsMap
		if cm == nil {
			t.Fatal("expected claims_map to be set")
		}

		if cm["x-hasura-allowed-roles"].Path != "$.roles" {
			t.Errorf("got path %q, want $.roles", cm["x-hasura-allowed-roles"].Path)
		}

		if cm["x-hasura-user-id"].Path != "$.sub" {
			t.Errorf("got path %q, want $.sub", cm["x-hasura-user-id"].Path)
		}
	})

	t.Run("path with default", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","claims_map":{` +
				`"x-hasura-allowed-roles":{"path":"$.roles"},` +
				`"x-hasura-default-role":{"path":"$.role","default":"viewer"}` +
				`}}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		entry := cfg.Secrets[0].ClaimsMap["x-hasura-default-role"]
		if entry.Path != "$.role" {
			t.Errorf("got path %q, want $.role", entry.Path)
		}

		if diff := cmp.Diff("viewer", entry.Default); diff != "" {
			t.Errorf("default mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("literal string", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","claims_map":{` +
				`"x-hasura-allowed-roles":{"path":"$.roles"},` +
				`"x-hasura-default-role":"user"` +
				`}}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		entry := cfg.Secrets[0].ClaimsMap["x-hasura-default-role"]
		if diff := cmp.Diff("user", entry.Literal); diff != "" {
			t.Errorf("literal mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("literal array", func(t *testing.T) {
		t.Parallel()

		cfg, err := jwtconfig.ParseConfig([]string{
			`{"type":"HS256","key":"k","claims_map":{` +
				`"x-hasura-allowed-roles":["user","editor"],` +
				`"x-hasura-default-role":"user"` +
				`}}`,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		entry := cfg.Secrets[0].ClaimsMap["x-hasura-allowed-roles"]

		// JSON unmarshal produces []any
		want := []any{"user", "editor"}
		if diff := cmp.Diff(want, entry.Literal); diff != "" {
			t.Errorf("literal mismatch (-want +got):\n%s", diff)
		}
	})
}

// TestParseConfigWrappedErrorSurfacesBothAttempts ensures the error produced
// when both the literal-form and newline-sanitised retries fail surfaces both
// underlying parse errors instead of swallowing the first. This is the key
// observability guarantee operators rely on when debugging malformed config:
// the raw failure must not disappear behind the sanitised retry's failure.
func TestParseConfigWrappedErrorSurfacesBothAttempts(t *testing.T) {
	t.Parallel()

	t.Run("garbage input surfaces array and object attempts", func(t *testing.T) {
		t.Parallel()

		// Input that fails both as an array AND as a single object — and the
		// newline sanitisation does nothing useful (no literal newlines), so
		// the retry fails the same way. The wrapped error must mention both
		// the raw and sanitised attempts, and each must include the array
		// and object sub-errors from unmarshalSecrets.
		_, err := jwtconfig.ParseConfig([]string{`not json at all`})
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		msg := err.Error()

		// parseSecretJSON's wrap.
		for _, want := range []string{"raw=", "sanitised="} {
			if !strings.Contains(msg, want) {
				t.Errorf(
					"error %q missing %q (parseSecretJSON should surface both attempts)",
					msg,
					want,
				)
			}
		}

		// unmarshalSecrets's wrap — the inner errors must surface both the array
		// and the single-object failure so operators can see why each form failed.
		for _, want := range []string{"array=", "object="} {
			if !strings.Contains(msg, want) {
				t.Errorf(
					"error %q missing %q (unmarshalSecrets should surface both attempts)",
					msg,
					want,
				)
			}
		}
	})

	t.Run("malformed input with newlines surfaces both retry attempts", func(t *testing.T) {
		t.Parallel()

		// Input contains literal newlines (so the sanitised retry runs) but is
		// still malformed after sanitisation. Both rawErr and sanitisedErr must
		// appear in the wrapped error.
		_, err := jwtconfig.ParseConfig([]string{"{\n  \"type\": \"HS256\"\n  \"key\":\n}"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		msg := err.Error()

		if !strings.Contains(msg, "raw=") {
			t.Errorf("error %q missing raw= attempt", msg)
		}

		if !strings.Contains(msg, "sanitised=") {
			t.Errorf("error %q missing sanitised= attempt", msg)
		}
	})
}
