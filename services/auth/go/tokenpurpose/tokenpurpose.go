// Package tokenpurpose defines the kinds of JWT the auth service signs. Each
// kind carries its own "typ" header so a token signed for one purpose is never
// accepted for another (RFC 8725 §3.11).
package tokenpurpose

import "strings"

// Purpose is the kind of a JWT, carried in its "typ" header.
type Purpose string

const (
	Session           Purpose = "nhost-session+jwt"
	OAuth2AccessToken Purpose = "at+jwt" // RFC 9068
	OIDCIDToken       Purpose = "JWT"    // what OIDC client libraries expect
	ProviderState     Purpose = "nhost-provider-state+jwt"
)

// Matches reports whether typ names p. We only ever sign the exact lowercase
// values above, but "typ" is a media type, so per RFC 7515 §4.1.9 the match is
// case-insensitive and the "application/" prefix is optional.
func (p Purpose) Matches(typ string) bool {
	typ = strings.ToLower(typ)
	typ = strings.TrimPrefix(typ, "application/")

	return typ == strings.ToLower(string(p))
}
