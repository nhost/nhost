package cmd

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/controller"
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
) (oapimw.CORSOptions, *bytes.Buffer, error) {
	t.Helper()

	var (
		buf     bytes.Buffer
		gotOpts oapimw.CORSOptions
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
			name: "wildcard with credentials is rejected",
			args: []string{
				"--" + flagCORSAllowedOrigins,
				"*",
			},
			wantErr:     oapimw.ErrWildcardWithCredentials,
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

func runGetMaxGraphQLRequestBodyBytes(t *testing.T, args []string) (int64, error) {
	t.Helper()

	return runGetMaxGraphQLRequestBodyBytesWithFlags(
		t,
		serverFlagsWithoutEnvVarsForTest(t, flagGraphQLRequestBodyLimitBytes),
		args,
	)
}

func runGetMaxGraphQLRequestBodyBytesWithFlags(
	t *testing.T,
	flags []cli.Flag,
	args []string,
) (int64, error) {
	t.Helper()

	var (
		gotLimit int64
		gotErr   error
	)

	cmd := &cli.Command{
		Name:  "serve",
		Flags: flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			gotLimit, gotErr = getMaxGraphQLRequestBodyBytes(cmd)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return gotLimit, gotErr
}

func TestGetMaxGraphQLRequestBodyBytes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		args        []string
		wantLimit   int64
		wantErrText string
	}{
		{
			name:      "default",
			args:      nil,
			wantLimit: controller.DefaultMaxGraphQLRequestBodyBytes,
		},
		{
			name:      "explicit positive limit",
			args:      []string{"--" + flagGraphQLRequestBodyLimitBytes, "1024"},
			wantLimit: 1024,
		},
		{
			name:        "zero rejected",
			args:        []string{"--" + flagGraphQLRequestBodyLimitBytes, "0"},
			wantErrText: flagGraphQLRequestBodyLimitBytes,
		},
		{
			name:        "negative rejected",
			args:        []string{"--" + flagGraphQLRequestBodyLimitBytes, "-1"},
			wantErrText: flagGraphQLRequestBodyLimitBytes,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotLimit, err := runGetMaxGraphQLRequestBodyBytes(t, tt.args)
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
				t.Fatalf("getMaxGraphQLRequestBodyBytes unexpected error: %v", err)
			}

			if gotLimit != tt.wantLimit {
				t.Errorf("limit = %d; want %d", gotLimit, tt.wantLimit)
			}
		})
	}
}

func TestGetMaxGraphQLRequestBodyBytesFromEnv(t *testing.T) {
	t.Setenv("CONSTELLATION_GRAPHQL_REQUEST_BODY_LIMIT_BYTES", "2048")

	gotLimit, err := runGetMaxGraphQLRequestBodyBytesWithFlags(
		t,
		serverFlagsByNameForTest(t, flagGraphQLRequestBodyLimitBytes),
		nil,
	)
	if err != nil {
		t.Fatalf("getMaxGraphQLRequestBodyBytes unexpected error: %v", err)
	}

	if gotLimit != 2048 {
		t.Errorf("limit = %d; want %d", gotLimit, 2048)
	}
}

func runNewHTTPServer(t *testing.T, args []string) (*http.Server, error) {
	t.Helper()

	return runNewHTTPServerWithFlags(
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

func runNewHTTPServerWithFlags(
	t *testing.T,
	flags []cli.Flag,
	args []string,
) (*http.Server, error) {
	t.Helper()

	var (
		gotServer *http.Server
		gotErr    error
	)

	cmd := &cli.Command{
		Name:  "serve",
		Flags: flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			gotServer, gotErr = newHTTPServer(cmd, http.NewServeMux())

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return gotServer, gotErr
}

func TestNewHTTPServerConfig(t *testing.T) {
	t.Parallel()

	const (
		customReadTimeout  = 45 * time.Second
		shortReadTimeout   = 2 * time.Second
		customWriteTimeout = 2 * time.Minute
		customIdleTimeout  = 3 * time.Minute
	)

	tests := []struct {
		name           string
		args           []string
		wantRead       time.Duration
		wantReadHeader time.Duration
		wantWrite      time.Duration
		wantIdle       time.Duration
		wantErrText    string
	}{
		{
			name:           "default timeouts",
			args:           nil,
			wantRead:       defaultHTTPReadTimeout,
			wantReadHeader: maxHTTPReadHeaderTimeout,
			wantWrite:      defaultHTTPWriteTimeout,
			wantIdle:       defaultHTTPIdleTimeout,
		},
		{
			name: "explicit positive timeouts",
			args: []string{
				"--" + flagHTTPReadTimeout, customReadTimeout.String(),
				"--" + flagHTTPWriteTimeout, customWriteTimeout.String(),
				"--" + flagHTTPIdleTimeout, customIdleTimeout.String(),
			},
			wantRead:       customReadTimeout,
			wantReadHeader: maxHTTPReadHeaderTimeout,
			wantWrite:      customWriteTimeout,
			wantIdle:       customIdleTimeout,
		},
		{
			name: "short read timeout also caps header reads",
			args: []string{
				"--" + flagHTTPReadTimeout, shortReadTimeout.String(),
			},
			wantRead:       shortReadTimeout,
			wantReadHeader: shortReadTimeout,
			wantWrite:      defaultHTTPWriteTimeout,
			wantIdle:       defaultHTTPIdleTimeout,
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

			server, err := runNewHTTPServer(t, tt.args)
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
				t.Fatalf("newHTTPServer unexpected error: %v", err)
			}

			if server.ReadTimeout != tt.wantRead {
				t.Errorf("ReadTimeout = %s; want %s", server.ReadTimeout, tt.wantRead)
			}

			if server.ReadHeaderTimeout != tt.wantReadHeader {
				t.Errorf(
					"ReadHeaderTimeout = %s; want %s",
					server.ReadHeaderTimeout,
					tt.wantReadHeader,
				)
			}

			if server.WriteTimeout != tt.wantWrite {
				t.Errorf("WriteTimeout = %s; want %s", server.WriteTimeout, tt.wantWrite)
			}

			if server.IdleTimeout != tt.wantIdle {
				t.Errorf("IdleTimeout = %s; want %s", server.IdleTimeout, tt.wantIdle)
			}
		})
	}
}

func TestNewHTTPServerConfigFromEnv(t *testing.T) {
	const (
		envReadTimeout  = 45 * time.Second
		envWriteTimeout = 2 * time.Minute
		envIdleTimeout  = 3 * time.Minute
	)

	t.Setenv("CONSTELLATION_HTTP_READ_TIMEOUT", envReadTimeout.String())
	t.Setenv("CONSTELLATION_HTTP_WRITE_TIMEOUT", envWriteTimeout.String())
	t.Setenv("CONSTELLATION_HTTP_IDLE_TIMEOUT", envIdleTimeout.String())

	server, err := runNewHTTPServerWithFlags(
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
		t.Fatalf("newHTTPServer unexpected error: %v", err)
	}

	if server.ReadTimeout != envReadTimeout {
		t.Errorf("ReadTimeout = %s; want %s", server.ReadTimeout, envReadTimeout)
	}

	if server.ReadHeaderTimeout != maxHTTPReadHeaderTimeout {
		t.Errorf(
			"ReadHeaderTimeout = %s; want %s",
			server.ReadHeaderTimeout,
			maxHTTPReadHeaderTimeout,
		)
	}

	if server.WriteTimeout != envWriteTimeout {
		t.Errorf("WriteTimeout = %s; want %s", server.WriteTimeout, envWriteTimeout)
	}

	if server.IdleTimeout != envIdleTimeout {
		t.Errorf("IdleTimeout = %s; want %s", server.IdleTimeout, envIdleTimeout)
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
	case *cli.Int64Flag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.DurationFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	default:
		t.Fatalf("clearing env sources for %v: unsupported flag type %T", flag.Names(), flag)
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
func assertSafeDefaultOpts(t *testing.T, opts oapimw.CORSOptions, wantOrigins []string) {
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
