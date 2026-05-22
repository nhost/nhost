package cmd

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	oapicors "github.com/nhost/nhost/services/constellation/internal/lib/oapi/cors"
	"github.com/urfave/cli/v3"
)

// runGetCorsOptions drives getCorsOptions through a real cli.Command so the
// flag is resolved exactly as it is at runtime. When args contains the
// --cors-allowed-origins flag the slice is populated; otherwise the flag stays
// unset and getCorsOptions sees a nil slice (the deny-all default path). The
// captured log buffer lets callers assert on the startup warning.
func runGetCorsOptions(
	t *testing.T,
	args []string,
) (oapicors.Options, *bytes.Buffer, error) {
	t.Helper()

	var (
		buf     bytes.Buffer
		gotOpts oapicors.Options
		gotErr  error
	)

	logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	cmd := &cli.Command{
		Name:  "serve",
		Flags: serverFlags(),
		Action: func(ctx context.Context, cmd *cli.Command) error {
			gotOpts, gotErr = getCorsOptions(ctx, cmd, logger)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return gotOpts, &buf, gotErr
}

func TestGetCorsOptions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
		// wantErr, when non-nil, is the sentinel the returned error must wrap.
		wantErr error
		// wantOrigins is the expected AllowedOrigins; checked only when wantErr
		// is nil.
		wantOrigins []string
		// wantWarn asserts whether the deny-all startup warning fired.
		wantWarn bool
	}{
		{
			name:        "flag unset denies all cross-origin and warns",
			args:        nil,
			wantErr:     nil,
			wantOrigins: []string{},
			wantWarn:    true,
		},
		{
			name:        "wildcard with credentials is rejected",
			args:        []string{"--" + flagCORSAllowedOrigins, "*"},
			wantErr:     oapicors.ErrWildcardWithCredentials,
			wantOrigins: nil,
			wantWarn:    false,
		},
		{
			name: "explicit origins are accepted without warning",
			args: []string{
				"--" + flagCORSAllowedOrigins, "https://app.example.com",
				"--" + flagCORSAllowedOrigins, "https://admin.example.com",
			},
			wantErr:     nil,
			wantOrigins: []string{"https://app.example.com", "https://admin.example.com"},
			wantWarn:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts, buf, err := runGetCorsOptions(t, tt.args)

			if tt.wantErr != nil {
				assertWildcardError(t, err, tt.wantErr)

				return
			}

			if err != nil {
				t.Fatalf("getCorsOptions unexpected error: %v", err)
			}

			assertSafeDefaultOpts(t, opts, tt.wantOrigins)
			assertDenyAllWarning(t, buf.String(), tt.wantWarn)
		})
	}
}

func TestGetCorsOptionsAllowHeadersFunc(t *testing.T) {
	t.Parallel()

	opts, _, err := runGetCorsOptions(
		t,
		[]string{"--" + flagCORSAllowedOrigins, "https://app.example.com"},
	)
	if err != nil {
		t.Fatalf("getCorsOptions unexpected error: %v", err)
	}

	if opts.AllowHeadersFunc == nil {
		t.Fatal("AllowHeadersFunc is nil; want non-nil so X-Hasura-*/X-Nhost-* pass CORS")
	}

	cases := []struct {
		name   string
		header string
		want   bool
	}{
		{name: "authorization", header: "Authorization", want: true},
		{name: "content_type", header: "Content-Type", want: true},
		{name: "hasura_session_var", header: "X-Hasura-User-Id", want: true},
		{name: "hasura_lowercase", header: "x-hasura-role", want: true},
		{name: "nhost_webhook_secret", header: "X-Nhost-Webhook-Secret", want: true},
		{name: "unrelated_header", header: "X-Random", want: false},
		{name: "prefix_only_no_dash", header: "X-Hasura", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := opts.AllowHeadersFunc(tc.header); got != tc.want {
				t.Errorf("AllowHeadersFunc(%q) = %v; want %v", tc.header, got, tc.want)
			}
		})
	}
}

// assertWildcardError checks the validation-error path: the returned error must
// wrap the expected sentinel and name the flag so operators know what to fix.
func assertWildcardError(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("getCorsOptions error = %v; want wrapping %v", err, want)
	}

	if !strings.Contains(err.Error(), flagCORSAllowedOrigins) {
		t.Errorf("error %q does not name flag %q", err, flagCORSAllowedOrigins)
	}
}

// assertSafeDefaultOpts locks in the safe-default guarantee: AllowedOrigins is
// never nil (a nil slice would allow all origins), matches the expected list,
// and credentials stay enabled.
func assertSafeDefaultOpts(t *testing.T, opts oapicors.Options, wantOrigins []string) {
	t.Helper()

	if opts.AllowedOrigins == nil {
		t.Errorf("AllowedOrigins is nil; want non-nil (nil would allow all origins)")
	}

	if got := opts.AllowedOrigins; !equalStrings(got, wantOrigins) {
		t.Errorf("AllowedOrigins = %v; want %v", got, wantOrigins)
	}

	if !opts.AllowCredentials {
		t.Errorf("AllowCredentials = false; want true")
	}
}

// assertDenyAllWarning verifies the startup deny-all warning fires exactly when
// expected and names the flag operators must set.
func assertDenyAllWarning(t *testing.T, logOutput string, wantWarn bool) {
	t.Helper()

	gotWarn := strings.Contains(logOutput, "all cross-origin requests will be denied")
	if gotWarn != wantWarn {
		t.Errorf("deny-all warning fired = %v; want %v (log: %q)", gotWarn, wantWarn, logOutput)
	}

	if wantWarn && !strings.Contains(logOutput, flagCORSAllowedOrigins) {
		t.Errorf("deny-all warning does not name flag %q: %q", flagCORSAllowedOrigins, logOutput)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}
