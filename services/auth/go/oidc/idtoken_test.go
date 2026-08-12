package oidc_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/oidc"
)

func testProviderValidator(
	t *testing.T,
	audiences []string,
	datetime time.Time,
) *oidc.IDTokenValidator {
	t.Helper()

	v, err := oidc.NewIDTokenValidator(
		t.Context(),
		oidc.IDTokenProviderFake,
		audiences,
		jwt.WithTimeFunc(func() time.Time {
			return datetime
		}),
	)
	if err != nil {
		t.Fatalf("failed to create Google ID token validator: %v", err)
	}

	return v
}

func testToken(t *testing.T, nonce string) string {
	t.Helper()

	claims := jwt.MapClaims{
		"iss":            "fake.issuer",
		"aud":            "myapp.local",
		"sub":            "106964149809169421082",
		"email":          "jane@myapp.local",
		"email_verified": true,
		"name":           "Jane",
		"picture":        "https://myapp.local/jane.jpg",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	}

	if nonce != "" {
		hasher := sha256.New()
		hasher.Write([]byte(nonce))
		hashBytes := hasher.Sum(nil)
		noncestr := hex.EncodeToString(hashBytes)
		claims["nonce"] = noncestr
	}

	p := oidc.FakeProvider{}

	token, err := p.GenerateTestIDToken(claims)
	if err != nil {
		t.Fatalf("failed to generate test ID token: %v", err)
	}

	return token
}

func TestIDTokenValidate(t *testing.T) {
	t.Parallel()

	nonce := "4laVSZd0rNanAE0TS5iouQ=="
	tokenWithNonce := testToken(t, nonce)

	tokenWithoutNonce := testToken(t, "")

	provider := testProviderValidator(t, []string{"myapp.local"}, time.Now())

	cases := []struct {
		name             string
		idTokenValidator *oidc.IDTokenValidator
		token            string
		nonce            string
		expecedErr       error
	}{
		{
			name:             "with nonce",
			idTokenValidator: provider,
			token:            tokenWithNonce,
			nonce:            nonce,
			expecedErr:       nil,
		},
		{
			name:             "with wrong nonce",
			idTokenValidator: provider,
			token:            tokenWithNonce,
			nonce:            "asdasdasdasd",
			expecedErr:       oidc.ErrNonceMismatch,
		},
		{
			name:             "with missing nonce",
			idTokenValidator: provider,
			token:            tokenWithNonce,
			nonce:            "",
			expecedErr:       oidc.ErrNonceMismatch,
		},
		{
			name:             "without nonce",
			idTokenValidator: provider,
			token:            tokenWithoutNonce,
			nonce:            "",
			expecedErr:       nil,
		},
		{
			name:             "wrong audience",
			idTokenValidator: testProviderValidator(t, []string{"wrong-auddience"}, time.Now()),
			token:            tokenWithNonce,
			nonce:            nonce,
			expecedErr:       jwt.ErrTokenInvalidAudience,
		},
		{
			name: "multiple audiences - correct one first",
			idTokenValidator: testProviderValidator(
				t, []string{"myapp.local", "other-app", "another-app"}, time.Now(),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: nil,
		},
		{
			name: "multiple audiences - correct one in middle",
			idTokenValidator: testProviderValidator(
				t, []string{"other-app", "myapp.local", "another-app"}, time.Now(),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: nil,
		},
		{
			name: "multiple audiences - correct one last",
			idTokenValidator: testProviderValidator(
				t, []string{"other-app", "another-app", "myapp.local"}, time.Now(),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: nil,
		},
		{
			name: "multiple audiences - none match",
			idTokenValidator: testProviderValidator(
				t, []string{"wrong-app", "other-app", "another-app"}, time.Now(),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: jwt.ErrTokenInvalidAudience,
		},
		{
			name: "too early in the past",
			idTokenValidator: testProviderValidator(
				t, []string{"myapp.local"}, time.Date(2024, 10, 6, 15, 30, 0, 0, time.UTC),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: jwt.ErrTokenUsedBeforeIssued,
		},
		{
			name: "too late, expired",
			idTokenValidator: testProviderValidator(
				t, []string{"myapp.local"}, time.Date(2124, 12, 6, 15, 30, 0, 0, time.UTC),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: jwt.ErrTokenExpired,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := tc.idTokenValidator.Validate(
				tc.token, tc.nonce,
			); !errors.Is(err, tc.expecedErr) {
				t.Fatalf("expected error %v, got %v", tc.expecedErr, err)
			}
		})
	}
}

// TestIDTokenValidateIgnoringNonceAcceptsWhatStrictRejects pins why the third
// mode exists rather than reusing Validate(token, ""). Both rows are tokens a
// disableNonce provider must accept, mirrored against what Validate does with
// them — the interesting one being the IdP-minted claim, which Validate rejects.
func TestIDTokenValidateIgnoringNonceAcceptsWhatStrictRejects(t *testing.T) {
	t.Parallel()

	provider := testProviderValidator(t, []string{"myapp.local"}, time.Now())

	cases := []struct {
		name string
		// token carries the nonce claim shape under test.
		token string
		// strictErr is what Validate(token, "") does with the same token.
		strictErr error
	}{
		{
			// LinkedIn: ignores the nonce parameter, returns no claim.
			name:      "no nonce claim",
			token:     testToken(t, ""),
			strictErr: nil,
		},
		{
			// AWS Cognito: mints a nonce of its own. Nothing we can compare
			// against, which is why ValidateIgnoringNonce takes no argument.
			name:      "nonce claim the request never asked for",
			token:     testToken(t, "an-idp-minted-nonce"),
			strictErr: oidc.ErrNonceMismatch,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := provider.ValidateIgnoringNonce(tc.token); err != nil {
				t.Fatalf("expected the nonce to be ignored, got %v", err)
			}

			if _, err := provider.Validate(tc.token, ""); !errors.Is(err, tc.strictErr) {
				t.Fatalf(
					"expected Validate to return %v for this token, got %v",
					tc.strictErr, err,
				)
			}
		})
	}
}

// TestIDTokenValidateIgnoringNonceStaysBounded pins that only the nonce step
// is relaxed. Every row carries a valid, IdP-minted nonce claim, so a failure
// here can only come from the check the row is named after.
func TestIDTokenValidateIgnoringNonceStaysBounded(t *testing.T) {
	t.Parallel()

	token := testToken(t, "an-idp-minted-nonce")

	boundedClaims := func(issuer string) jwt.MapClaims {
		return jwt.MapClaims{
			"iss":   issuer,
			"aud":   "myapp.local",
			"sub":   "106964149809169421082",
			"nonce": "an-idp-minted-nonce",
			"iat":   time.Now().Unix(),
			"exp":   time.Now().Add(time.Hour).Unix(),
		}
	}

	foreignKeyToken, err := jwt.NewWithClaims(
		jwt.SigningMethodHS256, boundedClaims("fake.issuer"),
	).SignedString([]byte("not-the-providers-signing-key"))
	if err != nil {
		t.Fatalf("failed to sign the foreign-key token: %v", err)
	}

	// Signed with the provider's own key, so only the issuer differs.
	wrongIssuerToken, err := (&oidc.FakeProvider{}).GenerateTestIDToken(
		boundedClaims("https://not.the.configured.issuer"),
	)
	if err != nil {
		t.Fatalf("failed to sign the wrong-issuer token: %v", err)
	}

	// alg outside FakeProvider.GetValidMethods(). Caught by the allowlist, or by
	// signature verification without it, so the row pins the outcome only.
	noneToken, err := jwt.NewWithClaims(
		jwt.SigningMethodNone, boundedClaims("fake.issuer"),
	).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to sign the none-alg token: %v", err)
	}

	cases := []struct {
		name      string
		validator *oidc.IDTokenValidator
		token     string
		wantErr   error
	}{
		{
			name:      "wrong audience",
			validator: testProviderValidator(t, []string{"wrong-audience"}, time.Now()),
			token:     token,
			wantErr:   jwt.ErrTokenInvalidAudience,
		},
		{
			name: "expired",
			validator: testProviderValidator(
				t, []string{"myapp.local"}, time.Date(2124, 12, 6, 15, 30, 0, 0, time.UTC),
			),
			token:   token,
			wantErr: jwt.ErrTokenExpired,
		},
		{
			name: "used before issued",
			validator: testProviderValidator(
				t, []string{"myapp.local"}, time.Date(2024, 10, 6, 15, 30, 0, 0, time.UTC),
			),
			token:   token,
			wantErr: jwt.ErrTokenUsedBeforeIssued,
		},
		{
			name:      "foreign signing key",
			validator: testProviderValidator(t, []string{"myapp.local"}, time.Now()),
			token:     foreignKeyToken,
			wantErr:   jwt.ErrTokenSignatureInvalid,
		},
		{
			// With no request binding left, the issuer is what says the token
			// came from the configured IdP.
			name:      "wrong issuer",
			validator: testProviderValidator(t, []string{"myapp.local"}, time.Now()),
			token:     wrongIssuerToken,
			wantErr:   jwt.ErrTokenInvalidIssuer,
		},
		{
			name:      "unsigned token",
			validator: testProviderValidator(t, []string{"myapp.local"}, time.Now()),
			token:     noneToken,
			wantErr:   jwt.ErrTokenSignatureInvalid,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := tc.validator.ValidateIgnoringNonce(
				tc.token,
			); !errors.Is(err, tc.wantErr) {
				t.Fatalf("expected error %v, got %v", tc.wantErr, err)
			}
		})
	}
}
