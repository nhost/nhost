package clienv //nolint:testpackage // white-box: pre-seed unexported nhclient seam.

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

// httpDoer is a minimal clientv2.HttpClient stub backed by an httptest server.
type httpDoer struct {
	cl *http.Client
}

func (h *httpDoer) Do(req *http.Request) (*http.Response, error) {
	return h.cl.Do(req) //nolint:wrapcheck // test stub
}

func (h *httpDoer) Post(url, contentType string, body io.Reader) (*http.Response, error) {
	return h.cl.Post(url, contentType, body) //nolint:wrapcheck,noctx // test stub
}

func TestResolveProjectLocal(t *testing.T) {
	t.Parallel()

	ce := New(
		io.Discard, io.Discard,
		NewPathStructure("", "", "", ""),
		"", "https://unreachable.invalid/v1", "", "", "", "", "local",
	)

	ep, err := ce.ResolveProject(t.Context(), "local")
	if err != nil {
		t.Fatalf("ResolveProject(local) returned error: %v", err)
	}

	if ep.Subdomain != "local" {
		t.Errorf("Subdomain = %q, want %q", ep.Subdomain, "local")
	}

	if ep.Region != "local" {
		t.Errorf("Region = %q, want %q", ep.Region, "local")
	}

	if ep.App != nil {
		t.Errorf("App = %+v, want nil for local endpoint", ep.App)
	}

	wantGraphql := NhostGraphqlURL("local", "local")
	if ep.GraphqlURL != wantGraphql {
		t.Errorf("GraphqlURL = %q, want %q", ep.GraphqlURL, wantGraphql)
	}

	wantHasura := NhostHasuraURL("local", "local")
	if ep.HasuraURL != wantHasura {
		t.Errorf("HasuraURL = %q, want %q", ep.HasuraURL, wantHasura)
	}

	wantAuth := NhostAuthURL("local", "local")
	if ep.AuthURL != wantAuth {
		t.Errorf("AuthURL = %q, want %q", ep.AuthURL, wantAuth)
	}

	// AdminSecret must short-circuit to DefaultLocalAdminSecret without any
	// network call. The CliEnv has no nhclient seeded and no credentials on
	// disk; if AdminSecret tried to fetch, it would error out.
	secret, err := ep.AdminSecret(t.Context())
	if err != nil {
		t.Fatalf("AdminSecret on local endpoint returned error: %v", err)
	}

	if secret != DefaultLocalAdminSecret {
		t.Errorf("AdminSecret = %q, want %q", secret, DefaultLocalAdminSecret)
	}
}

func TestSetAdminSecretShortCircuits(t *testing.T) {
	t.Parallel()

	ce := New(
		io.Discard, io.Discard,
		NewPathStructure("", "", "", ""),
		"", "https://unreachable.invalid/v1", "", "", "", "", "local",
	)

	ep := newEndpoint(ce, "myapp", "eu-central-1")
	ep.App = &graphql.AppSummaryFragment{
		ID:        "00000000-0000-0000-0000-000000000001",
		Name:      "myapp",
		Subdomain: "myapp",
		Region:    graphql.AppSummaryFragment_Region{Name: "eu-central-1"},
	}

	ep.SetAdminSecret("preseeded-secret")

	// Confirm the lazy fetch is bypassed: GetNhostClient would try LoadSession
	// against an unreachable URL and fail. A successful AdminSecret call here
	// proves SetAdminSecret short-circuited that path.
	secret, err := ep.AdminSecret(t.Context())
	if err != nil {
		t.Fatalf("AdminSecret returned error after SetAdminSecret: %v", err)
	}

	if secret != "preseeded-secret" {
		t.Errorf("AdminSecret = %q, want %q", secret, "preseeded-secret")
	}
}

func TestAdminSecretCloudFetchAndCache(t *testing.T) {
	t.Parallel()

	const (
		appID  = "11111111-1111-1111-1111-111111111111"
		secret = "fetched-admin-secret"
	)

	var calls atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)

		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "GetHasuraAdminSecret") {
			t.Errorf("unexpected operation in request body: %s", body)
		}

		if !strings.Contains(string(body), appID) {
			t.Errorf("appID %q not in request body: %s", appID, body)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(
			w,
			`{"data":{"app":{"config":{"hasura":{"version":"v2.0.0","adminSecret":"`+secret+`"}}}}}`,
		)
	}))
	t.Cleanup(srv.Close)

	ce := New(
		io.Discard, io.Discard,
		NewPathStructure("", "", "", ""),
		"", srv.URL, "", "", "", "", "local",
	)
	// Pre-seed the cached graphql client so AdminSecret does not call
	// LoadSession (which would require auth files on disk).
	ce.nhclient = graphql.NewClient(
		&httpDoer{cl: srv.Client()},
		srv.URL,
		&clientv2.Options{},
	)

	ep := newEndpoint(ce, "cloudapp", "eu-central-1")
	ep.App = &graphql.AppSummaryFragment{
		ID:        appID,
		Name:      "cloudapp",
		Subdomain: "cloudapp",
		Region:    graphql.AppSummaryFragment_Region{Name: "eu-central-1"},
	}

	got, err := ep.AdminSecret(t.Context())
	if err != nil {
		t.Fatalf("AdminSecret returned error: %v", err)
	}

	if got != secret {
		t.Errorf("AdminSecret = %q, want %q", got, secret)
	}

	if n := calls.Load(); n != 1 {
		t.Fatalf("expected 1 HTTP call, got %d", n)
	}

	// Second call must use the cached value, not hit the network again.
	got2, err := ep.AdminSecret(t.Context())
	if err != nil {
		t.Fatalf("AdminSecret (cached) returned error: %v", err)
	}

	if got2 != secret {
		t.Errorf("cached AdminSecret = %q, want %q", got2, secret)
	}

	if n := calls.Load(); n != 1 {
		t.Errorf("expected cache to suppress second call, got %d total calls", n)
	}
}
