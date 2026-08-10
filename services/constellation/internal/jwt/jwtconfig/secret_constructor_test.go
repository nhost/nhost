package jwtconfig_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// TestNewStaticSecretHappyPath verifies that NewStaticSecret produces a valid,
// fully-initialised Secret for the documented happy-path inputs and that the
// returned value passes Validate.
func TestNewStaticSecretHappyPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		alg  jwtconfig.Algorithm
		key  string
		opts []jwtconfig.SecretOption
		want jwtconfig.Secret
	}{
		{
			name: "minimal HS256",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "my-secret-key",
			opts: nil,
			want: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "my-secret-key",
			},
		},
		{
			name: "minimal RS256 with PEM",
			alg:  jwtconfig.AlgorithmRS256,
			key:  "-----BEGIN PUBLIC KEY-----\nMIIBIjANB\n-----END PUBLIC KEY-----",
			opts: nil,
			want: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmRS256,
				Key:  "-----BEGIN PUBLIC KEY-----\nMIIBIjANB\n-----END PUBLIC KEY-----",
			},
		},
		{
			name: "HS384 with issuer and audience",
			alg:  jwtconfig.AlgorithmHS384,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithIssuer("https://issuer.example.com"),
				jwtconfig.WithAudience("svc-a", "svc-b"),
			},
			want: jwtconfig.Secret{
				Type:     jwtconfig.AlgorithmHS384,
				Key:      "k",
				Issuer:   "https://issuer.example.com",
				Audience: jwtconfig.StringOrList{"svc-a", "svc-b"},
			},
		},
		{
			name: "HS256 with allowed skew",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{jwtconfig.WithAllowedSkew(120)},
			want: jwtconfig.Secret{
				Type:        jwtconfig.AlgorithmHS256,
				Key:         "k",
				AllowedSkew: new(uint(120)),
			},
		},
		{
			name: "HS256 with claims namespace",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsNamespace("https://my.app/claims"),
				jwtconfig.WithClaimsFormat(jwtconfig.ClaimsFormatStringifiedJSON),
			},
			want: jwtconfig.Secret{
				Type:            jwtconfig.AlgorithmHS256,
				Key:             "k",
				ClaimsNamespace: "https://my.app/claims",
				ClaimsFormat:    jwtconfig.ClaimsFormatStringifiedJSON,
			},
		},
		{
			name: "HS256 with claims namespace path",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{jwtconfig.WithClaimsNamespacePath("$.hasura")},
			want: jwtconfig.Secret{
				Type:                jwtconfig.AlgorithmHS256,
				Key:                 "k",
				ClaimsNamespacePath: "$.hasura",
			},
		},
		{
			name: "HS256 with claims map",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsMap(jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				}),
			},
			want: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "k",
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				},
			},
		},
		{
			name: "HS256 with cookie header",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithHeader(jwtconfig.HeaderConfig{
					Type: jwtconfig.HeaderTypeCookie,
					Name: "jwt",
				}),
			},
			want: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "k",
				Header: &jwtconfig.HeaderJSON{
					HeaderConfig: jwtconfig.HeaderConfig{
						Type: jwtconfig.HeaderTypeCookie,
						Name: "jwt",
					},
				},
			},
		},
		{
			name: "HS256 with kid",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{jwtconfig.WithKid("primary")},
			want: jwtconfig.Secret{
				Type: jwtconfig.AlgorithmHS256,
				Key:  "k",
				Kid:  "primary",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := jwtconfig.NewStaticSecret(tt.alg, tt.key, tt.opts...)
			if err != nil {
				t.Fatalf("NewStaticSecret returned error: %v", err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Secret mismatch (-want +got):\n%s", diff)
			}

			// Belt-and-braces: the returned Secret must independently validate
			// to confirm the constructor's invariant.
			if err := got.Validate(); err != nil {
				t.Errorf("returned Secret failed Validate: %v", err)
			}
		})
	}
}

// TestNewStaticSecretValidationFailures covers the error paths: empty key,
// unsupported algorithm, mutually-exclusive options, and invalid header
// configuration. Each must produce a non-nil error and a zero-value Secret.
func TestNewStaticSecretValidationFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		alg         jwtconfig.Algorithm
		key         string
		opts        []jwtconfig.SecretOption
		wantErrSubs string
	}{
		{
			name:        "empty key",
			alg:         jwtconfig.AlgorithmHS256,
			key:         "",
			opts:        nil,
			wantErrSubs: "type+key or jwk_url",
		},
		{
			name:        "empty algorithm",
			alg:         "",
			key:         "k",
			opts:        nil,
			wantErrSubs: "type+key or jwk_url",
		},
		{
			name:        "unsupported algorithm",
			alg:         "ES256",
			key:         "k",
			opts:        nil,
			wantErrSubs: "unsupported algorithm",
		},
		{
			name: "claims_namespace and claims_namespace_path both set",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsNamespace("https://hasura.io/jwt/claims"),
				jwtconfig.WithClaimsNamespacePath("$.hasura.claims"),
			},
			wantErrSubs: "claims_namespace and claims_namespace_path",
		},
		{
			name: "claims_map with claims_namespace",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsNamespace("https://hasura.io/jwt/claims"),
				jwtconfig.WithClaimsMap(jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				}),
			},
			wantErrSubs: "claims_map and claims_namespace",
		},
		{
			name: "claims_map with claims_namespace_path",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsNamespacePath("$.hasura"),
				jwtconfig.WithClaimsMap(jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				}),
			},
			wantErrSubs: "claims_map and claims_namespace_path",
		},
		{
			name: "claims_map with claims_format",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsFormat(jwtconfig.ClaimsFormatStringifiedJSON),
				jwtconfig.WithClaimsMap(jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				}),
			},
			wantErrSubs: "claims_map and claims_format",
		},
		{
			name:        "invalid claims_format",
			alg:         jwtconfig.AlgorithmHS256,
			key:         "k",
			opts:        []jwtconfig.SecretOption{jwtconfig.WithClaimsFormat("xml")},
			wantErrSubs: "invalid claims_format",
		},
		{
			name: "cookie header without name",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithHeader(jwtconfig.HeaderConfig{
					Type: jwtconfig.HeaderTypeCookie,
					Name: "",
				}),
			},
			wantErrSubs: "cookie header type requires a name",
		},
		{
			name: "custom header without name",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithHeader(jwtconfig.HeaderConfig{
					Type: jwtconfig.HeaderTypeCustomHeader,
					Name: "",
				}),
			},
			wantErrSubs: "custom header type requires a name",
		},
		{
			name: "unsupported header type",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "k",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithHeader(jwtconfig.HeaderConfig{
					Type: "Bogus",
					Name: "x",
				}),
			},
			wantErrSubs: "unsupported header type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := jwtconfig.NewStaticSecret(tt.alg, tt.key, tt.opts...)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErrSubs)
			}

			if !strings.Contains(err.Error(), tt.wantErrSubs) {
				t.Errorf("error %q missing substring %q", err.Error(), tt.wantErrSubs)
			}

			// The constructor must return a zero-value Secret on error so that
			// a caller that ignores the error doesn't accidentally use a
			// partially-initialised value.
			if diff := cmp.Diff(jwtconfig.Secret{}, got); diff != "" {
				t.Errorf("expected zero Secret on error, got diff (-want +got):\n%s", diff)
			}
		})
	}
}

// TestNewJWKSSecretHappyPath verifies JWKS-backed secret construction.
func TestNewJWKSSecretHappyPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
		opts []jwtconfig.SecretOption
		want jwtconfig.Secret
	}{
		{
			name: "minimal JWKS URL",
			url:  "https://example.com/.well-known/jwks.json",
			opts: nil,
			want: jwtconfig.Secret{
				JWKURL: "https://example.com/.well-known/jwks.json",
			},
		},
		{
			name: "JWKS URL with kid",
			url:  "https://example.com/.well-known/jwks.json",
			opts: []jwtconfig.SecretOption{jwtconfig.WithKid("kid-1")},
			want: jwtconfig.Secret{
				JWKURL: "https://example.com/.well-known/jwks.json",
				Kid:    "kid-1",
			},
		},
		{
			name: "JWKS URL with issuer and audience",
			url:  "https://example.com/.well-known/jwks.json",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithIssuer("https://issuer.example.com"),
				jwtconfig.WithAudience("svc-a"),
			},
			want: jwtconfig.Secret{
				JWKURL:   "https://example.com/.well-known/jwks.json",
				Issuer:   "https://issuer.example.com",
				Audience: jwtconfig.StringOrList{"svc-a"},
			},
		},
		{
			name: "JWKS URL with claims map",
			url:  "https://example.com/.well-known/jwks.json",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsMap(jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				}),
			},
			want: jwtconfig.Secret{
				JWKURL: "https://example.com/.well-known/jwks.json",
				ClaimsMap: jwtconfig.ClaimsMap{
					"x-hasura-user-id": {Path: "$.sub"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := jwtconfig.NewJWKSSecret(tt.url, tt.opts...)
			if err != nil {
				t.Fatalf("NewJWKSSecret returned error: %v", err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Secret mismatch (-want +got):\n%s", diff)
			}

			if err := got.Validate(); err != nil {
				t.Errorf("returned Secret failed Validate: %v", err)
			}
		})
	}
}

// TestNewJWKSSecretValidationFailures covers JWKS-specific error paths,
// including the empty URL.
func TestNewJWKSSecretValidationFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		url         string
		opts        []jwtconfig.SecretOption
		wantErrSubs string
	}{
		{
			name:        "empty URL",
			url:         "",
			opts:        nil,
			wantErrSubs: "type+key or jwk_url",
		},
		{
			name: "JWKS URL with mutually-exclusive claims options",
			url:  "https://example.com/.well-known/jwks.json",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithClaimsNamespace("https://hasura.io/jwt/claims"),
				jwtconfig.WithClaimsNamespacePath("$.hasura"),
			},
			wantErrSubs: "claims_namespace and claims_namespace_path",
		},
		{
			name: "JWKS URL with invalid header",
			url:  "https://example.com/.well-known/jwks.json",
			opts: []jwtconfig.SecretOption{
				jwtconfig.WithHeader(jwtconfig.HeaderConfig{
					Type: jwtconfig.HeaderTypeCookie,
					Name: "",
				}),
			},
			wantErrSubs: "cookie header type requires a name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := jwtconfig.NewJWKSSecret(tt.url, tt.opts...)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErrSubs)
			}

			if !strings.Contains(err.Error(), tt.wantErrSubs) {
				t.Errorf("error %q missing substring %q", err.Error(), tt.wantErrSubs)
			}

			if diff := cmp.Diff(jwtconfig.Secret{}, got); diff != "" {
				t.Errorf("expected zero Secret on error, got diff (-want +got):\n%s", diff)
			}
		})
	}
}

// TestSecretConstructorRejectsBothStaticAndJWKS is a sanity-check: neither
// constructor can produce a Secret that has both type+key and jwk_url set,
// because the JWKS option seam does not let callers set Type/Key from a JWKS
// constructor (and vice versa). This guards against accidental cross-wiring
// regressions if the option set is expanded later.
func TestSecretConstructorRejectsBothStaticAndJWKS(t *testing.T) {
	t.Parallel()

	// NewStaticSecret has no option that sets JWKURL; the only way to get a
	// secret with both forms is via literal construction (covered by
	// TestJWTSecretValidate). What we *can* verify is that the constructor's
	// happy path never sets JWKURL.
	got, err := jwtconfig.NewStaticSecret(jwtconfig.AlgorithmHS256, "k")
	if err != nil {
		t.Fatalf("NewStaticSecret returned error: %v", err)
	}

	if got.JWKURL != "" {
		t.Errorf("NewStaticSecret produced a Secret with JWKURL set: %q", got.JWKURL)
	}

	// And the JWKS constructor must not set Type/Key.
	gotJWKS, err := jwtconfig.NewJWKSSecret("https://example.com/jwks")
	if err != nil {
		t.Fatalf("NewJWKSSecret returned error: %v", err)
	}

	if gotJWKS.Type != "" {
		t.Errorf("NewJWKSSecret produced a Secret with Type set: %q", gotJWKS.Type)
	}

	if gotJWKS.Key != "" {
		t.Errorf("NewJWKSSecret produced a Secret with Key set: %q", gotJWKS.Key)
	}
}

// TestSecretOptionComposition verifies that multiple options compose
// predictably (last write wins on a single field) and that orthogonal options
// don't trample one another.
func TestSecretOptionComposition(t *testing.T) {
	t.Parallel()

	t.Run("orthogonal options compose", func(t *testing.T) {
		t.Parallel()

		got, err := jwtconfig.NewStaticSecret(
			jwtconfig.AlgorithmHS256,
			"k",
			jwtconfig.WithIssuer("https://issuer.example.com"),
			jwtconfig.WithAudience("svc-a", "svc-b"),
			jwtconfig.WithAllowedSkew(60),
			jwtconfig.WithKid("primary"),
			jwtconfig.WithClaimsNamespace("https://my.app/claims"),
		)
		if err != nil {
			t.Fatalf("NewStaticSecret returned error: %v", err)
		}

		want := jwtconfig.Secret{
			Type:            jwtconfig.AlgorithmHS256,
			Key:             "k",
			Kid:             "primary",
			ClaimsNamespace: "https://my.app/claims",
			Audience:        jwtconfig.StringOrList{"svc-a", "svc-b"},
			Issuer:          "https://issuer.example.com",
			AllowedSkew:     new(uint(60)),
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("Secret mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("last-writer-wins on same field", func(t *testing.T) {
		t.Parallel()

		got, err := jwtconfig.NewStaticSecret(
			jwtconfig.AlgorithmHS256,
			"k",
			jwtconfig.WithIssuer("https://first.example.com"),
			jwtconfig.WithIssuer("https://second.example.com"),
		)
		if err != nil {
			t.Fatalf("NewStaticSecret returned error: %v", err)
		}

		if got.Issuer != "https://second.example.com" {
			t.Errorf("expected last issuer to win, got %q", got.Issuer)
		}
	})

	t.Run("options applied before Validate", func(t *testing.T) {
		t.Parallel()

		// If options were applied *after* Validate, this combination would
		// slip through (Validate sees only Type+Key). The error confirms
		// options are applied first.
		_, err := jwtconfig.NewStaticSecret(
			jwtconfig.AlgorithmHS256,
			"k",
			jwtconfig.WithClaimsNamespace("a"),
			jwtconfig.WithClaimsNamespacePath("$.b"),
		)
		if err == nil {
			t.Fatal(
				"expected mutually-exclusive options to fail Validate; got nil error",
			)
		}
	})
}
