package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// GenerateCodeVerifier generates a cryptographically random PKCE code verifier
// (43 base64url characters, per RFC 7636).
func GenerateCodeVerifier() string {
	buf := make([]byte, 32) //nolint:mnd
	_, _ = rand.Read(buf)

	return base64.RawURLEncoding.EncodeToString(buf)
}

// GenerateCodeChallenge derives an S256 code challenge from a code verifier.
func GenerateCodeChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))

	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// PKCEPair is a PKCE code verifier and its derived S256 challenge.
type PKCEPair struct {
	Verifier  string
	Challenge string
}

// GeneratePKCEPair generates a PKCE code verifier and its S256 challenge.
func GeneratePKCEPair() PKCEPair {
	verifier := GenerateCodeVerifier()

	return PKCEPair{Verifier: verifier, Challenge: GenerateCodeChallenge(verifier)}
}
