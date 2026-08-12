package controller

import (
	"testing"

	"github.com/nhost/nhost/services/auth/go/providers"
	"golang.org/x/oauth2"
)

// TestCallbackIDToken pins the trust order of the browser callback's id_token,
// and above all the one branch nothing else reaches: Apple's.
//
// Apple delivers its id_token by form_post, so the caller-controlled req.IDToken
// is its only source. The rule is now an exact comparison against
// providers.AppleID, so dropping the branch or mis-keying the constant breaks
// every Sign-in-with-Apple login — and no other controller test drives it.
func TestCallbackIDToken(t *testing.T) {
	t.Parallel()

	fromExchange := "id-token-from-the-token-response"
	fromCaller := "id-token-from-the-caller"

	// A bare token stands in for a token response with no id_token.
	tokenWithIDToken := (&oauth2.Token{}).WithExtra(map[string]any{
		"id_token": fromExchange,
	})
	tokenWithoutIDToken := &oauth2.Token{}

	tests := []struct {
		name     string
		provider string
		idToken  *string
		token    *oauth2.Token
		want     *string
	}{
		{
			// The exchange wins even against Apple: it is bound to the code this
			// server redeemed with its own client credentials.
			name:     "the token response wins over the caller's copy",
			provider: providers.AppleID,
			idToken:  new(fromCaller),
			token:    tokenWithIDToken,
			want:     new(fromExchange),
		},
		{
			// The branch that is otherwise untested anywhere: it fails if the
			// constant drifts or the fallback is removed.
			name:     "apple falls back to the caller's copy",
			provider: providers.AppleID,
			idToken:  new(fromCaller),
			token:    tokenWithoutIDToken,
			want:     new(fromCaller),
		},
		{
			name:     "a custom provider gets nothing",
			provider: "c:test",
			idToken:  new(fromCaller),
			token:    tokenWithoutIDToken,
			want:     nil,
		},
		{
			name:     "a built-in that is not apple gets nothing",
			provider: providers.GoogleID,
			idToken:  new(fromCaller),
			token:    tokenWithoutIDToken,
			want:     nil,
		},
		{
			// An empty id_token is not a value: Apple still falls through.
			name:     "an empty token-response id_token is not a value",
			provider: providers.AppleID,
			idToken:  new(fromCaller),
			token: (&oauth2.Token{}).WithExtra(
				map[string]any{"id_token": ""},
			),
			want: new(fromCaller),
		},
		{
			name:     "apple with no id_token anywhere",
			provider: providers.AppleID,
			idToken:  nil,
			token:    tokenWithoutIDToken,
			want:     nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := callbackIDToken(
				providerCallbackData{Provider: tc.provider, IDToken: tc.idToken},
				tc.token,
			)

			switch {
			case tc.want == nil && got != nil:
				t.Fatalf("expected no id_token, got %q", *got)
			case tc.want != nil && got == nil:
				t.Fatalf("expected %q, got none", *tc.want)
			case tc.want != nil && *got != *tc.want:
				t.Errorf("expected %q, got %q", *tc.want, *got)
			}
		})
	}
}
