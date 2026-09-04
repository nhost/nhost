package auth_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/auth"
)

const pkceCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

func TestGenerateCodeVerifier(t *testing.T) {
	t.Parallel()

	assertCodeVerifier(t, auth.GenerateCodeVerifier())
}

func TestGenerateCodeChallengeRFC7636Vector(t *testing.T) {
	t.Parallel()

	// RFC 7636 Appendix B test vector.
	got := auth.GenerateCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
	if got != "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" {
		t.Fatalf("challenge = %q", got)
	}
}

func TestGeneratePKCEPair(t *testing.T) {
	t.Parallel()

	pair := auth.GeneratePKCEPair()
	assertCodeVerifier(t, pair.Verifier)

	if got := auth.GenerateCodeChallenge(pair.Verifier); got != pair.Challenge {
		t.Fatalf("challenge = %q, want %q", got, pair.Challenge)
	}
}

func assertCodeVerifier(t *testing.T, verifier string) {
	t.Helper()

	if len(verifier) != 43 {
		t.Fatalf("verifier length = %d, want 43", len(verifier))
	}

	for _, character := range verifier {
		if !strings.ContainsRune(pkceCharacters, character) {
			t.Fatalf("verifier contains invalid character %q", character)
		}
	}
}
