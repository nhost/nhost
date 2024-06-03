package controller_test

import (
	"net/url"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-auth/go/controller"
)

func ptr[T any](x T) *T { return &x }

func getConfig() *controller.Config {
	clientURL, _ := url.Parse("http://localhost:3000")
	serverURL, _ := url.Parse("https://local.auth.nhost.run")

	//nolint:lll
	return &controller.Config{
		HasuraGraphqlURL:         "http://localhost:8080/v1/graphql",
		HasuraAdminSecret:        "nhost-admin-secret",
		AllowedEmailDomains:      []string{},
		AllowedEmails:            []string{},
		AllowedRedirectURLs:      []string{},
		BlockedEmailDomains:      []string{},
		BlockedEmails:            []string{},
		ClientURL:                clientURL,
		CustomClaims:             "",
		ConcealErrors:            false,
		DisableSignup:            false,
		DisableNewUsers:          false,
		DefaultAllowedRoles:      []string{"user", "me"},
		DefaultRole:              "user",
		DefaultLocale:            "en",
		AllowedLocales:           []string{"en", "es", "ca", "se"},
		GravatarEnabled:          false,
		GravatarDefault:          "blank",
		GravatarRating:           "g",
		PasswordMinLength:        3,
		PasswordHIBPEnabled:      false,
		RefreshTokenExpiresIn:    2592000,
		AccessTokenExpiresIn:     900,
		JWTSecret:                `{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","issuer":"hasura-auth"}`,
		RequireEmailVerification: false,
		ServerURL:                serverURL,
		EmailPasswordlessEnabled: false,
		WebauthnEnabled:          true,
		WebauthnRPID:             "react-apollo.example.nhost.io",
		WebauthnRPName:           "React Apollo Example",
		WebauthnRPOrigins: []string{
			"https://react-apollo.example.nhost.io",
		},
		WebauhtnAttestationTimeout: time.Minute,
	}
}

func TestValidateRedirectTo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		allowedURLs []string
		redirectTos []string
		allowed     bool
	}{
		{
			name: "allowed",
			allowedURLs: []string{
				"http://localhost:3000",
				"https://acme.com/path",
				"https://*.acme.io",
				"https://*-sub.acme.io",
				"myapp://my.app",
				"https://mydomainwithslash.com/",
				"https://mydomainwithslashstar.com/*",
				"https://mydomainwithslashstarstar.com/**",
			},
			redirectTos: []string{
				"http://localhost:3000",
				"http://localhost:3000/",
				"http://localhost:3000/subpath",
				"https://acme.com/path",
				"https://acme.com:443/path", // port is optional with http/https
				"https://acme.com/path/subpath",
				"https://acme.com/path/subpath?query=param#fragment",
				"https://acme.com/path?query=param#fragment",
				"https://acme.com/path/?query=param#fragment",
				"https://acme.com/path/?query=param#fragment",
				"https://subdomain.acme.io",
				"https://123subdomain.acme.io",
				"https://123-subdomain.acme.io",
				"https://asdasdsad-sub.acme.io",
				"https://asdasdsad-sub.acme.io",
				"myapp://my.app",
				"myapp://my.app/",
				"myapp://my.app/subpath",
				"https://mydomainwithslash.com",
				"https://mydomainwithslash.com/",
				"https://mydomainwithslash.com/a",
				"https://mydomainwithslash.com/a/",
				"https://mydomainwithslash.com/a/b",
				"https://mydomainwithslashstar.com",
				"https://mydomainwithslashstar.com/",
				"https://mydomainwithslashstar.com/a",
				"https://mydomainwithslashstar.com/a/",
				"https://mydomainwithslashstar.com/a/b",
				"https://mydomainwithslashstarstar.com",
				"https://mydomainwithslashstarstar.com/",
				"https://mydomainwithslashstarstar.com/a",
				"https://mydomainwithslashstarstar.com/a/",
				"https://mydomainwithslashstarstar.com/a/b",
			},
			allowed: true,
		},
		{
			name: "not allowed",
			allowedURLs: []string{
				"http://localhost:3000",
				"https://acme.com/path",
				"https://*.acme.io",
				"http://simple.com",
			},
			redirectTos: []string{
				"https://localhost:3000", // scheme mismatch
				"http://localhost:4000",  // port mismatch
				"http://localhost",       // no port
				"http://prefixlocalhost:3000",
				"not-a-url",
				"https://",
				"https://acme.com/wrongpath",
				"https://subdomain.subdomain.acme.io", // only one wildcard in the url
				"https://acme.io",                     // bare is not allowed because we expect *.acme.io
				"https://simple.com.hijack.com",       // make sure anchors are set properly
				"https://simple.comhijack.com",        // make sure anchors are set properly
			},
			allowed: false,
		},
		{
			name:        "allow everything if empty",
			allowedURLs: []string{},
			redirectTos: []string{"https://localhost:3000"},
			allowed:     true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			fn, err := controller.ValidateRedirectTo(tc.allowedURLs)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			for _, redirectTo := range tc.redirectTos {
				got := fn(redirectTo)
				if diff := cmp.Diff(got, tc.allowed); diff != "" {
					t.Errorf("unexpected result for %s (-want +got):\n%s", redirectTo, diff)
				}
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		blockedDomains []string
		blockedEmails  []string
		allowedDomains []string
		allowedEmails  []string
		email          string
		expected       bool
	}{
		{
			name:           "empty",
			blockedDomains: []string{},
			blockedEmails:  []string{},
			allowedDomains: []string{},
			allowedEmails:  []string{},
			email:          "test@acme.com",
			expected:       true,
		},

		{
			name:           "blocked domain matches",
			blockedDomains: []string{"acme.com"},
			blockedEmails:  []string{},
			allowedDomains: []string{},
			allowedEmails:  []string{},
			email:          "test@acme.com",
			expected:       false,
		},

		{
			name:           "blocked domain doesnt match",
			blockedDomains: []string{"acme.com"},
			blockedEmails:  []string{},
			allowedDomains: []string{},
			allowedEmails:  []string{},
			email:          "test@acme.se",
			expected:       true,
		},

		{
			name:           "blocked email matches",
			blockedDomains: []string{},
			blockedEmails:  []string{"test@acme.com"},
			allowedDomains: []string{},
			allowedEmails:  []string{},
			email:          "test@acme.com",
			expected:       false,
		},

		{
			name:           "blocked email doesnt match",
			blockedDomains: []string{},
			blockedEmails:  []string{"test@acme.com"},
			allowedDomains: []string{},
			allowedEmails:  []string{},
			email:          "test@acme.se",
			expected:       true,
		},

		{
			name:           "allowed domain matches",
			blockedDomains: []string{},
			blockedEmails:  []string{},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{},
			email:          "test@acme.com",
			expected:       true,
		},

		{
			name:           "allowed domain doesnt match",
			blockedDomains: []string{},
			blockedEmails:  []string{},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{},
			email:          "test@acme.se",
			expected:       false,
		},

		{
			name:           "allowed email matches",
			blockedDomains: []string{},
			blockedEmails:  []string{},
			allowedDomains: []string{},
			allowedEmails:  []string{"test@acme.com"},
			email:          "test@acme.com",
			expected:       true,
		},

		{
			name:           "allowed email doesnt match",
			blockedDomains: []string{},
			blockedEmails:  []string{},
			allowedDomains: []string{},
			allowedEmails:  []string{"test@acme.com"},
			email:          "test@acme.se",
			expected:       false,
		},
		{
			name:           "precedence - unrelated",
			blockedDomains: []string{"blocked.com"},
			blockedEmails:  []string{"evil@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@blocked.com"},
			email:          "random@company.com",
			expected:       false,
		},
		{
			name:           "precedence - allowed email",
			blockedDomains: []string{"blocked.com"},
			blockedEmails:  []string{"evil@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@blocked.com"},
			email:          "good@blocked.com",
			expected:       true,
		},
		{
			name:           "precedence - blocked email",
			blockedDomains: []string{"blocked.com"},
			blockedEmails:  []string{"evil@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@blocked.com"},
			email:          "evil@acme.com",
			expected:       false,
		},
		{
			name:           "precedence - blocked domain",
			blockedDomains: []string{"blocked.com"},
			blockedEmails:  []string{"evil@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@blocked.com"},
			email:          "asd@evil.com",
			expected:       false,
		},
		{
			name:           "precedence - allowed domain",
			blockedDomains: []string{"blocked.com"},
			blockedEmails:  []string{"evil@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@blocked.com"},
			email:          "asd@acme.com",
			expected:       true,
		},
		{
			name:           "blocking take precedence over allowing",
			blockedDomains: []string{"acme.com"},
			blockedEmails:  []string{"good@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@acme.com"},
			email:          "asd@acme.com",
			expected:       false,
		},
		{
			name:           "blocking take precedence over allowing",
			blockedDomains: []string{"acme.com"},
			blockedEmails:  []string{"good@acme.com"},
			allowedDomains: []string{"acme.com"},
			allowedEmails:  []string{"good@acme.com"},
			email:          "good@acme.com",
			expected:       false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			fn := controller.ValidateEmail(
				tc.blockedDomains,
				tc.blockedEmails,
				tc.allowedDomains,
				tc.allowedEmails,
			)
			got := fn(tc.email)
			if tc.expected != got {
				t.Errorf(
					"unexpected result for %s: got %t, expected %t",
					tc.email,
					got,
					tc.expected,
				)
			}
		})
	}
}
