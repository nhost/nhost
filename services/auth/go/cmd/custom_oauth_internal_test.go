package cmd

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/urfave/cli/v3"
)

var errDBDown = errors.New("database down")

// stubCustomProvidersDB is an inline stub for the customProvidersDB boundary;
// see that interface's doc for why there is no generated mock.
type stubCustomProvidersDB struct {
	conflictingIssuer pgtype.Text
	conflictErr       error
	recordedIssuer    pgtype.Text
	recordedErr       error
	upserted          [][]string
}

func (s *stubCustomProvidersDB) GetUserProviderConflictingIssuer(
	_ context.Context, _ sql.GetUserProviderConflictingIssuerParams,
) (pgtype.Text, error) {
	return s.conflictingIssuer, s.conflictErr
}

func (s *stubCustomProvidersDB) GetUserProviderRecordedIssuer(
	_ context.Context, _ string,
) (pgtype.Text, error) {
	return s.recordedIssuer, s.recordedErr
}

func (s *stubCustomProvidersDB) UpsertProviders(
	_ context.Context, ids []string,
) ([]string, error) {
	s.upserted = append(s.upserted, ids)
	return ids, nil
}

func noConflictDB() *stubCustomProvidersDB {
	return &stubCustomProvidersDB{
		conflictingIssuer: pgtype.Text{},
		conflictErr:       pgx.ErrNoRows,
		recordedIssuer:    pgtype.Text{},
		recordedErr:       pgx.ErrNoRows,
		upserted:          nil,
	}
}

// testCLICommand parses flags exactly as serve does, so the functions under
// test read them through the same *cli.Command surface.
func testCLICommand(t *testing.T, flags map[string]string) *cli.Command {
	t.Helper()

	var captured *cli.Command

	cmd := &cli.Command{
		Name: "test",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: flagCustomProviders},
			&cli.StringFlag{Name: flagServerURL},
			&cli.StringFlag{Name: flagClientURL},
			&cli.StringSliceFlag{Name: flagAllowRedirectURLs},
			&cli.BoolFlag{Name: flagCustomProviderAllowPrivateIPs},
		},
		Action: func(_ context.Context, c *cli.Command) error {
			captured = c
			return nil
		},
	}

	args := []string{"test"}
	for _, name := range slices.Sorted(maps.Keys(flags)) {
		// An empty value means "unset": cli rejects `--flag=` and an unset
		// string flag reads as "" anyway.
		if flags[name] == "" {
			continue
		}

		args = append(args, "--"+name, flags[name])
	}

	if err := cmd.Run(t.Context(), args); err != nil {
		t.Fatalf("failed to parse test flags: %v", err)
	}

	return captured
}

func fixtureJSON(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("testdata", "custom_providers.json"))
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	return string(raw)
}

func fixtureDefinitions(t *testing.T) map[string]providers.Definition {
	t.Helper()

	definitions, invalid, err := providers.DecodeDefinitions(
		[]byte(fixtureJSON(t)), "https://auth.example.com", false,
	)
	if err != nil || len(invalid) > 0 {
		t.Fatalf("failed to decode fixture: err=%v invalid=%v", err, invalid)
	}

	return definitions
}

func TestGetCustomOauth2ProvidersFixture(t *testing.T) {
	t.Parallel()

	cmd := testCLICommand(t, map[string]string{
		flagCustomProviders: fixtureJSON(t),
		flagServerURL:       "https://auth.example.com",
	})

	var logs bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&logs, nil))

	definitions, err := decodeCustomProviders(t.Context(), cmd, logger)
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}

	result, err := getCustomOauth2Providers(
		t.Context(), cmd, definitions, noConflictDB(), logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.providers) != 2 {
		t.Errorf("expected 2 providers, got %d", len(result.providers))
	}

	for _, id := range []string{"c:okta", "c:legacy"} {
		if result.providers.Get(id) == nil {
			t.Errorf("expected provider %s to be registered", id)
		}
	}

	// Only the OIDC-type custom gets a native id_token validator and a
	// configured issuer.
	if len(result.validators) != 1 || result.validators["c:okta"] == nil {
		t.Errorf("expected exactly the c:okta id_token validator, got %v", result.validators)
	}

	expectedIssuers := map[string]string{"c:okta": "https://acme.okta.com"}
	if !maps.Equal(result.issuers, expectedIssuers) {
		t.Errorf("expected issuers %v, got %v", expectedIssuers, result.issuers)
	}

	// The startup log lists providers but must never leak secrets.
	for _, secret := range []string{"okta-client-secret", "legacy-client-secret"} {
		if strings.Contains(logs.String(), secret) {
			t.Errorf("startup log contains client secret %q", secret)
		}
	}
}

func TestGetCustomOauth2ProvidersEmptyFlagIsInert(t *testing.T) {
	t.Parallel()

	cmd := testCLICommand(t, map[string]string{})

	definitions, err := decodeCustomProviders(t.Context(), cmd, slog.Default())
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}

	if definitions != nil {
		t.Errorf("expected no definitions with the flag unset, got %v", definitions)
	}

	// nil db: with the flag unset nothing may touch the database.
	result, err := getCustomOauth2Providers(t.Context(), cmd, definitions, nil, slog.Default())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.providers) != 0 || len(result.validators) != 0 || len(result.issuers) != 0 {
		t.Errorf("expected an empty registry, got %+v", result)
	}
}

func TestDecodeCustomProvidersMalformedEnvelopeFailsStartup(t *testing.T) {
	t.Parallel()

	cmd := testCLICommand(t, map[string]string{
		flagCustomProviders: `{not-json`,
		flagServerURL:       "https://auth.example.com",
	})

	_, err := decodeCustomProviders(t.Context(), cmd, slog.Default())
	if err == nil {
		t.Fatal("expected a malformed envelope to fail startup")
	}

	// The message must point at the configuration, not at a subsystem that
	// merely happens to consume it first.
	if !strings.Contains(err.Error(), "AUTH_PROVIDER_CUSTOM") {
		t.Errorf("expected the error to name the config variable, got: %v", err)
	}
}

func TestGetCustomOauth2ProvidersInvalidEntrySkipped(t *testing.T) {
	t.Parallel()

	envelope := `{
		"okta": {
			"type": "oidc",
			"clientId": "okta-client-id",
			"clientSecret": "okta-client-secret",
			"issuer": "https://acme.okta.com"
		},
		"bad": {
			"type": "oidc",
			"clientId": "bad-client-id",
			"clientSecret": "bad-client-secret",
			"issuer": "https://bad.example.com",
			"bogus": true
		}
	}`

	cmd := testCLICommand(t, map[string]string{
		flagCustomProviders: envelope,
		flagServerURL:       "https://auth.example.com",
	})

	var logs bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&logs, nil))

	definitions, err := decodeCustomProviders(t.Context(), cmd, logger)
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}

	result, err := getCustomOauth2Providers(
		t.Context(), cmd, definitions, noConflictDB(), logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.providers) != 1 || result.providers.Get("c:okta") == nil {
		t.Errorf("expected only c:okta to be registered, got %v", result.providers)
	}

	// The skip is logged with the slug and error class but never the secret.
	if !strings.Contains(logs.String(), "bad") {
		t.Error("expected the skipped slug in the log")
	}

	if strings.Contains(logs.String(), "bad-client-secret") {
		t.Error("log contains the skipped entry's client secret")
	}
}

func TestValidateCustomProvidersConfig(t *testing.T) {
	t.Parallel()

	withProviders := newCustomProvidersResult(1)
	withProviders.providers["c:okta"] = nil

	const serverURL = "https://auth.example.com"

	tests := []struct {
		name         string
		serverURL    string
		clientURL    string
		redirectURLs string
		custom       *customProvidersResult
		wantErr      error
	}{
		{
			name:         "providers enabled with no redirect target at all fails",
			serverURL:    serverURL,
			clientURL:    "",
			redirectURLs: "",
			custom:       withProviders,
			wantErr:      errCustomProvidersRequireRedirectTarget,
		},
		{
			name:         "providers enabled with blank client url and blank allowlist fails",
			serverURL:    serverURL,
			clientURL:    "   ",
			redirectURLs: "  ",
			custom:       withProviders,
			wantErr:      errCustomProvidersRequireRedirectTarget,
		},
		{
			// The working shape the guard used to reject: no client URL, but an
			// allowlist whose entries NewWorkflows still compiles, so a caller
			// passing an explicit allowlisted redirectTo completes the flow.
			name:         "providers enabled with allowlist but no client url passes",
			serverURL:    serverURL,
			clientURL:    "",
			redirectURLs: "https://app.example.com",
			custom:       withProviders,
			wantErr:      nil,
		},
		{
			name:      "providers enabled with client url passes",
			serverURL: serverURL,
			clientURL: "https://app.example.com",
			custom:    withProviders,
			wantErr:   nil,
		},
		{
			// Unconditionally fatal: the redirect_uri registered with the IdP
			// is derived from it.
			name:      "providers enabled without server url fails",
			serverURL: "",
			clientURL: "https://app.example.com",
			custom:    withProviders,
			wantErr:   errCustomProvidersRequireServerURL,
		},
		{
			name:      "providers enabled with blank server url fails",
			serverURL: "  ",
			clientURL: "https://app.example.com",
			custom:    withProviders,
			wantErr:   errCustomProvidersRequireServerURL,
		},
		{
			name:      "no providers without any url passes",
			serverURL: "",
			clientURL: "",
			custom:    newCustomProvidersResult(0),
			wantErr:   nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cmd := testCLICommand(t, map[string]string{
				flagServerURL:         tc.serverURL,
				flagClientURL:         tc.clientURL,
				flagAllowRedirectURLs: tc.redirectURLs,
			})

			err := validateCustomProvidersConfig(cmd, tc.custom)
			if !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got: %v", tc.wantErr, err)
			}
		})
	}
}

// TestDecodeCustomProvidersBlankValueIsInert pins that a whitespace-only
// AUTH_PROVIDER_CUSTOM — the trailing newline a YAML block scalar or a Helm
// "|" value contributes — reads as "not configured" rather than failing
// startup on an empty JSON document.
func TestDecodeCustomProvidersBlankValueIsInert(t *testing.T) {
	t.Parallel()

	for _, raw := range []string{"   ", "\n", " \t\n "} {
		cmd := testCLICommand(t, map[string]string{
			flagCustomProviders: raw,
			flagServerURL:       "https://auth.example.com",
		})

		definitions, err := decodeCustomProviders(t.Context(), cmd, slog.Default())
		if err != nil {
			t.Fatalf("unexpected error for %q: %v", raw, err)
		}

		if definitions != nil {
			t.Errorf("expected no definitions for %q, got %v", raw, definitions)
		}
	}
}

func TestCheckIssuerConflict(t *testing.T) {
	t.Parallel()

	definitions := fixtureDefinitions(t)
	oidcDef := definitions["okta"]
	oauth2Def := definitions["legacy"]

	tests := []struct {
		name    string
		def     providers.Definition
		db      customProvidersDB
		wantErr error
		wantMsg string
	}{
		{
			name:    "no recorded identities passes",
			def:     oidcDef,
			db:      noConflictDB(),
			wantErr: nil,
			wantMsg: "",
		},
		{
			name: "identities recorded under a different issuer fail startup",
			def:  oidcDef,
			db: &stubCustomProvidersDB{
				conflictingIssuer: pgtype.Text{
					String: "https://other-idp.example.com", Valid: true,
				},
				conflictErr:    nil,
				recordedIssuer: pgtype.Text{},
				recordedErr:    pgx.ErrNoRows,
				upserted:       nil,
			},
			wantErr: errCustomProviderIssuerConflict,
			wantMsg: "https://other-idp.example.com",
		},
		{
			// The NULL-issuer guard: rows recorded before issuer tracking
			// must not be silently inherited after a re-point.
			name: "identities recorded without an issuer fail startup",
			def:  oidcDef,
			db: &stubCustomProvidersDB{
				conflictingIssuer: pgtype.Text{},
				conflictErr:       nil,
				recordedIssuer:    pgtype.Text{},
				recordedErr:       pgx.ErrNoRows,
				upserted:          nil,
			},
			wantErr: errCustomProviderIssuerConflict,
			wantMsg: "backfill",
		},
		{
			name: "database errors fail startup",
			def:  oidcDef,
			db: &stubCustomProvidersDB{
				conflictingIssuer: pgtype.Text{},
				conflictErr:       errDBDown,
				recordedIssuer:    pgtype.Text{},
				recordedErr:       pgx.ErrNoRows,
				upserted:          nil,
			},
			wantErr: errDBDown,
			wantMsg: "",
		},
		{
			name:    "oauth2-type custom without recorded issuers passes",
			def:     oauth2Def,
			db:      noConflictDB(),
			wantErr: nil,
			wantMsg: "",
		},
		{
			// The mirror of the OIDC guard: an oauth2-type custom records no
			// issuer, so identities an OIDC-type provider established under
			// this slug must not be inherited — nothing on the request path
			// would catch it.
			name: "oauth2-type custom with recorded issuers fails startup",
			def:  oauth2Def,
			db: &stubCustomProvidersDB{
				conflictingIssuer: pgtype.Text{},
				conflictErr:       pgx.ErrNoRows,
				recordedIssuer: pgtype.Text{
					String: "https://acme.okta.com", Valid: true,
				},
				recordedErr: nil,
				upserted:    nil,
			},
			wantErr: errCustomProviderIssuerConflict,
			wantMsg: "https://acme.okta.com",
		},
		{
			name: "oauth2-type probe database errors fail startup",
			def:  oauth2Def,
			db: &stubCustomProvidersDB{
				conflictingIssuer: pgtype.Text{},
				conflictErr:       pgx.ErrNoRows,
				recordedIssuer:    pgtype.Text{},
				recordedErr:       errDBDown,
				upserted:          nil,
			},
			wantErr: errDBDown,
			wantMsg: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := checkIssuerConflict(t.Context(), tc.db, tc.def)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("expected %v, got: %v", tc.wantErr, err)
			}

			if tc.wantMsg != "" && !strings.Contains(err.Error(), tc.wantMsg) {
				t.Errorf("expected error message to contain %q, got: %v", tc.wantMsg, err)
			}
		})
	}
}

func TestInsertProviders(t *testing.T) {
	t.Parallel()

	t.Run("fixture ids are upserted sorted with the c: prefix", func(t *testing.T) {
		t.Parallel()

		db := noConflictDB()
		if err := insertProviders(
			t.Context(), fixtureDefinitions(t), db, slog.Default(),
		); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := [][]string{{"c:legacy", "c:okta"}}
		if !slices.EqualFunc(db.upserted, expected, slices.Equal) {
			t.Errorf("expected upserts %v, got %v", expected, db.upserted)
		}
	})

	t.Run("no definitions never touches the database", func(t *testing.T) {
		t.Parallel()

		if err := insertProviders(t.Context(), nil, nil, slog.Default()); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
