// Package session provides the enriched, client-side session managed by the
// SDK, JWT decoding, storage backends, and token refresh.
//
// StoredSession is a superset of the raw auth Session returned by the API,
// adding a DecodedToken with the parsed JWT payload so Hasura claims, roles,
// and session variables are available without manually decoding the token.
package session

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/auth"
)

const (
	jwtSegments   = 3
	hasuraClaims  = "https://hasura.io/jwt/claims"
	defaultMargin = 60
)

// ErrInvalidToken is returned when an access token cannot be decoded.
var ErrInvalidToken = errors.New("invalid access token format")

// DecodedToken is the decoded JWT access-token payload. Exp and Iat are epoch
// seconds. Raw holds every claim (including unknown ones) as decoded.
//
// Security: the token signature is NOT verified when producing this struct
// (see DecodeUserSession). These claims are used only to schedule client-side
// refresh of the SDK's own token and must never be trusted for authorization
// decisions on tokens from an untrusted source. Server-side code must verify
// the JWT against the auth JWKS (.well-known/jwks.json) before trusting claims.
type DecodedToken struct {
	Exp          int64          `json:"exp,omitempty"`
	Iat          int64          `json:"iat,omitempty"`
	Iss          string         `json:"iss,omitempty"`
	Sub          string         `json:"sub,omitempty"`
	HasuraClaims map[string]any `json:"https://hasura.io/jwt/claims,omitempty"`
	Raw          map[string]any `json:"-"`
}

// StoredSession is the enriched session persisted by the SDK: the raw auth
// Session plus the decoded access token.
type StoredSession struct {
	auth.Session

	DecodedToken DecodedToken `json:"decodedToken"`
}

func decodeBase64URL(segment string) ([]byte, error) {
	if pad := len(segment) % 4; pad != 0 { //nolint:mnd
		segment += strings.Repeat("=", 4-pad) //nolint:mnd
	}

	data, err := base64.URLEncoding.DecodeString(segment)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return data, nil
}

func isPostgresArray(v string) bool {
	return strings.HasPrefix(v, "{") && strings.HasSuffix(v, "}")
}

func parsePostgresArray(v string) []string {
	if v == "" || v == "{}" {
		return []string{}
	}

	parts := strings.Split(v[1:len(v)-1], ",")
	out := make([]string, 0, len(parts))

	for _, p := range parts {
		out = append(out, strings.Trim(strings.TrimSpace(p), `"`))
	}

	return out
}

// DecodeUserSession decodes the payload of a JWT access token. Hasura claims
// encoded as PostgreSQL array literals (e.g. "{user,me}") are converted into
// string slices, mirroring the JS SDK.
//
// This decodes but does NOT verify the token: the signature is not checked and
// no claim (including exp) is validated. It is intended only for reading the
// SDK's own session token to drive refresh timing. Do not use the returned
// claims to make authorization decisions on untrusted tokens; verify against
// the auth JWKS first.
func DecodeUserSession(accessToken string) (DecodedToken, error) {
	var decoded DecodedToken

	segments := strings.Split(accessToken, ".")
	if len(segments) != jwtSegments || segments[1] == "" {
		return decoded, ErrInvalidToken
	}

	raw, err := decodeBase64URL(segments[1])
	if err != nil {
		return decoded, err
	}

	payload := map[string]any{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return decoded, ErrInvalidToken
	}

	decoded.Raw = payload

	if v, ok := payload["exp"].(float64); ok {
		decoded.Exp = int64(v)
	}

	if v, ok := payload["iat"].(float64); ok {
		decoded.Iat = int64(v)
	}

	decoded.Iss, _ = payload["iss"].(string)
	decoded.Sub, _ = payload["sub"].(string)

	if claims, ok := payload[hasuraClaims].(map[string]any); ok {
		processed := make(map[string]any, len(claims))

		for key, value := range claims {
			if s, ok := value.(string); ok && isPostgresArray(s) {
				processed[key] = parsePostgresArray(s)
			} else {
				processed[key] = value
			}
		}

		decoded.HasuraClaims = processed
	}

	return decoded, nil
}

// ToStoredSession enriches a raw auth Session into a StoredSession.
func ToStoredSession(s auth.Session) (StoredSession, error) {
	decoded, err := DecodeUserSession(s.AccessToken)
	if err != nil {
		return StoredSession{}, err
	}

	return StoredSession{Session: s, DecodedToken: decoded}, nil
}
