package providers_test

import (
	"errors"
	"net/url"
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
	"golang.org/x/oauth2"
)

func applyOpts(t *testing.T, opts []oauth2.AuthCodeOption) url.Values {
	t.Helper()

	cfg := &oauth2.Config{
		ClientID:    "client-id",
		RedirectURL: "https://auth.example.com/callback",
		Scopes:      []string{"openid", "email"},
		Endpoint: oauth2.Endpoint{
			AuthURL: "https://provider.example.com/authorize",
		},
	}

	parsed, err := url.Parse(cfg.AuthCodeURL("state", opts...))
	if err != nil {
		t.Fatalf("parse authorize URL: %v", err)
	}

	return parsed.Query()
}

func TestUpstreamParamsToOpts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		params        *api.UpstreamAuthParams
		expectedQuery map[string]string
		wantErr       error
	}{
		{
			name:          "nil params add nothing",
			params:        nil,
			expectedQuery: map[string]string{},
			wantErr:       nil,
		},
		{
			name: "google params are forwarded verbatim",
			params: &api.UpstreamAuthParams{
				"prompt":                 "select_account",
				"login_hint":             "user@example.com",
				"hd":                     "example.com",
				"access_type":            "offline",
				"include_granted_scopes": "true",
				"hl":                     "en-GB",
			},
			expectedQuery: map[string]string{
				"prompt":                 "select_account",
				"login_hint":             "user@example.com",
				"hd":                     "example.com",
				"access_type":            "offline",
				"include_granted_scopes": "true",
				"hl":                     "en-GB",
			},
			wantErr: nil,
		},
		{
			name:          "reserved parameter is rejected",
			params:        &api.UpstreamAuthParams{"redirect_uri": "https://evil.example.com"},
			expectedQuery: nil,
			wantErr:       providers.ErrReservedUpstreamParam,
		},
		{
			name:          "reserved parameter is rejected case-insensitively",
			params:        &api.UpstreamAuthParams{"Scope": "admin"},
			expectedQuery: nil,
			wantErr:       providers.ErrReservedUpstreamParam,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts, err := providers.UpstreamParamsToOpts(tt.params)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("unexpected error: got %v, want %v", err, tt.wantErr)
			}

			if tt.wantErr != nil {
				return
			}

			query := applyOpts(t, opts)
			for key, want := range tt.expectedQuery {
				if got := query.Get(key); got != want {
					t.Errorf("query %q = %q, want %q", key, got, want)
				}
			}

			// The auth server's own parameters must remain intact.
			if got := query.Get("redirect_uri"); got != "https://auth.example.com/callback" {
				t.Errorf("redirect_uri overwritten: %q", got)
			}

			if got := query.Get("scope"); got != "openid email" {
				t.Errorf("scope overwritten: %q", got)
			}
		})
	}
}
