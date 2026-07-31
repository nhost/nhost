package oidc_test

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/auth/go/oidc"
)

// staticDoc returns a valid pinned document. Tests mutate one field to pin
// what each check rejects.
func staticDoc() oidc.DiscoveryDocument {
	return oidc.DiscoveryDocument{
		Issuer:                "https://idp.example.com",
		AuthorizationEndpoint: "https://idp.example.com/authorize",
		TokenEndpoint:         "https://idp.example.com/token",
		UserinfoEndpoint:      "https://idp.example.com/userinfo",
		JWKSURI:               "https://idp.example.com/jwks.json",
	}
}

func TestNewStaticDiscovererValidates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		mutate      func(*oidc.DiscoveryDocument)
		expectedErr error
	}{
		{
			name:        "a valid document passes",
			mutate:      func(*oidc.DiscoveryDocument) {},
			expectedErr: nil,
		},
		{
			// An empty issuer is the quiet one: it reaches
			// jwt.WithIssuer(""), which turns off `iss` verification for
			// every id_token the provider validates.
			name:        "empty issuer",
			mutate:      func(d *oidc.DiscoveryDocument) { d.Issuer = "" },
			expectedErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			name:        "empty authorization endpoint",
			mutate:      func(d *oidc.DiscoveryDocument) { d.AuthorizationEndpoint = "" },
			expectedErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			name:        "empty token endpoint",
			mutate:      func(d *oidc.DiscoveryDocument) { d.TokenEndpoint = "" },
			expectedErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			name:        "empty jwks uri",
			mutate:      func(d *oidc.DiscoveryDocument) { d.JWKSURI = "" },
			expectedErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			name:        "wholly empty document",
			mutate:      func(d *oidc.DiscoveryDocument) { *d = oidc.DiscoveryDocument{} },
			expectedErr: oidc.ErrDiscoveryIncomplete,
		},
		{
			// A pinned document is not operator-supplied, so the static path
			// hardcodes allowInsecure=false: there is no local-IdP case to
			// relax for, and plaintext is a credential leak on the
			// authorization endpoint.
			name: "plain http authorization endpoint",
			mutate: func(d *oidc.DiscoveryDocument) {
				d.AuthorizationEndpoint = "http://idp.example.com/authorize"
			},
			expectedErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name:        "plain http issuer",
			mutate:      func(d *oidc.DiscoveryDocument) { d.Issuer = "http://idp.example.com" },
			expectedErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name:        "relative endpoint",
			mutate:      func(d *oidc.DiscoveryDocument) { d.TokenEndpoint = "/token" },
			expectedErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			name:        "unparsable endpoint",
			mutate:      func(d *oidc.DiscoveryDocument) { d.JWKSURI = "https://%zz/jwks" },
			expectedErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
		{
			// userinfo_endpoint is optional in the spec, so an absent one is
			// not a required-field failure here — providers.TestPresetDocuments
			// is what requires it of a shipped preset.
			name:        "absent userinfo endpoint is allowed",
			mutate:      func(d *oidc.DiscoveryDocument) { d.UserinfoEndpoint = "" },
			expectedErr: nil,
		},
		{
			name: "advertised userinfo endpoint is still validated",
			mutate: func(d *oidc.DiscoveryDocument) {
				d.UserinfoEndpoint = "http://idp.example.com/userinfo"
			},
			expectedErr: oidc.ErrDiscoveryInvalidEndpoint,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc := staticDoc()
			tc.mutate(&doc)

			got, err := oidc.NewStaticDiscoverer(doc).Get(t.Context())

			if tc.expectedErr != nil {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("expected %v, got: %v", tc.expectedErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if *got != doc {
				t.Errorf("document changed:\ngot:  %+v\nwant: %+v", *got, doc)
			}
		})
	}
}

// TestNewStaticDiscovererMemoizes pins the memoization the static path
// inherits from lazyMemo, which no other test covers for a build that does no
// I/O: a success is shared rather than rebuilt, and a validation failure —
// which can never succeed on retry — is returned again from the negative cache
// instead of re-running the build.
func TestNewStaticDiscovererMemoizes(t *testing.T) {
	t.Parallel()

	t.Run("a resolved document is shared", func(t *testing.T) {
		t.Parallel()

		disco := oidc.NewStaticDiscoverer(staticDoc())

		first, err := disco.Get(t.Context())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		second, err := disco.Get(t.Context())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if first != second {
			t.Error("expected both Gets to return the same memoized document")
		}
	})

	t.Run("a validation failure stays failed", func(t *testing.T) {
		t.Parallel()

		doc := staticDoc()
		doc.JWKSURI = ""

		disco := oidc.NewStaticDiscoverer(doc)

		if _, err := disco.Get(t.Context()); !errors.Is(err, oidc.ErrDiscoveryIncomplete) {
			t.Fatalf("expected %v, got: %v", oidc.ErrDiscoveryIncomplete, err)
		}

		if _, err := disco.Get(t.Context()); !errors.Is(err, oidc.ErrDiscoveryIncomplete) {
			t.Fatalf("expected the negative cache to return %v, got: %v",
				oidc.ErrDiscoveryIncomplete, err)
		}
	})
}
