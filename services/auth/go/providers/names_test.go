package providers_test

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
)

// Provider IDs are hardcoded in names.go, in the api.IdTokenProvider*
// constants, and in the provider patterns in docs/openapi.yaml. Routing only
// works while all three agree, and drift still compiles — the tests below
// make it fail instead.

// builtinIDs lists every constant from names.go.
func builtinIDs() []string {
	return []string{
		providers.AppleID,
		providers.AzureadID,
		providers.BitbucketID,
		providers.DiscordID,
		providers.EntraidID,
		providers.FacebookID,
		providers.GithubID,
		providers.GitlabID,
		providers.GoogleID,
		providers.LinkedinID,
		providers.SpotifyID,
		providers.StravaID,
		providers.TwitchID,
		providers.TwitterID,
		providers.WindowsliveID,
		providers.WorkosID,
	}
}

func TestBuiltinIDsMatchAPIIDTokenConstants(t *testing.T) {
	t.Parallel()

	if providers.AppleID != api.IdTokenProviderApple {
		t.Errorf(
			"providers.AppleID (%q) drifted from api.IdTokenProviderApple (%q)",
			providers.AppleID, api.IdTokenProviderApple,
		)
	}

	if providers.GoogleID != api.IdTokenProviderGoogle {
		t.Errorf(
			"providers.GoogleID (%q) drifted from api.IdTokenProviderGoogle (%q)",
			providers.GoogleID, api.IdTokenProviderGoogle,
		)
	}
}

func loadSpec(t *testing.T) *openapi3.T {
	t.Helper()

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatalf("loading embedded OpenAPI spec: %v", err)
	}

	return spec
}

func signInProviderPattern(t *testing.T, spec *openapi3.T) string {
	t.Helper()

	param := spec.Components.Parameters["SignInProvider"]
	if param == nil || param.Value == nil || param.Value.Schema == nil ||
		param.Value.Schema.Value == nil {
		t.Fatal("SignInProvider parameter schema not found in the OpenAPI spec")
	}

	return param.Value.Schema.Value.Pattern
}

func idTokenProviderPattern(t *testing.T, spec *openapi3.T) string {
	t.Helper()

	schema := spec.Components.Schemas["IdTokenProvider"]
	if schema == nil || schema.Value == nil {
		t.Fatal("IdTokenProvider schema not found in the OpenAPI spec")
	}

	return schema.Value.Pattern
}

// splitAlternatives splits a `^(a|b|c:...)$` pattern into its fixed
// alternatives and its single custom (c:) alternative. The two provider
// patterns in openapi.yaml intentionally have this exact shape; if the shape
// changes, update this helper alongside.
func splitAlternatives(t *testing.T, pattern string) ([]string, string) {
	t.Helper()

	inner, hasPrefix := strings.CutPrefix(pattern, "^(")

	inner, hasSuffix := strings.CutSuffix(inner, ")$")
	if !hasPrefix || !hasSuffix {
		t.Fatalf("provider pattern %q does not have the expected ^(...)$ shape", pattern)
	}

	var fixed []string

	var custom string

	for alternative := range strings.SplitSeq(inner, "|") {
		if !strings.HasPrefix(alternative, providers.CustomProviderPrefix) {
			fixed = append(fixed, alternative)
			continue
		}

		if custom != "" {
			t.Fatalf("provider pattern %q has more than one custom (c:) alternative", pattern)
		}

		custom = alternative
	}

	if custom == "" {
		t.Fatalf("provider pattern %q has no custom (c:) alternative", pattern)
	}

	return fixed, custom
}

func TestSignInProviderPatternMatchesBuiltinIDs(t *testing.T) {
	t.Parallel()

	got, _ := splitAlternatives(t, signInProviderPattern(t, loadSpec(t)))
	slices.Sort(got)

	want := builtinIDs()
	slices.Sort(want)

	if !slices.Equal(got, want) {
		t.Errorf(
			"SignInProvider pattern alternatives drifted from providers/names.go:\n got %v\nwant %v",
			got,
			want,
		)
	}
}

func TestIDTokenProviderPatternMatchesAPIConstants(t *testing.T) {
	t.Parallel()

	got, _ := splitAlternatives(t, idTokenProviderPattern(t, loadSpec(t)))
	slices.Sort(got)

	// api.IdTokenProviderFake is deliberately absent: it is only used by unit
	// tests that bypass HTTP validation and must not be reachable over HTTP.
	want := []string{api.IdTokenProviderApple, api.IdTokenProviderGoogle}
	slices.Sort(want)

	if !slices.Equal(got, want) {
		t.Errorf(
			"IdTokenProvider pattern alternatives drifted from the api.IdTokenProvider* constants:\n got %v\nwant %v",
			got,
			want,
		)
	}
}

func TestProviderPatternsShareCustomAlternative(t *testing.T) {
	t.Parallel()

	spec := loadSpec(t)

	_, signInCustom := splitAlternatives(t, signInProviderPattern(t, spec))

	_, idTokenCustom := splitAlternatives(t, idTokenProviderPattern(t, spec))
	if signInCustom != idTokenCustom {
		t.Errorf(
			"custom provider sub-pattern differs between SignInProvider (%q) and IdTokenProvider (%q)",
			signInCustom,
			idTokenCustom,
		)
	}
}

// decodeAcceptsSlug reports whether DecodeDefinitions accepts slug, using a
// minimal oauth2 definition so slug validity is the only variable.
func decodeAcceptsSlug(t *testing.T, slug string) bool {
	t.Helper()

	raw := fmt.Sprintf(`{%q: {
		"type": "oauth2",
		"clientId": "client-id",
		"clientSecret": "client-secret",
		"authorizationUrl": "https://idp.example.com/authorize",
		"tokenUrl": "https://idp.example.com/token",
		"userinfoUrl": "https://idp.example.com/userinfo"
	}}`, slug)

	definitions, invalid, err := providers.DecodeDefinitions([]byte(raw), testServerURL, false)
	if err != nil {
		t.Fatalf("unexpected envelope error: %v", err)
	}

	if len(definitions) == 1 {
		return true
	}

	if !errors.Is(invalid[slug], providers.ErrInvalidSlug) {
		t.Fatalf("slug %q was rejected for an unexpected reason: %v", slug, invalid[slug])
	}

	return false
}

// TestCustomSlugRulesMatchOpenAPIPattern ties slugRE (via DecodeDefinitions)
// to the c:<slug> sub-pattern the HTTP layer enforces from openapi.yaml: a
// slug the engine accepts must be routable, and a slug the pattern admits
// must not be rejected by the engine.
func TestCustomSlugRulesMatchOpenAPIPattern(t *testing.T) {
	t.Parallel()

	signInRE, err := regexp.Compile(signInProviderPattern(t, loadSpec(t)))
	if err != nil {
		t.Fatalf("compiling SignInProvider pattern: %v", err)
	}

	cases := []struct {
		name  string
		slug  string
		valid bool
	}{
		{name: "simple", slug: "okta", valid: true},
		{name: "hyphenated", slug: "my-idp", valid: true},
		{name: "minimum length", slug: "a1", valid: true},
		{name: "maximum length", slug: strings.Repeat("a", 40), valid: true},
		{name: "too short", slug: "x", valid: false},
		{name: "too long", slug: strings.Repeat("a", 41), valid: false},
		{name: "leading hyphen", slug: "-bad", valid: false},
		{name: "trailing hyphen", slug: "bad-", valid: false},
		{name: "uppercase", slug: "Bad", valid: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			patternAccepts := signInRE.MatchString(providers.CustomProviderPrefix + tc.slug)
			if patternAccepts != tc.valid {
				t.Errorf(
					"SignInProvider pattern accepts %q = %t, want %t",
					tc.slug, patternAccepts, tc.valid,
				)
			}

			decoderAccepts := decodeAcceptsSlug(t, tc.slug)
			if decoderAccepts != tc.valid {
				t.Errorf(
					"DecodeDefinitions accepts %q = %t, want %t",
					tc.slug, decoderAccepts, tc.valid,
				)
			}
		})
	}
}
