package jwt

import (
	"bytes"
	"context"
	"log/slog"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// fakeJWKSProvider captures the context handed to the JWKS provider
// constructor so a test can observe its cancellation, and satisfies the
// unexported jwksProvider boundary interface.
type fakeJWKSProvider struct {
	ctx       context.Context //nolint:containedctx
	cancelled atomic.Bool
}

func (f *fakeJWKSProvider) Keyfunc(_ *gojwt.Token) (any, error) {
	return nil, nil //nolint:nilnil
}

func TestAuthenticatorCloseCancelsJWKSContext(t *testing.T) {
	t.Parallel()

	fake := &fakeJWKSProvider{ctx: nil}

	newJWKS := func(ctx context.Context, _ []string) (jwksProvider, error) {
		fake.ctx = ctx
		go func() {
			<-ctx.Done()
			fake.cancelled.Store(true)
		}()

		return fake, nil
	}

	auth, err := newAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: "https://example.test/jwks"}},
	}, slog.Default(), newJWKS)
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}

	if fake.ctx == nil {
		t.Fatal("expected newJWKSKeyfunc to capture a context, got nil")
	}

	if fake.cancelled.Load() {
		t.Fatal("context was cancelled before Close() was called")
	}

	auth.Close()

	deadline := time.Now().Add(time.Second)
	for !fake.cancelled.Load() {
		if time.Now().After(deadline) {
			t.Fatal("Close() did not cancel JWKS context within 1s")
		}

		time.Sleep(time.Millisecond)
	}

	if fake.ctx.Err() == nil {
		t.Errorf("expected fake.ctx.Err() != nil after Close(), got nil")
	}
}

// TestStaticHMACKeyUsesRawBytesAndLogsSafely guards the Hasura-compatible
// HMAC key contract: the configured key string is used as raw UTF-8 bytes even
// when it also happens to be valid base64. The startup DEBUG log records only
// safe metadata and must never include key material.
func TestStaticHMACKeyUsesRawBytesAndLogsSafely(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		alg  jwtconfig.Algorithm
		key  string
	}{
		{
			name: "hs256 valid-base64-looking key stays raw",
			alg:  jwtconfig.AlgorithmHS256,
			key:  "dGVzdA==",
		},
		{
			name: "hs512 hex key stays raw",
			alg:  jwtconfig.AlgorithmHS512,
			key:  "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
				Level: slog.LevelDebug,
			}))

			sv := &secretValidator{}
			if err := sv.initStatic(
				jwtconfig.Secret{Type: tt.alg, Key: tt.key},
				logger,
			); err != nil {
				t.Fatalf("initStatic() error = %v", err)
			}

			gotKey, err := sv.keyFunc(&gojwt.Token{})
			if err != nil {
				t.Fatalf("keyFunc() error = %v", err)
			}

			got, ok := gotKey.([]byte)
			if !ok {
				t.Fatalf("keyFunc() key type = %T, want []byte", gotKey)
			}

			if !bytes.Equal(got, []byte(tt.key)) {
				t.Errorf("keyFunc() key = %q, want raw key bytes %q", got, []byte(tt.key))
			}

			out := buf.String()
			if !strings.Contains(out, "jwt hmac key used as raw bytes") {
				t.Errorf("log output %q does not contain raw-bytes message", out)
			}

			wantAttr := "key_len=" + strconv.Itoa(len(tt.key))
			if !strings.Contains(out, wantAttr) {
				t.Errorf("log output %q does not contain attribute %q", out, wantAttr)
			}

			if strings.Contains(out, tt.key) {
				t.Errorf("log output %q leaked key material %q", out, tt.key)
			}
		})
	}
}

func TestStaticHMACKeyNilLoggerDoesNotPanic(t *testing.T) {
	t.Parallel()

	const key = "my-hmac-signing-secret"

	sv := &secretValidator{}
	if err := sv.initStatic(
		jwtconfig.Secret{Type: jwtconfig.AlgorithmHS256, Key: key},
		nil,
	); err != nil {
		t.Fatalf("initStatic() error = %v", err)
	}

	gotKey, err := sv.keyFunc(&gojwt.Token{})
	if err != nil {
		t.Fatalf("keyFunc() error = %v", err)
	}

	got, ok := gotKey.([]byte)
	if !ok {
		t.Fatalf("keyFunc() key type = %T, want []byte", gotKey)
	}

	if !bytes.Equal(got, []byte(key)) {
		t.Errorf("keyFunc() key = %q, want raw key bytes", got)
	}
}

// TestBuildParserOptionsJWKSRejectsHS256BeforeKeyResolution pins the
// algorithm-confusion defense for JWKS-backed secrets at the layer it actually
// lives: buildParserOptions adds WithValidMethods(jwksAllowedMethods()), so the
// parser must reject an HS256 token during method validation BEFORE the keyfunc
// runs. The full-stack TestAuthenticatorJWKURLRejectsHS256 cannot pin this — its
// RSA JWKS keyfunc returns an *rsa.PublicKey that an HMAC token fails against
// anyway, so it stays green even if WithValidMethods is removed. This test fails
// if the allowlist is dropped: the keyfunc would then be invoked and return an
// HMAC secret the HS256 signature verifies against.
func TestBuildParserOptionsJWKSRejectsHS256BeforeKeyResolution(t *testing.T) {
	t.Parallel()

	opts := buildParserOptions(
		jwtconfig.Secret{JWKURL: "https://example.test/.well-known/jwks.json"},
	)
	parser := gojwt.NewParser(opts...)

	const hmacKey = "attacker-hmac-key"

	tokenStr, err := gojwt.NewWithClaims(gojwt.SigningMethodHS256, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString([]byte(hmacKey))
	if err != nil {
		t.Fatalf("sign HS256 token: %v", err)
	}

	keyfuncCalled := false

	_, parseErr := parser.Parse(tokenStr, func(*gojwt.Token) (any, error) {
		// If the parser reaches key resolution, hand back the exact key the
		// token was signed with so the HS256 signature would verify. With the
		// allowlist in place this is never reached.
		keyfuncCalled = true

		return []byte(hmacKey), nil
	})
	if parseErr == nil {
		t.Fatal(
			"expected HS256 token to be rejected by the JWKS parser method allowlist, got nil error",
		)
	}

	if keyfuncCalled {
		t.Error(
			"keyfunc was invoked: HS256 was not rejected at the method-validation " +
				"layer before key resolution (WithValidMethods missing from the JWKS branch?)",
		)
	}
}
