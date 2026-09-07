package session_test

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
)

func makeToken(t *testing.T, payload map[string]any) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	body := base64.RawURLEncoding.EncodeToString(raw)

	return header + "." + body + ".sig"
}

func TestDecodeUserSessionPostgresArrayClaims(t *testing.T) {
	t.Parallel()

	token := makeToken(t, map[string]any{
		"exp": 9999999999,
		"iat": 1000,
		"sub": "user-1",
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-default-role":  "user",
			"x-hasura-allowed-roles": "{user,me}",
		},
	})

	decoded, err := session.DecodeUserSession(token)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}

	if decoded.Sub != "user-1" || decoded.Exp != 9999999999 {
		t.Fatalf("sub/exp = %q/%d", decoded.Sub, decoded.Exp)
	}

	roles, ok := decoded.HasuraClaims["x-hasura-allowed-roles"].([]string)
	if !ok {
		t.Fatalf("allowed-roles type = %T", decoded.HasuraClaims["x-hasura-allowed-roles"])
	}

	if len(roles) != 2 || roles[0] != "user" || roles[1] != "me" {
		t.Fatalf("roles = %v, want [user me]", roles)
	}

	if decoded.HasuraClaims["x-hasura-default-role"] != "user" {
		t.Fatalf("default-role = %v", decoded.HasuraClaims["x-hasura-default-role"])
	}
}

func TestDecodeUserSessionInvalid(t *testing.T) {
	t.Parallel()

	if _, err := session.DecodeUserSession("not-a-jwt"); err == nil {
		t.Fatal("expected error for malformed token")
	}
}

func TestStorageSetGetRemove(t *testing.T) {
	t.Parallel()

	token := makeToken(t, map[string]any{"exp": 9999999999, "sub": "u"})
	store := session.NewStorage(&session.MemoryStorage{})

	if err := store.Set(auth.Session{
		AccessToken:  token,
		RefreshToken: "r",
	}); err != nil {
		t.Fatalf("set: %v", err)
	}

	got, ok := store.Get()
	if !ok || got.AccessToken != token {
		t.Fatalf("get after set failed: ok=%v", ok)
	}

	if got.DecodedToken.Sub != "u" {
		t.Fatalf("decoded token not derived on set: sub=%q", got.DecodedToken.Sub)
	}

	store.Remove()

	if _, ok := store.Get(); ok {
		t.Fatal("session present after remove")
	}
}
