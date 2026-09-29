package cmd

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

func TestCorsOptions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		origins []string
		// wantErr, when non-nil, is the sentinel the returned error must wrap.
		wantErr error
		// wantOrigins is the expected AllowedOrigins; checked only when wantErr
		// is nil.
		wantOrigins []string
	}{
		{
			name:        "no origins denies all cross-origin",
			origins:     nil,
			wantErr:     nil,
			wantOrigins: []string{},
		},
		{
			name:        "wildcard with credentials is rejected",
			origins:     []string{"*"},
			wantErr:     oapimw.ErrWildcardWithCredentials,
			wantOrigins: nil,
		},
		{
			name:        "explicit origins are accepted",
			origins:     []string{"https://app.example.com", "https://admin.example.com"},
			wantErr:     nil,
			wantOrigins: []string{"https://app.example.com", "https://admin.example.com"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts, err := corsOptions(tt.origins)

			if tt.wantErr != nil {
				assertWildcardError(t, err, tt.wantErr)

				return
			}

			if err != nil {
				t.Fatalf("corsOptions unexpected error: %v", err)
			}

			assertSafeDefaultOpts(t, opts, tt.wantOrigins)
		})
	}
}

func TestCorsOptionsAllowHeadersFunc(t *testing.T) {
	t.Parallel()

	opts, err := corsOptions([]string{"https://app.example.com"})
	if err != nil {
		t.Fatalf("corsOptions unexpected error: %v", err)
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

func runHTTPTimeouts(t *testing.T, args []string) (serveutil.HTTPTimeouts, error) {
	t.Helper()

	return runHTTPTimeoutsWithFlags(
		t,
		serverFlagsWithoutEnvVarsForTest(
			t,
			flagHTTPReadTimeout,
			flagHTTPWriteTimeout,
			flagHTTPIdleTimeout,
		),
		args,
	)
}

func runHTTPTimeoutsWithFlags(
	t *testing.T,
	flags []cli.Flag,
	args []string,
) (serveutil.HTTPTimeouts, error) {
	t.Helper()

	var (
		gotTimeouts serveutil.HTTPTimeouts
		gotErr      error
	)

	cmd := &cli.Command{
		Name:  "serve",
		Flags: flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			gotTimeouts, gotErr = httpTimeouts(cmd)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return gotTimeouts, gotErr
}

func TestHTTPTimeoutsConfig(t *testing.T) {
	t.Parallel()

	const (
		customReadTimeout  = 45 * time.Second
		shortReadTimeout   = 2 * time.Second
		customWriteTimeout = 2 * time.Minute
		customIdleTimeout  = 3 * time.Minute
	)

	tests := []struct {
		name        string
		args        []string
		want        serveutil.HTTPTimeouts
		wantErrText string
	}{
		{
			name: "default timeouts",
			args: nil,
			want: serveutil.HTTPTimeouts{
				ReadHeader: maxHTTPReadHeaderTimeout,
				Read:       defaultHTTPReadTimeout,
				Write:      defaultHTTPWriteTimeout,
				Idle:       defaultHTTPIdleTimeout,
			},
		},
		{
			name: "explicit positive timeouts",
			args: []string{
				"--" + flagHTTPReadTimeout, customReadTimeout.String(),
				"--" + flagHTTPWriteTimeout, customWriteTimeout.String(),
				"--" + flagHTTPIdleTimeout, customIdleTimeout.String(),
			},
			want: serveutil.HTTPTimeouts{
				ReadHeader: maxHTTPReadHeaderTimeout,
				Read:       customReadTimeout,
				Write:      customWriteTimeout,
				Idle:       customIdleTimeout,
			},
		},
		{
			name: "short read timeout also caps header reads",
			args: []string{
				"--" + flagHTTPReadTimeout, shortReadTimeout.String(),
			},
			want: serveutil.HTTPTimeouts{
				ReadHeader: shortReadTimeout,
				Read:       shortReadTimeout,
				Write:      defaultHTTPWriteTimeout,
				Idle:       defaultHTTPIdleTimeout,
			},
		},
		{
			name:        "zero read timeout rejected",
			args:        []string{"--" + flagHTTPReadTimeout, "0s"},
			wantErrText: flagHTTPReadTimeout,
		},
		{
			name:        "zero write timeout rejected",
			args:        []string{"--" + flagHTTPWriteTimeout, "0s"},
			wantErrText: flagHTTPWriteTimeout,
		},
		{
			name:        "zero idle timeout rejected",
			args:        []string{"--" + flagHTTPIdleTimeout, "0s"},
			wantErrText: flagHTTPIdleTimeout,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := runHTTPTimeouts(t, tt.args)
			if tt.wantErrText != "" {
				if err == nil {
					t.Fatalf("expected error containing %q", tt.wantErrText)
				}

				if !strings.Contains(err.Error(), tt.wantErrText) {
					t.Fatalf("error %q does not contain %q", err, tt.wantErrText)
				}

				return
			}

			if err != nil {
				t.Fatalf("httpTimeouts unexpected error: %v", err)
			}

			if got != tt.want {
				t.Errorf("httpTimeouts() = %+v; want %+v", got, tt.want)
			}
		})
	}
}

func TestHTTPTimeoutsConfigFromEnv(t *testing.T) {
	const (
		envReadTimeout  = 45 * time.Second
		envWriteTimeout = 2 * time.Minute
		envIdleTimeout  = 3 * time.Minute
	)

	t.Setenv("CONSTELLATION_HTTP_READ_TIMEOUT", envReadTimeout.String())
	t.Setenv("CONSTELLATION_HTTP_WRITE_TIMEOUT", envWriteTimeout.String())
	t.Setenv("CONSTELLATION_HTTP_IDLE_TIMEOUT", envIdleTimeout.String())

	got, err := runHTTPTimeoutsWithFlags(
		t,
		serverFlagsByNameForTest(
			t,
			flagHTTPReadTimeout,
			flagHTTPWriteTimeout,
			flagHTTPIdleTimeout,
		),
		nil,
	)
	if err != nil {
		t.Fatalf("httpTimeouts unexpected error: %v", err)
	}

	want := serveutil.HTTPTimeouts{
		ReadHeader: maxHTTPReadHeaderTimeout,
		Read:       envReadTimeout,
		Write:      envWriteTimeout,
		Idle:       envIdleTimeout,
	}
	if got != want {
		t.Errorf("httpTimeouts() = %+v; want %+v", got, want)
	}
}

// serverFlagsWithoutEnvVarsForTest reuses the production flag definitions while
// clearing process-environment sources so default-value tests are independent
// from a developer or CI environment.
func serverFlagsWithoutEnvVarsForTest(t *testing.T, names ...string) []cli.Flag {
	t.Helper()

	flags := serverFlagsByNameForTest(t, names...)
	for _, flag := range flags {
		clearFlagSourcesForTest(t, flag)
	}

	return flags
}

func serverFlagsByNameForTest(t *testing.T, names ...string) []cli.Flag {
	t.Helper()

	flags := make([]cli.Flag, 0, len(names))
	for _, name := range names {
		flags = append(flags, serverFlagByNameForTest(t, name))
	}

	return flags
}

func serverFlagByNameForTest(t *testing.T, name string) cli.Flag {
	t.Helper()

	for _, flag := range serverFlags() {
		if slices.Contains(flag.Names(), name) {
			return flag
		}
	}

	t.Fatalf("server flag %q not found", name)

	return nil
}

func clearFlagSourcesForTest(t *testing.T, flag cli.Flag) {
	t.Helper()

	switch typedFlag := flag.(type) {
	case *cli.BoolFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.Int64Flag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.DurationFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringSliceFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	default:
		t.Fatalf("clearing env sources for %v: unsupported flag type %T", flag.Names(), flag)
	}
}

// assertWildcardError checks the validation-error path: the returned error must
// wrap the expected sentinel and name the setting so operators know what to
// fix.
func assertWildcardError(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("corsOptions error = %v; want wrapping %v", err, want)
	}

	if !strings.Contains(err.Error(), "CORSAllowedOrigins") {
		t.Errorf("error %q does not name CORSAllowedOrigins", err)
	}
}

// assertSafeDefaultOpts locks in the safe-default guarantee: AllowedOrigins is
// never nil (a nil slice would allow all origins), matches the expected list,
// and credentials stay enabled.
func assertSafeDefaultOpts(t *testing.T, opts oapimw.CORSOptions, wantOrigins []string) {
	t.Helper()

	if opts.AllowedOrigins == nil {
		t.Errorf("AllowedOrigins is nil; want non-nil (nil would allow all origins)")
	}

	if got := opts.AllowedOrigins; !slices.Equal(got, wantOrigins) {
		t.Errorf("AllowedOrigins = %v; want %v", got, wantOrigins)
	}

	if !opts.AllowCredentials {
		t.Errorf("AllowCredentials = false; want true")
	}
}

// the CORS preflight must permit every method that can be proxied to Hasura.
// The previous hardcoded {GET, POST, OPTIONS} silently broke browser
// preflights against Hasura REST endpoints (PUT/PATCH/DELETE) and HEAD
// liveness probes.
func TestCorsOptionsAllowsProxiedMethods(t *testing.T) {
	t.Parallel()

	opts, err := corsOptions([]string{"https://app.example.com"})
	if err != nil {
		t.Fatalf("corsOptions unexpected error: %v", err)
	}

	for _, method := range []string{
		"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
	} {
		if !slices.Contains(opts.AllowedMethods, method) {
			t.Errorf(
				"AllowedMethods missing %q (got %v); browsers cannot preflight "+
					"this method against the proxy fallback",
				method, opts.AllowedMethods,
			)
		}
	}
}
