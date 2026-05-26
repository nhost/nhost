package schema

import (
	"io"
	"reflect"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

// newLocalCliEnv returns a CliEnv wired with an unreachable graphql URL and
// "local" as the local subdomain, so that ResolveProject("local") never hits
// the network. Used by resolveURLAndSecret tests.
func newLocalCliEnv() *clienv.CliEnv {
	return clienv.New(
		io.Discard, io.Discard,
		clienv.NewPathStructure("", "", "", ""),
		"", "https://unreachable.invalid/v1", "", "", "", "", "local",
	)
}

func TestResolveURLAndSecret(t *testing.T) {
	tests := []struct {
		name            string
		subdomain       string
		url             string
		adminSecret     string
		explicitSecret  bool
		envAdminSecret  string // set via t.Setenv when non-empty marker "" handled below
		setEnv          bool   // whether to call t.Setenv at all
		wantURL         string
		wantAdminSecret string
	}{
		{
			// --url + --admin-secret → both returned verbatim, no env consulted.
			name:            "explicit url and explicit admin secret",
			subdomain:       "",
			url:             "https://third-party.example/v1/graphql",
			adminSecret:     "user-supplied",
			explicitSecret:  true,
			setEnv:          false,
			wantURL:         "https://third-party.example/v1/graphql",
			wantAdminSecret: "user-supplied",
		},
		{
			// Leak guard: NHOST_ADMIN_SECRET MUST NOT flow into a --url request.
			// adminSecret is "" (flag not passed). The function must return ""
			// and never consult the env var.
			name:            "explicit url with env admin secret does not leak",
			subdomain:       "",
			url:             "https://third-party.example/v1/graphql",
			adminSecret:     "",
			explicitSecret:  false,
			envAdminSecret:  "leaked-via-env",
			setEnv:          true,
			wantURL:         "https://third-party.example/v1/graphql",
			wantAdminSecret: "",
		},
		{
			// Explicit empty --admin-secret short-circuits BOTH the env-var
			// fallback and the lazy AdminSecret fetch. For --subdomain local
			// this is the line that prevents nil-deref on ep.App when the
			// caller deliberately wants no secret.
			name:            "explicit empty admin secret bypasses env and lazy fetch",
			subdomain:       "local",
			url:             "",
			adminSecret:     "",
			explicitSecret:  true,
			envAdminSecret:  "should-be-ignored",
			setEnv:          true,
			wantURL:         clienv.NhostGraphqlURL("local", "local"),
			wantAdminSecret: "",
		},
		{
			// Without --url and without --admin-secret, NHOST_ADMIN_SECRET is a
			// safe override against a resolved project. For --subdomain local
			// the env var must beat DefaultLocalAdminSecret.
			name:            "env admin secret seeds resolved local endpoint",
			subdomain:       "local",
			url:             "",
			adminSecret:     "",
			explicitSecret:  false,
			envAdminSecret:  "env-override",
			setEnv:          true,
			wantURL:         clienv.NhostGraphqlURL("local", "local"),
			wantAdminSecret: "env-override",
		},
		{
			// No --url, no --admin-secret, no env: --subdomain local falls back
			// to the pre-seeded DefaultLocalAdminSecret. Locks in that the
			// local path never tries to hit the cloud API.
			name:            "local subdomain with no overrides uses default local secret",
			subdomain:       "local",
			url:             "",
			adminSecret:     "",
			explicitSecret:  false,
			setEnv:          false,
			wantURL:         clienv.NhostGraphqlURL("local", "local"),
			wantAdminSecret: clienv.DefaultLocalAdminSecret,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// NOT t.Parallel: t.Setenv forbids parallel subtests.
			if tt.setEnv {
				t.Setenv("NHOST_ADMIN_SECRET", tt.envAdminSecret)
			} else {
				// Make sure a stray env var in the developer's shell does not
				// contaminate the "no env" cases.
				t.Setenv("NHOST_ADMIN_SECRET", "")
			}

			ce := newLocalCliEnv()

			gotURL, gotSecret, err := resolveURLAndSecret(
				t.Context(),
				ce,
				tt.subdomain,
				tt.url,
				tt.adminSecret,
				tt.explicitSecret,
			)
			if err != nil {
				t.Fatalf("resolveURLAndSecret returned error: %v", err)
			}

			if gotURL != tt.wantURL {
				t.Errorf("url = %q, want %q", gotURL, tt.wantURL)
			}

			if gotSecret != tt.wantAdminSecret {
				t.Errorf("adminSecret = %q, want %q", gotSecret, tt.wantAdminSecret)
			}
		})
	}
}

func TestBuildHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		extra       []string
		role        string
		adminSecret string
		want        []string
	}{
		{
			name:        "empty role, empty secret, no extras",
			extra:       nil,
			role:        "",
			adminSecret: "",
			want:        []string{},
		},
		{
			name:        "role only",
			extra:       nil,
			role:        "user",
			adminSecret: "",
			want:        []string{"X-Hasura-Role: user"},
		},
		{
			name:        "secret only",
			extra:       nil,
			role:        "",
			adminSecret: "s3cret",
			want:        []string{"X-Hasura-Admin-Secret: s3cret"},
		},
		{
			name:        "role plus secret",
			extra:       nil,
			role:        "user",
			adminSecret: "s3cret",
			want: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Admin-Secret: s3cret",
			},
		},
		{
			// Documented invariant: explicit -H entries come last so the user's
			// override wins on duplicate keys when parseHeaders folds the list
			// into a map.
			name:        "extras appended last so they override derived defaults",
			extra:       []string{"X-Hasura-Role: admin"},
			role:        "user",
			adminSecret: "s3cret",
			want: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Admin-Secret: s3cret",
				"X-Hasura-Role: admin",
			},
		},
		{
			name:        "extras only, no role, no secret",
			extra:       []string{"X-Custom: value", "X-Other: thing"},
			role:        "",
			adminSecret: "",
			want:        []string{"X-Custom: value", "X-Other: thing"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := buildHeaders(tt.extra, tt.role, tt.adminSecret)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("buildHeaders() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestBuildHeadersDuplicateKeysLastWins asserts the end-to-end invariant:
// buildHeaders puts user-supplied -H entries last and parseHeaders folds
// duplicates into a map by overwriting, so the last entry for a given key
// wins. If this ever flips to first-wins the buildHeaders contract is broken.
func TestBuildHeadersDuplicateKeysLastWins(t *testing.T) {
	t.Parallel()

	raw := buildHeaders(
		[]string{"X-Hasura-Role: admin"},
		"user",
		"s3cret",
	)

	headers, err := parseHeaders(raw)
	if err != nil {
		t.Fatalf("parseHeaders returned error: %v", err)
	}

	if got, want := headers["X-Hasura-Role"], "admin"; got != want {
		t.Errorf("X-Hasura-Role = %q, want %q (extras must override derived defaults)", got, want)
	}
}

func TestParseHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		raw     []string
		want    map[string]string
		wantErr bool
	}{
		{
			name:    "empty input",
			raw:     nil,
			want:    map[string]string{},
			wantErr: false,
		},
		{
			name: "single header",
			raw:  []string{"X-Foo: bar"},
			want: map[string]string{"X-Foo": "bar"},
		},
		{
			name: "multiple headers",
			raw: []string{
				"X-Foo: bar",
				"X-Hasura-Role: admin",
			},
			want: map[string]string{
				"X-Foo":         "bar",
				"X-Hasura-Role": "admin",
			},
		},
		{
			name: "whitespace trimming around name and value",
			raw:  []string{"  X-Foo  :   bar   "},
			want: map[string]string{"X-Foo": "bar"},
		},
		{
			name: "empty value is permitted",
			raw:  []string{"X-Foo:"},
			want: map[string]string{"X-Foo": ""},
		},
		{
			// parseHeaders folds duplicates into a map, so the last occurrence
			// wins. This pairs with buildHeaders' "extras last" ordering.
			name: "duplicate header keys: last wins",
			raw: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Role: admin",
			},
			want: map[string]string{"X-Hasura-Role": "admin"},
		},
		{
			name:    "missing colon",
			raw:     []string{"X-Foo bar"},
			wantErr: true,
		},
		{
			name:    "empty name",
			raw:     []string{": bar"},
			wantErr: true,
		},
		{
			name:    "whitespace-only name",
			raw:     []string{"   : bar"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseHeaders(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseHeaders() err = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantErr {
				return
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("parseHeaders() = %v, want %v", got, tt.want)
			}
		})
	}
}
