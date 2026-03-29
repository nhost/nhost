package pkce_test

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/pkce"
)

func TestValidateS256(t *testing.T) {
	t.Parallel()

	// Generate a valid verifier and challenge pair
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-this-is-long-enough-43"
	h := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.RawURLEncoding.EncodeToString(h[:])

	cases := []struct {
		name          string
		codeChallenge string
		codeVerifier  string
		wantErr       bool
	}{
		{
			name:          "valid pair",
			codeChallenge: codeChallenge,
			codeVerifier:  codeVerifier,
			wantErr:       false,
		},
		{
			name:          "empty verifier",
			codeChallenge: codeChallenge,
			codeVerifier:  "",
			wantErr:       true,
		},
		{
			name:          "wrong verifier",
			codeChallenge: codeChallenge,
			codeVerifier:  "wrong-verifier-that-is-long-enough-to-be-43-characters-long-yes",
			wantErr:       true,
		},
		{
			name:          "verifier too short",
			codeChallenge: codeChallenge,
			codeVerifier:  "too-short",
			wantErr:       true,
		},
		{
			name:          "verifier too long",
			codeChallenge: codeChallenge,
			codeVerifier:  strings.Repeat("a", 129),
			wantErr:       true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := pkce.ValidateS256(tc.codeChallenge, tc.codeVerifier)
			if (err != nil) != tc.wantErr {
				t.Errorf("ValidateS256() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}

func TestValidateCodeChallengeFormat(t *testing.T) {
	t.Parallel()

	// A valid S256 code challenge: SHA-256 of verifier, base64url-encoded without padding = 43 chars
	validChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

	cases := []struct {
		name          string
		codeChallenge string
		wantErr       bool
	}{
		{
			name:          "valid challenge",
			codeChallenge: validChallenge,
			wantErr:       false,
		},
		{
			name:          "empty string",
			codeChallenge: "",
			wantErr:       true,
		},
		{
			name:          "too short",
			codeChallenge: "abc",
			wantErr:       true,
		},
		{
			name:          "too long",
			codeChallenge: validChallenge + "x",
			wantErr:       true,
		},
		{
			name:          "invalid characters (padding)",
			codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw=cM",
			wantErr:       true,
		},
		{
			name:          "invalid characters (space)",
			codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSst -cM",
			wantErr:       true,
		},
		{
			name:          "invalid characters (plus sign - standard base64)",
			codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM",
			wantErr:       true,
		},
		{
			name:          "all valid base64url chars",
			codeChallenge: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq",
			wantErr:       false,
		},
		{
			name:          "with underscore and hyphen",
			codeChallenge: "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE",
			wantErr:       false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := pkce.ValidateCodeChallengeFormat(tc.codeChallenge)
			if (err != nil) != tc.wantErr {
				t.Errorf("ValidateCodeChallengeFormat() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}

func TestHashCode(t *testing.T) {
	t.Parallel()

	code := "test-authorization-code"
	hash1 := pkce.HashCode(code)
	hash2 := pkce.HashCode(code)

	if hash1 != hash2 {
		t.Errorf("HashCode() is not deterministic: %s != %s", hash1, hash2)
	}

	differentHash := pkce.HashCode("different-code")
	if hash1 == differentHash {
		t.Error("HashCode() produces same hash for different inputs")
	}
}

func TestGenerateCode(t *testing.T) {
	t.Parallel()

	code1, err := pkce.GenerateCode()
	if err != nil {
		t.Fatalf("GenerateCode() error = %v", err)
	}

	code2, err := pkce.GenerateCode()
	if err != nil {
		t.Fatalf("GenerateCode() error = %v", err)
	}

	if code1 == code2 {
		t.Error("GenerateCode() produced duplicate codes")
	}

	if len(code1) == 0 {
		t.Error("GenerateCode() produced empty code")
	}
}
