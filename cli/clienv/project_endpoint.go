package clienv

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

// ErrEndpointHasNoApp is returned by [ProjectEndpoint.AdminSecret] when the
// endpoint has no cached secret and no associated cloud app to fetch one from
// (i.e. a local endpoint whose pre-seeded [DefaultLocalAdminSecret] was
// cleared via [ProjectEndpoint.SetAdminSecret]).
var ErrEndpointHasNoApp = errors.New(
	"cannot fetch admin secret: endpoint has no associated cloud app",
)

// DefaultLocalAdminSecret is the Hasura admin secret used by the local dev
// stack started with `nhost dev`. It matches the value baked into the local
// docker-compose setup.
const DefaultLocalAdminSecret = "nhost-admin-secret" //nolint:gosec // local dev default, not a real credential

// ProjectEndpoint is a resolved Nhost project (the local dev stack or a cloud
// project) with everything needed to talk to its services: subdomain/region,
// per-service URLs, and an admin secret. Build one with [CliEnv.ResolveProject].
//
// Not safe for concurrent use: [ProjectEndpoint.AdminSecret] caches the
// fetched secret without synchronisation.
type ProjectEndpoint struct {
	// App is the underlying linked or looked-up cloud app summary. nil when
	// the endpoint points at the local dev stack.
	App *graphql.AppSummaryFragment

	Subdomain string
	Region    string

	GraphqlURL string
	HasuraURL  string
	AuthURL    string

	ce          *CliEnv
	adminSecret string
}

// ResolveProject resolves a subdomain to a [ProjectEndpoint]:
//
//   - subdomain == [CliEnv.LocalSubdomain] (default "local") → local dev stack
//   - subdomain == ""                                       → linked project
//     (interactively links if no project file exists)
//   - subdomain == anything else                            → that cloud project
//
// The local case never hits the network. The other two go through
// [CliEnv.GetAppInfo].
func (ce *CliEnv) ResolveProject(
	ctx context.Context, subdomain string,
) (*ProjectEndpoint, error) {
	if subdomain == ce.LocalSubdomain() {
		ep := newEndpoint(ce, subdomain, subdomain)
		ep.adminSecret = DefaultLocalAdminSecret

		return ep, nil
	}

	proj, err := ce.GetAppInfo(ctx, subdomain)
	if err != nil {
		return nil, fmt.Errorf("failed to get app info: %w", err)
	}

	ep := newEndpoint(ce, proj.Subdomain, proj.Region.Name)
	ep.App = proj

	return ep, nil
}

func newEndpoint(ce *CliEnv, subdomain, region string) *ProjectEndpoint {
	return &ProjectEndpoint{
		App:         nil,
		Subdomain:   subdomain,
		Region:      region,
		GraphqlURL:  NhostGraphqlURL(subdomain, region),
		HasuraURL:   NhostHasuraURL(subdomain, region),
		AuthURL:     NhostAuthURL(subdomain, region),
		ce:          ce,
		adminSecret: "",
	}
}

// AdminSecret returns the Hasura admin secret for this project. For the local
// stack it's [DefaultLocalAdminSecret] (pre-seeded by [CliEnv.ResolveProject]).
// For a cloud project it is fetched lazily via the Nhost API on first call
// and cached on the endpoint.
//
// Precondition: either a secret has been cached (locally pre-seeded or set
// via [ProjectEndpoint.SetAdminSecret]) or [ProjectEndpoint.App] is non-nil.
// If neither holds, [ErrEndpointHasNoApp] is returned rather than panicking.
func (p *ProjectEndpoint) AdminSecret(ctx context.Context) (string, error) {
	if p.adminSecret != "" {
		return p.adminSecret, nil
	}

	if p.App == nil {
		return "", ErrEndpointHasNoApp
	}

	cl, err := p.ce.GetNhostClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get nhost client: %w", err)
	}

	resp, err := cl.GetHasuraAdminSecret(ctx, p.App.ID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch hasura admin secret: %w", err)
	}

	p.adminSecret = resp.App.Config.Hasura.AdminSecret

	return p.adminSecret, nil
}

// SetAdminSecret pre-seeds the admin secret, bypassing the lazy fetch in
// [ProjectEndpoint.AdminSecret]. Use when the caller has the secret already
// (e.g. from a flag or env var).
func (p *ProjectEndpoint) SetAdminSecret(adminSecret string) {
	p.adminSecret = adminSecret
}
