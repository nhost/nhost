package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// GenerateCodeVerifier generates a cryptographically random PKCE code verifier
// (43 base64url characters, per RFC 7636).
//
// It panics if the system CSPRNG fails: a failed read would otherwise leave the
// buffer zero-filled, yielding a fully predictable verifier and silently
// defeating PKCE. A CSPRNG failure is unrecoverable, so panicking is correct.
func GenerateCodeVerifier() string {
	buf := make([]byte, 32) //nolint:mnd
	if _, err := rand.Read(buf); err != nil {
		panic("nhost/auth: crypto/rand failed: " + err.Error())
	}

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
