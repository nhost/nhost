package oidc_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/safehttp"
)

func TestDiscoveryURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		issuer string
		want   string
	}{
		{
			issuer: "https://idp.example.com",
			want:   "https://idp.example.com/.well-known/openid-configuration",
		},
		{
			issuer: "https://idp.example.com/",
			want:   "https://idp.example.com/.well-known/openid-configuration",
		},
		{
			issuer: "https://idp.example.com/realms/acme",
			want:   "https://idp.example.com/realms/acme/.well-known/openid-configuration",
		},
	}

	for _, tc := range tests {
		t.Run(tc.issuer, func(t *testing.T) {
			t.Parallel()

			if got := oidc.DiscoveryURL(tc.issuer); got != tc.want {
				t.Errorf("DiscoveryURL(%q) = %q, want %q", tc.issuer, got, tc.want)
			}
		})
	}
}

func TestDiscovererGet(t *testing.T) {
	t.Parallel()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	t.Run("success is memoized", func(t *testing.T) {
		t.Parallel()

		idp := newFakeIDP(t)
		disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)

		doc, err := disco.Get(t.Context())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if doc.AuthorizationEndpoint != idp.URL()+"/authorize" ||
			doc.TokenEndpoint != idp.URL()+"/token" ||
			doc.UserinfoEndpoint != idp.URL()+"/userinfo" ||
			doc.JWKSURI != idp.URL()+"/jwks.json" {
			t.Errorf("unexpected document: %+v", doc)
		}

		var wg sync.WaitGroup
		for range 10 {
			wg.Go(func() {
				if _, err := disco.Get(context.Background()); err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			})
		}

		wg.Wait()

		if hits := idp.DiscoveryHits(); hits != 1 {
			t.Errorf("expected 1 discovery fetch, got %d", hits)
		}
	})

	t.Run("failure is negative-cached and heals after backoff", func(t *testing.T) {
		t.Parallel()

		idp := newFakeIDP(t)
		idp.SetFailDiscovery(true)

		disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)

		if _, err := disco.Get(t.Context()); !errors.Is(err, oidc.ErrDiscoveryStatus) {
			t.Fatalf("expected ErrDiscoveryStatus, got: %v", err)
		}

		// Within the backoff window the cached error is served without a
		// new fetch — even though the IdP has recovered.
		idp.SetFailDiscovery(false)

		if _, err := disco.Get(t.Context()); !errors.Is(err, oidc.ErrDiscoveryStatus) {
			t.Fatalf("expected cached ErrDiscoveryStatus, got: %v", err)
		}

		if hits := idp.DiscoveryHits(); hits != 1 {
			t.Fatalf("expected 1 discovery fetch during backoff, got %d", hits)
		}

		time.Sleep(1100 * time.Millisecond)

		if _, err := disco.Get(t.Context()); err != nil {
			t.Fatalf("expected recovery after backoff, got: %v", err)
		}

		if hits := idp.DiscoveryHits(); hits != 2 {
			t.Errorf("expected 2 discovery fetches after recovery, got %d", hits)
		}
	})
}

func TestDiscovererGetRejectsBadDocuments(t *testing.T) {
	t.Parallel()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	tests := []struct {
		name      string
		mutateDoc func(doc map[string]any)
		wantErr   error
	}{
		{
			name: "issuer mismatch is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["issuer"] = "https://evil.example.com"
			},
			wantErr: oidc.ErrDiscoveryIssuerMismatch,
		},
		{
			name: "missing jwks_uri is rejected",
			mutateDoc: func(doc map[string]any) {
				delete(doc, "jwks_uri")
			},
			wantErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			name: "oversized document is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["padding"] = padding(safehttp.DefaultMaxResponseSize + 1)
			},
			wantErr: safehttp.ErrResponseTooLarge,
		},
		{
			// authorization_endpoint is the one discovered URL the service
			// never fetches, so the hardened client cannot enforce the
			// scheme for it: it goes straight into a Location header
			// carrying the state JWT.
			name: "plaintext authorization endpoint is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["authorization_endpoint"] = "http://idp.example.com/authorize"
			},
			wantErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name: "relative authorization endpoint is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["authorization_endpoint"] = "/authorize"
			},
			wantErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name: "plaintext token endpoint is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["token_endpoint"] = "http://idp.example.com/token"
			},
			wantErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name: "malformed userinfo endpoint is rejected",
			mutateDoc: func(doc map[string]any) {
				doc["userinfo_endpoint"] = "not-a-url"
			},
			wantErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newFakeIDP(t)
			idp.SetMutateDoc(tc.mutateDoc)

			disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)

			if _, err := disco.Get(t.Context()); !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got: %v", tc.wantErr, err)
			}
		})
	}
}

func newTestValidator(
	t *testing.T, idp *fakeIDP, audiences []string,
) *oidc.IDTokenValidator {
	t.Helper()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})
	disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)
	provider := oidc.NewCustomProvider(t.Context(), idp.URL(), disco, client)

	validator, err := oidc.NewIDTokenValidatorForProvider(t.Context(), provider, audiences)
	if err != nil {
		t.Fatalf("failed to create validator: %v", err)
	}

	return validator
}

func TestCustomProviderIDTokenValidation(t *testing.T) {
	t.Parallel()

	idp := newFakeIDP(t)
	validator := newTestValidator(t, idp, []string{"client-id", "extra-audience"})

	t.Run("valid RS256 token is accepted", func(t *testing.T) {
		t.Parallel()

		token, err := validator.Validate(idp.MintToken(t, idp.DefaultClaims()), "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		profile, err := validator.GetProfile(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if profile.ProviderUserID != "user-1" ||
			profile.Email != "jane@example.com" ||
			!profile.EmailVerified.IsVerified() ||
			profile.Name != "Jane" {
			t.Errorf("unexpected profile: %+v", profile)
		}
	})

	t.Run("extra audience is accepted", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["aud"] = "extra-audience"

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("unknown audience is rejected", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["aud"] = "someone-else"

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err == nil {
			t.Error("expected audience error, got nil")
		}
	})

	t.Run("valid alg and known kid but foreign signing key is rejected", func(t *testing.T) {
		t.Parallel()

		// The claims are entirely valid; only the signature comes from a key
		// that is not in the JWKS. This is the forged-token case: it must
		// fail at signature verification, not at any earlier claims check.
		if _, err := validator.Validate(
			idp.MintTokenForeignKey(t, idp.DefaultClaims()),
			"",
		); err == nil {
			t.Error("expected signature-verification error, got nil")
		}
	})

	t.Run("kid absent from the JWKS is rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := validator.Validate(
			idp.MintTokenUnknownKid(t, idp.DefaultClaims()),
			"",
		); err == nil {
			t.Error("expected key-selection error, got nil")
		}
	})

	t.Run("HS256 token is rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := validator.Validate(
			idp.MintHS256Token(t, idp.DefaultClaims()),
			"",
		); err == nil {
			t.Error("expected signing-method error, got nil")
		}
	})

	t.Run("alg none token is rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := validator.Validate(idp.MintNoneToken(t, idp.DefaultClaims()), ""); err == nil {
			t.Error("expected signing-method error, got nil")
		}
	})

	t.Run("expired token is rejected", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["iat"] = time.Now().Add(-2 * time.Hour).Unix()
		claims["exp"] = time.Now().Add(-time.Hour).Unix()

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err == nil {
			t.Error("expected expiry error, got nil")
		}
	})

	t.Run("wrong issuer is rejected", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["iss"] = "https://evil.example.com"

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err == nil {
			t.Error("expected issuer error, got nil")
		}
	})
}

// TestCustomProviderIDTokenClockSkew pins the clock-skew leeway rather than
// its absence: a third-party IdP running slightly ahead of us must not have
// every token it has just minted rejected with ErrTokenUsedBeforeIssued, but a
// wildly future iat is still an error.
func TestCustomProviderIDTokenClockSkew(t *testing.T) {
	t.Parallel()

	idp := newFakeIDP(t)
	validator := newTestValidator(t, idp, []string{"client-id"})

	t.Run("iat slightly in the future is accepted", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["iat"] = time.Now().Add(5 * time.Second).Unix()

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err != nil {
			t.Errorf("expected the skew to be tolerated, got: %v", err)
		}
	})

	t.Run("iat far in the future is rejected", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["iat"] = time.Now().Add(time.Hour).Unix()

		if _, err := validator.Validate(idp.MintToken(t, claims), ""); err == nil {
			t.Error("expected used-before-issued error, got nil")
		}
	})
}

// TestCustomProviderMemoizesKeyFunc pins the invariant the two validators
// built over one provider depend on: a single keyfunc, hence a single JWKS
// cache and a single background refresh goroutine. keyfunc exposes no Close,
// so an extra keyfunc is an extra hourly poll of a third-party URL for the
// life of the process.
func TestCustomProviderMemoizesKeyFunc(t *testing.T) {
	t.Parallel()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	idp := newFakeIDP(t)
	disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)
	provider := oidc.NewCustomProvider(t.Context(), idp.URL(), disco, client)

	if _, err := provider.GetJWTKeyFunc(t.Context()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	jwksHits := idp.JWKSHits()
	if jwksHits == 0 {
		t.Fatal("expected the first build to fetch the JWKS")
	}

	if _, err := provider.GetJWTKeyFunc(t.Context()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := idp.JWKSHits(); got != jwksHits {
		t.Errorf(
			"expected the keyfunc to be memoized (%d JWKS fetches), got %d",
			jwksHits, got,
		)
	}
}

func TestValidateWithRequiredNonce(t *testing.T) {
	t.Parallel()

	idp := newFakeIDP(t)
	validator := newTestValidator(t, idp, []string{"client-id"})

	rawNonce := "raw-nonce-value"

	t.Run("matching nonce is accepted", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["nonce"] = oidc.HashNonce(rawNonce)

		if _, err := validator.ValidateWithRequiredNonce(
			idp.MintToken(t, claims), rawNonce,
		); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("mismatched nonce is rejected", func(t *testing.T) {
		t.Parallel()

		claims := idp.DefaultClaims()
		claims["nonce"] = oidc.HashNonce("some-other-nonce")

		if _, err := validator.ValidateWithRequiredNonce(
			idp.MintToken(t, claims), rawNonce,
		); !errors.Is(err, oidc.ErrNonceMismatch) {
			t.Errorf("expected ErrNonceMismatch, got: %v", err)
		}
	})

	t.Run("missing nonce claim is rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := validator.ValidateWithRequiredNonce(
			idp.MintToken(t, idp.DefaultClaims()), rawNonce,
		); !errors.Is(err, oidc.ErrNonceMissing) {
			t.Errorf("expected ErrNonceMissing, got: %v", err)
		}
	})

	t.Run("missing nonce claim passes non-strict validation", func(t *testing.T) {
		t.Parallel()

		if _, err := validator.Validate(
			idp.MintToken(t, idp.DefaultClaims()), rawNonce,
		); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})
}

// TestCustomProviderRejectsEmptyJWKS pins that an unusable key set is a build
// failure. keyfunc is configured with NoErrorReturnFirstHTTPReq, so a JWKS URI
// that 404s or serves garbage otherwise yields a nil error and an empty key
// set — which lazyMemo would cache as a success for the process lifetime,
// leaving the promised backoff/retry never applied to the JWKS half of the
// build and kid-less id_tokens failing until the next refresh tick.
func TestCustomProviderRejectsEmptyJWKS(t *testing.T) {
	t.Parallel()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	idp := newFakeIDP(t)
	idp.SetMutateDoc(func(doc map[string]any) {
		doc["jwks_uri"] = idp.URL() + "/no-such-jwks"
	})

	disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)
	provider := oidc.NewCustomProvider(t.Context(), idp.URL(), disco, client)

	if _, err := provider.GetJWTKeyFunc(t.Context()); !errors.Is(err, oidc.ErrJWKSEmpty) {
		t.Fatalf("expected ErrJWKSEmpty, got: %v", err)
	}

	// The failure has to reach the lazy validator too, so it lands in the
	// negative cache rather than being memoized as a working validator.
	lazy := oidc.NewLazyIDTokenValidator(
		func(ctx context.Context) (*oidc.IDTokenValidator, error) {
			return oidc.NewIDTokenValidatorForProvider(ctx, provider, []string{"client-id"})
		},
	)

	if _, err := lazy.Get(t.Context()); !errors.Is(err, oidc.ErrJWKSEmpty) {
		t.Fatalf("expected the lazy build to fail with ErrJWKSEmpty, got: %v", err)
	}
}

func TestLazyIDTokenValidator(t *testing.T) {
	t.Parallel()

	idp := newFakeIDP(t)

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})
	disco := oidc.NewDiscoverer(idp.DiscoveryURL(), idp.URL(), client, false)
	provider := oidc.NewCustomProvider(t.Context(), idp.URL(), disco, client)

	builds := 0
	lazy := oidc.NewLazyIDTokenValidator(
		func(ctx context.Context) (*oidc.IDTokenValidator, error) {
			builds++
			return oidc.NewIDTokenValidatorForProvider(ctx, provider, []string{"client-id"})
		},
	)

	validator, err := lazy.Get(t.Context())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	again, err := lazy.Get(t.Context())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if validator != again || builds != 1 {
		t.Errorf("expected a single memoized validator, got %d builds", builds)
	}

	if _, err := validator.Validate(
		idp.MintToken(t, idp.DefaultClaims()), "",
	); err != nil {
		t.Errorf("unexpected error validating token: %v", err)
	}
}
