package oidc_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/api"
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
		api.IdTokenProviderFake,
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
