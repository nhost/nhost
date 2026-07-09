package providers_test

import (
	"net/url"
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
)

func TestGoogleAuthCodeURLProviderSpecificParams(t *testing.T) {
	t.Parallel()

	google := providers.NewGoogleProvider(
		"client-id",
		"client-secret",
		"https://auth.example.com",
		[]string{"openid", "email", "profile"},
	).Oauth2()

	t.Run("omitted params leave authorize URL unchanged", func(t *testing.T) {
		t.Parallel()

		raw := google.AuthCodeURL("state", nil)
		parsed, err := url.Parse(raw)
		if err != nil {
			t.Fatalf("parse authorize URL: %v", err)
		}

		for _, key := range []string{
			"prompt", "login_hint", "hd", "access_type", "include_granted_scopes", "hl",
		} {
			if got := parsed.Query().Get(key); got != "" {
				t.Fatalf("expected no %s query param, got %q", key, got)
			}
		}
	})

	t.Run("google-specific params are forwarded when set", func(t *testing.T) {
		t.Parallel()

		prompt := api.SelectAccount
		accessType := api.Offline
		includeGranted := api.True
		loginHint := "user@example.com"
		hd := "example.com"
		hl := "en-GB"

		raw := google.AuthCodeURL("state", &api.ProviderSpecificParams{
			Prompt:               &prompt,
			LoginHint:            &loginHint,
			Hd:                   &hd,
			AccessType:           &accessType,
			IncludeGrantedScopes: &includeGranted,
			Hl:                   &hl,
		})
		parsed, err := url.Parse(raw)
		if err != nil {
			t.Fatalf("parse authorize URL: %v", err)
		}

		want := map[string]string{
			"prompt":                 "select_account",
			"login_hint":             "user@example.com",
			"hd":                     "example.com",
			"access_type":            "offline",
			"include_granted_scopes": "true",
			"hl":                     "en-GB",
		}
		for key, expected := range want {
			if got := parsed.Query().Get(key); got != expected {
				t.Fatalf("expected %s=%q, got %q", key, expected, got)
			}
		}
	})
}
