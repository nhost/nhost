package token_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/token"
)

// TestKindString checks each token kind has a non-empty distinct
// string form. Catches missing entries in the String() switch.
func TestKindString(t *testing.T) {
	seen := map[string]token.Kind{}
	for k := token.KindEOF; k <= token.KindStringEnd; k++ {
		s := k.String()
		if s == "" || strings.HasPrefix(s, "Kind(") {
			t.Fatalf("kind %d has no String() entry (got %q)", k, s)
		}
		if prev, ok := seen[s]; ok {
			t.Fatalf("duplicate String() %q for kinds %d and %d", s, prev, k)
		}
		seen[s] = k
	}
}

func TestTokenString(t *testing.T) {
	cases := []struct {
		tok  token.Token
		want string
	}{
		{token.Token{Kind: token.KindStringLit, Text: "hi"}, `STRING_LIT("hi")`},
		{token.Token{Kind: token.KindIdentifier, Text: "$body"}, `IDENT("$body")`},
		{token.Token{Kind: token.KindIntLit, Text: "42"}, `INT("42")`},
		{token.Token{Kind: token.KindNumLit, Text: "1.5"}, `NUMBER("1.5")`},
		{token.Token{Kind: token.KindBoolLit, Bool: true}, `BOOL(true)`},
		{token.Token{Kind: token.KindDoubleCurlyOpen}, `{{`},
		{token.Token{Kind: token.KindEOF}, `EOF`},
	}
	for _, c := range cases {
		if got := c.tok.String(); got != c.want {
			t.Errorf("Token.String() = %q, want %q", got, c.want)
		}
	}
}
