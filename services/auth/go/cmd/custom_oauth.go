package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/urfave/cli/v3"
)

// customProvidersUsage is the operator-facing reference for
// AUTH_PROVIDER_CUSTOM. It is the flag's Usage string, so `auth docs` renders
// it: the JSON schema exists nowhere else an operator can reach, and an
// unknown field silently skips the entry rather than failing startup.
const customProvidersUsage = `Custom OAuth2/OIDC providers, as a JSON object keyed by slug. ` +
	`Each provider is addressable as c:<slug> (e.g. /signin/provider/c:okta) and must be ` +
	`registered with the IdP under the redirect URI <AUTH_SERVER_URL>/signin/provider/c:<slug>/callback. ` +
	`Slugs match ^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$ (2-40 chars, lowercase, no underscores). ` +
	`Each entry needs "type": "oidc" or "oauth2". ` +
	`oidc: clientId, clientSecret, issuer required; optional discoveryUrl (defaults to ` +
	`<issuer>/.well-known/openid-configuration), scopes (defaults to openid email profile; ` +
	`openid is always added), audiences (extra id_token audiences accepted on ` +
	`POST /signin/idtoken only, never on the browser callback). ` +
	`oauth2: clientId, clientSecret, authorizationUrl, tokenUrl, userinfoUrl required; ` +
	`optional scopes and claims (a flat rename of the userinfo fields, with keys ` +
	`id, email, emailVerified, name, picture defaulting to the OIDC-standard names). ` +
	`Entries with unknown fields, an invalid slug, or a missing required field are skipped ` +
	`with a warning; a malformed envelope fails startup. An empty or whitespace-only value ` +
	`disables custom providers. ` +
	`Account linking: a custom provider never auto-links into a pre-existing account by ` +
	`email, not even a verified one, because an operator-configured IdP can assert any ` +
	`address. Existing users therefore have to authenticate by another means once and call ` +
	`/link/idtoken (or the connect flow) to attach the identity; until they do, a sign-in ` +
	`through the custom provider returns user-already-exists. ` +
	`A slug must never be re-pointed at a different IdP - identities recorded under it would ` +
	`be inherited by the new one. Moving to a new slug is the safe option, but by the rule ` +
	`above it starts every existing user from zero, so plan the re-link. ` +
	`Contains client secrets - store as a secret.`

var (
	errCustomProviderIssuerConflict = errors.New(
		"custom provider issuer conflicts with recorded identities",
	)
	errCustomProvidersRequireRedirectTarget = errors.New(
		"custom providers require AUTH_CLIENT_URL or " +
			"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS to be set: with neither, " +
			"no redirect target can be allowlisted and every browser flow 400s",
	)
	errCustomProvidersRequireServerURL = errors.New(
		"custom providers require AUTH_SERVER_URL to be set: the redirect URI " +
			"registered with the IdP is derived from it, and without it the " +
			"redirect_uri sent to the IdP is a relative path every IdP rejects",
	)
)

// customProvidersDB is the narrow slice of the database the custom-provider
// startup wiring needs — an interface so the fail-closed startup guards are
// testable without a live database.
//
// No mockgen directive on purpose, unlike the exported boundaries in oauth2
// and controller. This interface and all four of its consumers below are
// unexported, so a black-box cmd_test can never call them, and the white-box
// tests that can are the ones required to inline-stub rather than import a
// generated mock package. A mock/ subdir here would have no possible
// importer; stubCustomProvidersDB in custom_oauth_internal_test.go is the
// fake.
type customProvidersDB interface {
	GetUserProviderConflictingIssuer(
		ctx context.Context, arg sql.GetUserProviderConflictingIssuerParams,
	) (pgtype.Text, error)
	GetUserProviderRecordedIssuer(ctx context.Context, providerID string) (pgtype.Text, error)
	UpsertProviders(ctx context.Context, ids []string) ([]string, error)
}

// customProvidersResult is the decoded custom provider registry, keyed by
// provider ID ("c:<slug>") throughout.
type customProvidersResult struct {
	providers providers.Map
	// validators holds the id_token validators of OIDC-type customs for the
	// native /signin/idtoken flow.
	validators map[string]*oidc.LazyIDTokenValidator
	// issuers holds the configured issuer of OIDC-type customs for
	// issuer-bound account linking.
	issuers map[string]string
}

func newCustomProvidersResult(size int) *customProvidersResult {
	return &customProvidersResult{
		providers:  make(providers.Map, size),
		validators: make(map[string]*oidc.LazyIDTokenValidator),
		issuers:    make(map[string]string),
	}
}

func logInvalidDefinitions(
	ctx context.Context, invalid map[string]error, logger *slog.Logger,
) {
	for _, slug := range slices.Sorted(maps.Keys(invalid)) {
		logger.WarnContext(
			ctx, "skipping invalid custom provider",
			slog.String("slug", slug),
			slog.String("error", invalid[slug].Error()),
		)
	}
}

// decodeCustomProviders decodes AUTH_PROVIDER_CUSTOM once for the whole
// startup sequence — the migration phase (which upserts the auth.providers
// rows the c:<slug> foreign keys need) and the controller phase (which
// registers the runtime providers) must agree on what "the configured
// providers" are. A malformed envelope fails startup: silently running with
// zero custom providers would mask an outage. Individually malformed entries
// are logged here, exactly once (slug + error class, never the raw JSON),
// and skipped.
func decodeCustomProviders(
	ctx context.Context, cmd *cli.Command, logger *slog.Logger,
) (map[string]providers.Definition, error) {
	// TrimSpace, not a bare == "": a whitespace-only value is a variable the
	// operator left blank (a YAML block scalar or Helm "|" value contributes a
	// trailing newline on its own), and failing startup on it buys nothing —
	// there is no configuration to lose. Same normalisation the redirect-target
	// guard below applies to AUTH_CLIENT_URL.
	raw := cmd.String(flagCustomProviders)
	if strings.TrimSpace(raw) == "" {
		return nil, nil //nolint:nilnil // no configuration is not a failure
	}

	definitions, invalid, err := providers.DecodeDefinitions(
		[]byte(raw),
		cmd.String(flagServerURL),
		cmd.Bool(flagCustomProviderAllowPrivateIPs),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid AUTH_PROVIDER_CUSTOM: %w", err)
	}

	logInvalidDefinitions(ctx, invalid, logger)

	return definitions, nil
}

// getCustomOauth2Providers builds the custom provider registry from the
// definitions decoded by decodeCustomProviders. With none configured the
// result is empty — no custom code path is reachable at runtime.
func getCustomOauth2Providers(
	appCtx context.Context,
	cmd *cli.Command,
	definitions map[string]providers.Definition,
	db customProvidersDB,
	logger *slog.Logger,
) (*customProvidersResult, error) {
	if len(definitions) == 0 {
		return newCustomProvidersResult(0), nil
	}

	// The two relaxations are the same operator decision here: a dev IdP on a
	// private address is also the one serving a self-signed certificate.
	allowInsecure := cmd.Bool(flagCustomProviderAllowPrivateIPs)

	hardenedClient := safehttp.New(safehttp.Config{
		Timeout:               0, // safehttp.DefaultTimeout
		MaxRedirects:          0, // safehttp.DefaultMaxRedirects
		MaxResponseSize:       0, // safehttp.DefaultMaxResponseSize
		AllowPrivateIPs:       allowInsecure,
		InsecureSkipTLSVerify: allowInsecure,
	})

	result := newCustomProvidersResult(len(definitions))

	for _, slug := range slices.Sorted(maps.Keys(definitions)) {
		def := definitions[slug]

		if err := checkIssuerConflict(appCtx, db, def); err != nil {
			return nil, err
		}

		provider, validator, err := def.Build(appCtx, hardenedClient)
		if err != nil {
			logger.WarnContext(
				appCtx, "skipping custom provider that failed to build",
				slog.String("provider", def.ID()),
				slog.String("error", err.Error()),
			)

			continue
		}

		result.providers[def.ID()] = provider
		if validator != nil {
			result.validators[def.ID()] = validator
		}

		if issuer := def.Issuer(); issuer != "" {
			result.issuers[def.ID()] = issuer
		}

		logger.InfoContext(
			appCtx, "registered custom oauth provider",
			slog.String("provider", def.ID()),
			slog.String("type", providerTypeOf(def)),
			slog.String("issuer", def.Issuer()),
		)
	}

	return result, nil
}

func providerTypeOf(def providers.Definition) string {
	if def.Issuer() != "" {
		return "oidc"
	}

	return "oauth2"
}

// checkIssuerConflict fails startup when a slug has recorded identities that
// were not established under the IdP it is configured with now. For an
// OIDC-type custom that means rows recorded under a different issuer (the slug
// was re-pointed at another IdP) or with no issuer at all (the slug predates
// issuer tracking, e.g. it was an oauth2-type custom before); for an
// oauth2-type custom, which records no issuer, it means rows that carry one
// (the slug used to be OIDC-type). Neither may be silently inherited.
func checkIssuerConflict(
	ctx context.Context, db customProvidersDB, def providers.Definition,
) error {
	issuer := def.Issuer()
	if issuer == "" {
		return checkNoRecordedIssuer(ctx, db, def)
	}

	conflicting, err := db.GetUserProviderConflictingIssuer(
		ctx, sql.GetUserProviderConflictingIssuerParams{
			ProviderID: def.ID(),
			Issuer:     sql.Text(issuer),
		},
	)

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return nil
	case err != nil:
		return fmt.Errorf("checking issuer conflicts for %s: %w", def.ID(), err)
	case !conflicting.Valid:
		return fmt.Errorf(
			"%w: provider %s is configured with issuer %q but has identities "+
				"recorded without an issuer; after verifying the IdP is unchanged, "+
				"backfill auth.user_providers.issuer for this provider",
			errCustomProviderIssuerConflict, def.ID(), issuer,
		)
	default:
		return fmt.Errorf(
			"%w: provider %s is configured with issuer %q but existing identities "+
				"were recorded under %q; keep the slug on that issuer, move the new "+
				"configuration to a different slug and re-link the existing users "+
				"(a custom provider never auto-links by email — see "+
				"AUTH_PROVIDER_CUSTOM), or — only if this is the same IdP under a "+
				"renamed issuer — update auth.user_providers.issuer for this provider",
			errCustomProviderIssuerConflict, def.ID(), issuer, conflicting.String,
		)
	}
}

// checkNoRecordedIssuer is the checkIssuerConflict half for slugs configured
// without an issuer. Nothing on the request path can catch a re-point here:
// an oauth2-type custom has no configured issuer, so checkCustomProviderIssuer
// has nothing to compare a recorded one against and every existing identity
// would be matched on the bare provider_user_id whatever IdP now answers.
//
// Known and accepted limitation: this catches only the oidc-type -> oauth2-type
// transition, because that is the one that leaves an issuer recorded.
// Re-pointing an oauth2-type slug at a *different* oauth2 IdP is invisible to
// both this probe and the request path — issuer-less customs persist nothing
// IdP-identifying, and provider_user_id namespaces are per-IdP, so a
// collision is plausible rather than theoretical. An operator must never
// re-point an oauth2-type slug; use a new slug instead. Closing this would
// mean persisting an IdP key (e.g. the token endpoint's origin) for
// issuer-less customs, which is a schema change and deliberately out of
// scope here.
func checkNoRecordedIssuer(
	ctx context.Context, db customProvidersDB, def providers.Definition,
) error {
	recorded, err := db.GetUserProviderRecordedIssuer(ctx, def.ID())

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return nil
	case err != nil:
		return fmt.Errorf("checking recorded issuers for %s: %w", def.ID(), err)
	default:
		return fmt.Errorf(
			"%w: provider %s is configured without an issuer but has identities "+
				"recorded under %q; keep the slug on that issuer, move the new "+
				"configuration to a different slug and re-link the existing users "+
				"(a custom provider never auto-links by email — see "+
				"AUTH_PROVIDER_CUSTOM), or — after verifying the IdP is unchanged "+
				"— clear auth.user_providers.issuer for this provider",
			errCustomProviderIssuerConflict, def.ID(), recorded.String,
		)
	}
}

// validateCustomProvidersConfig fail-fasts on the two deployment shapes in
// which a custom provider's browser flow cannot work at all.
//
// The first is having no allowlistable redirect target. An empty client URL
// compiles to the "/**" glob in ValidateRedirectTo, which rejects absolute
// targets — and used to accept protocol-relative ones such as
// "//evil.example.com/x" (closed for all providers in
// controller.ValidateRedirectTo, not just customs). An empty client URL is
// fine on its own: NewWorkflows also compiles every
// AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS entry, and a caller that passes an
// allowlisted redirectTo explicitly still matches. Only both being empty
// leaves nothing to redirect to.
//
// The second is an unset AUTH_SERVER_URL, which is unconditionally fatal:
// decodeDefinition derives the redirect_uri registered with the IdP from it,
// so with it empty the IdP is handed the relative path
// "/signin/provider/c:<slug>/callback".
func validateCustomProvidersConfig(cmd *cli.Command, custom *customProvidersResult) error {
	if len(custom.providers) == 0 {
		return nil
	}

	if strings.TrimSpace(cmd.String(flagServerURL)) == "" {
		return errCustomProvidersRequireServerURL
	}

	if strings.TrimSpace(cmd.String(flagClientURL)) == "" &&
		!hasNonEmptyEntry(cmd.StringSlice(flagAllowRedirectURLs)) {
		return errCustomProvidersRequireRedirectTarget
	}

	return nil
}

// hasNonEmptyEntry mirrors the blank-entry filtering getConfig applies to
// AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS, so a variable holding only
// separators does not read as a configured allowlist here.
func hasNonEmptyEntry(values []string) bool {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return true
		}
	}

	return false
}

// insertProviders upserts the auth.providers rows the c:<slug> foreign keys
// need. Rows are never deleted on provider removal — historical
// auth.user_providers rows must keep their anchor.
func insertProviders(
	ctx context.Context,
	definitions map[string]providers.Definition,
	db customProvidersDB,
	logger *slog.Logger,
) error {
	if len(definitions) == 0 {
		return nil
	}

	ids := make([]string, 0, len(definitions))
	for _, slug := range slices.Sorted(maps.Keys(definitions)) {
		ids = append(ids, definitions[slug].ID())
	}

	inserted, err := db.UpsertProviders(ctx, ids)
	if err != nil {
		logger.ErrorContext(
			ctx, "failed to upsert providers", slog.String("error", err.Error()),
		)

		return fmt.Errorf("failed to upsert providers: %w", err)
	}

	if len(inserted) > 0 {
		logger.InfoContext(
			ctx, "inserted providers",
			slog.Int("affected_rows", len(inserted)),
			slog.String("providers", strings.Join(inserted, ", ")),
		)
	}

	return nil
}
