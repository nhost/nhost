package cmd

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/urfave/cli/v3"
)

const testJWTSecret = `{"type":"HS256","key":"config-test-jwt-secret-32-bytes-long"}`

// validTestOptions returns a Options that passes Validate, for tests to adjust.
func validTestOptions() Options {
	return Options{
		Version:                          "test",
		AdminSecret:                      "test-admin-secret",
		JWTSecret:                        testJWTSecret,
		MetadataDatabaseURL:              "",
		MetadataPath:                     "./metadata/metadata.yaml",
		SubscriptionPollInterval:         time.Second,
		GraphQLRequestBodyLimitBytes:     controller.DefaultMaxGraphQLRequestBodyBytes,
		CORSAllowedOrigins:               []string{"https://app.example.com"},
		HasuraUpstreamURL:                "",
		HasuraProxyRequestBodyLimitBytes: defaultHasuraProxyRequestBodyLimitBytes,
		EnablePlayground:                 false,
		DevMode:                          false,
	}
}

func TestOptionsValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mutate  func(*Options)
		wantErr error
	}{
		{
			name:    "valid",
			mutate:  func(*Options) {},
			wantErr: nil,
		},
		{
			name: "database metadata needs no path",
			mutate: func(c *Options) {
				c.MetadataPath = ""
				c.MetadataDatabaseURL = "postgres://localhost/metadata"
			},
			wantErr: nil,
		},
		{
			name:    "no CORS origins denies all",
			mutate:  func(c *Options) { c.CORSAllowedOrigins = nil },
			wantErr: nil,
		},
		{
			name:    "zero proxy body limit disables the cap",
			mutate:  func(c *Options) { c.HasuraProxyRequestBodyLimitBytes = 0 },
			wantErr: nil,
		},
		{
			name:    "admin secret required",
			mutate:  func(c *Options) { c.AdminSecret = "" },
			wantErr: errAdminSecretRequired,
		},
		{
			name:    "JWT secret required",
			mutate:  func(c *Options) { c.JWTSecret = "" },
			wantErr: errJWTSecretRequired,
		},
		{
			name:    "metadata source required",
			mutate:  func(c *Options) { c.MetadataPath = "" },
			wantErr: errMetadataRequired,
		},
		{
			name:    "zero poll interval",
			mutate:  func(c *Options) { c.SubscriptionPollInterval = 0 },
			wantErr: errPollIntervalNotPositive,
		},
		{
			name:    "zero GraphQL body limit",
			mutate:  func(c *Options) { c.GraphQLRequestBodyLimitBytes = 0 },
			wantErr: errGraphQLBodyLimitNotPositive,
		},
		{
			name:    "negative GraphQL body limit",
			mutate:  func(c *Options) { c.GraphQLRequestBodyLimitBytes = -1 },
			wantErr: errGraphQLBodyLimitNotPositive,
		},
		{
			// A negative cap used to silently disable the limit like 0 does, so
			// a typo could turn off a security cap.
			name:    "negative proxy body limit",
			mutate:  func(c *Options) { c.HasuraProxyRequestBodyLimitBytes = -1 },
			wantErr: errProxyBodyLimitNegative,
		},
		{
			name:    "wildcard CORS origin with credentials",
			mutate:  func(c *Options) { c.CORSAllowedOrigins = []string{"*"} },
			wantErr: oapimw.ErrWildcardWithCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts := validTestOptions()
			tt.mutate(&opts)

			err := opts.Validate()
			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("Validate() = %v, want nil", err)
				}

				return
			}

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() = %v, want wrapping %v", err, tt.wantErr)
			}
		})
	}
}

func TestOptionsValidateReportsEveryProblem(t *testing.T) {
	t.Parallel()

	err := Options{}.Validate()

	for _, want := range []error{
		errAdminSecretRequired,
		errJWTSecretRequired,
		errMetadataRequired,
		errPollIntervalNotPositive,
		errGraphQLBodyLimitNotPositive,
	} {
		if !errors.Is(err, want) {
			t.Errorf("Validate() = %v, want wrapping %v", err, want)
		}
	}
}

// runConfigFromCommand resolves flags from args exactly as the serve command
// does and returns the Options they map to.
func runConfigFromCommand(t *testing.T, flags []cli.Flag, args ...string) Options {
	t.Helper()

	var opts Options

	cmd := &cli.Command{
		Name:    "serve",
		Version: "v-test",
		Flags:   flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			opts = optionsFromCommand(cmd)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return opts
}

// serveFlagsWithoutEnvVarsForTest returns the serve flags with their
// environment sources cleared, so default-value tests are independent from a
// developer or CI environment.
func serveFlagsWithoutEnvVarsForTest(t *testing.T) []cli.Flag {
	t.Helper()

	flags := serveFlags()
	for _, flag := range flags {
		clearFlagSourcesForTest(t, flag)
	}

	return flags
}

func TestOptionsFromCommandDefaults(t *testing.T) {
	t.Parallel()

	got := runConfigFromCommand(
		t,
		serveFlagsWithoutEnvVarsForTest(t),
		"--"+flagAdminSecret, "admin",
		"--"+flagJWTSecret, testJWTSecret,
	)

	want := Options{
		Version:                          "v-test",
		AdminSecret:                      "admin",
		JWTSecret:                        testJWTSecret,
		MetadataDatabaseURL:              "",
		MetadataPath:                     "./metadata/metadata.yaml",
		SubscriptionPollInterval:         time.Second,
		GraphQLRequestBodyLimitBytes:     controller.DefaultMaxGraphQLRequestBodyBytes,
		CORSAllowedOrigins:               []string{},
		HasuraUpstreamURL:                defaultHasuraUpstreamURL,
		HasuraProxyRequestBodyLimitBytes: defaultHasuraProxyRequestBodyLimitBytes,
		EnablePlayground:                 false,
		DevMode:                          false,
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("optionsFromCommand() = %+v\nwant %+v", got, want)
	}

	if err := got.Validate(); err != nil {
		t.Fatalf("default options do not validate: %v", err)
	}
}

func TestOptionsFromCommandFlags(t *testing.T) {
	t.Parallel()

	got := runConfigFromCommand(
		t,
		serveFlagsWithoutEnvVarsForTest(t),
		"--"+flagAdminSecret, "admin",
		"--"+flagJWTSecret, testJWTSecret,
		"--"+flagMetadataDatabaseURL, "postgres://localhost/metadata",
		"--"+flagMetadataPath, "/etc/metadata.yaml",
		"--"+flagSubscriptionPollInterval, "3s",
		"--"+flagGraphQLRequestBodyLimitBytes, "1024",
		"--"+flagCORSAllowedOrigins, "https://app.example.com",
		"--"+flagCORSAllowedOrigins, "https://admin.example.com",
		"--"+flagHasuraUpstreamURL, "",
		"--"+flagHasuraProxyRequestBodyLimitBytes, "0",
		"--"+flagEnablePlayground,
		"--"+flagDevMode,
	)

	want := Options{
		Version:                      "v-test",
		AdminSecret:                  "admin",
		JWTSecret:                    testJWTSecret,
		MetadataDatabaseURL:          "postgres://localhost/metadata",
		MetadataPath:                 "/etc/metadata.yaml",
		SubscriptionPollInterval:     3 * time.Second,
		GraphQLRequestBodyLimitBytes: 1024,
		CORSAllowedOrigins: []string{
			"https://app.example.com",
			"https://admin.example.com",
		},
		HasuraUpstreamURL:                "",
		HasuraProxyRequestBodyLimitBytes: 0,
		EnablePlayground:                 true,
		DevMode:                          true,
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("optionsFromCommand() = %+v\nwant %+v", got, want)
	}
}

func TestOptionsFromCommandEnv(t *testing.T) {
	t.Setenv("CONSTELLATION_GRAPHQL_REQUEST_BODY_LIMIT_BYTES", "2048")
	// An explicitly empty upstream disables the proxy rather than falling back
	// to the sidecar default.
	t.Setenv("CONSTELLATION_HASURA_UPSTREAM_URL", "")

	got := runConfigFromCommand(
		t,
		serveFlags(),
		"--"+flagAdminSecret, "admin",
		"--"+flagJWTSecret, testJWTSecret,
	)

	if got.GraphQLRequestBodyLimitBytes != 2048 {
		t.Errorf("GraphQLRequestBodyLimitBytes = %d, want 2048", got.GraphQLRequestBodyLimitBytes)
	}

	if got.HasuraUpstreamURL != "" {
		t.Errorf("HasuraUpstreamURL = %q, want empty", got.HasuraUpstreamURL)
	}
}
