package cmd

import (
	"log/slog"
	"testing"
)

func TestRedactOIDCLogAttr(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		url  string
		want string
	}{
		{
			url:  "/v1/signin/oidc/authentik/callback?code=private&state=private",
			want: "/v1/signin/oidc/authentik/callback",
		},
		{
			url:  "/signup/oidc/authentik?state=private",
			want: "/signup/oidc/authentik",
		},
		{
			url:  "/v1/signin/%6fidc/authentik/callback?code=private",
			want: "/v1/signin/%6fidc/authentik/callback",
		},
		{
			url:  "/signin/provider/google?state=example",
			want: "/signin/provider/google?state=example",
		},
	} {
		attr := redactOIDCLogAttr([]string{"request"}, slog.String("url", tc.url))
		if got := attr.Value.String(); got != tc.want {
			t.Errorf("request URL = %q, want %q", got, tc.want)
		}
	}

	if !isSecret(flagOIDCProviders) {
		t.Error("OIDC provider configuration must be redacted from startup logs")
	}
}
