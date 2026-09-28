package cmd

import (
	"context"
	"errors"
	"log/slog"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/storage/image"
	"github.com/urfave/cli/v3"
)

// validTestOptions returns Options that pass Validate, for tests to adjust.
func validTestOptions() Options {
	return Options{
		Version:                      "",
		PublicURL:                    "http://localhost:8000",
		APIRootPrefix:                "/v1",
		HasuraEndpoint:               "http://hasura:8080/v1",
		HasuraAdminSecret:            "test-admin-secret",
		ApplyHasuraMetadata:          true,
		HasuraDBName:                 "default",
		ApplyPostgresMigrations:      true,
		PostgresMigrationsSource:     "postgres://postgres@localhost:5432/postgres",
		S3Endpoint:                   "http://minio:9000",
		S3Region:                     "no-region",
		S3DisableHTTPS:               true,
		S3AccessKey:                  "access",
		S3SecretKey:                  "secret",
		S3Bucket:                     "files",
		S3RootFolder:                 "",
		CORSAllowOrigins:             []string{"*"},
		CORSAllowCredentials:         true,
		CDNCacheControl:              false,
		FastlyService:                "",
		FastlyKey:                    "",
		ClamavServer:                 "",
		ImageTransformerWorkers:      0,
		ImageTransformerMaxDimension: image.DefaultMaxImageDimension,
		ImageTransformerMaxBlurSigma: image.DefaultMaxBlurSigma,
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
			name: "migrations disabled need no source or database name",
			mutate: func(o *Options) {
				o.ApplyPostgresMigrations = false
				o.PostgresMigrationsSource = ""
				o.ApplyHasuraMetadata = false
				o.HasuraDBName = ""
			},
			wantErr: nil,
		},
		{
			name:    "hasura endpoint required",
			mutate:  func(o *Options) { o.HasuraEndpoint = "" },
			wantErr: errHasuraEndpointRequired,
		},
		{
			name:    "hasura admin secret required",
			mutate:  func(o *Options) { o.HasuraAdminSecret = "" },
			wantErr: errHasuraAdminSecretRequired,
		},
		{
			name:    "hasura database name required to apply metadata",
			mutate:  func(o *Options) { o.HasuraDBName = "" },
			wantErr: errHasuraDBNameRequired,
		},
		{
			name:    "postgres source required to apply migrations",
			mutate:  func(o *Options) { o.PostgresMigrationsSource = "" },
			wantErr: errPostgresSourceRequired,
		},
		{
			name:    "S3 bucket required",
			mutate:  func(o *Options) { o.S3Bucket = "" },
			wantErr: errS3BucketRequired,
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

	opts := validTestOptions()
	opts.HasuraEndpoint = ""
	opts.HasuraAdminSecret = ""
	opts.S3Bucket = ""

	err := opts.Validate()

	for _, want := range []error{
		errHasuraEndpointRequired,
		errHasuraAdminSecretRequired,
		errS3BucketRequired,
	} {
		if !errors.Is(err, want) {
			t.Errorf("Validate() = %v, want wrapping %v", err, want)
		}
	}
}

// NewService validates its Options before acquiring anything, so invalid ones
// fail without starting libvips or reaching S3, PostgreSQL or Hasura.
func TestNewServiceRejectsInvalidOptions(t *testing.T) {
	t.Parallel()

	opts := validTestOptions()
	opts.S3Bucket = ""

	svc, err := NewService(context.Background(), opts, slog.New(slog.DiscardHandler))
	if svc != nil {
		t.Fatal("NewService with invalid options returned a service")
	}

	if !errors.Is(err, errS3BucketRequired) {
		t.Fatalf("NewService error = %v, want wrapping %v", err, errS3BucketRequired)
	}
}

// runOptionsFromCommand resolves args against the serve command's flags, with
// their environment sources cleared, and returns the Options they map to.
func runOptionsFromCommand(t *testing.T, args ...string) Options {
	t.Helper()

	var opts Options

	flags := CommandServe().Flags
	for _, flag := range flags {
		clearFlagSourcesForTest(t, flag)
	}

	cmd := &cli.Command{
		Name:  "serve",
		Flags: flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			opts = OptionsFromCommand(cmd)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return opts
}

func clearFlagSourcesForTest(t *testing.T, flag cli.Flag) {
	t.Helper()

	switch typedFlag := flag.(type) {
	case *cli.BoolFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.IntFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.FloatFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringSliceFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	default:
		t.Fatalf("clearing env sources for %v: unsupported flag type %T", flag.Names(), flag)
	}
}

func TestOptionsFromCommandDefaults(t *testing.T) {
	t.Parallel()

	got := runOptionsFromCommand(
		t, "--"+flagPostgresMigrationsSource, "postgres://localhost/postgres",
	)

	want := Options{
		Version:                      "",
		PublicURL:                    "http://localhost:8000",
		APIRootPrefix:                "/v1",
		HasuraEndpoint:               "",
		HasuraAdminSecret:            "",
		ApplyHasuraMetadata:          false,
		HasuraDBName:                 "default",
		ApplyPostgresMigrations:      false,
		PostgresMigrationsSource:     "postgres://localhost/postgres",
		S3Endpoint:                   "",
		S3Region:                     "no-region",
		S3DisableHTTPS:               false,
		S3AccessKey:                  "",
		S3SecretKey:                  "",
		S3Bucket:                     "",
		S3RootFolder:                 "",
		CORSAllowOrigins:             []string{"*"},
		CORSAllowCredentials:         false,
		CDNCacheControl:              false,
		FastlyService:                "",
		FastlyKey:                    "",
		ClamavServer:                 "",
		ImageTransformerWorkers:      0,
		ImageTransformerMaxDimension: image.DefaultMaxImageDimension,
		ImageTransformerMaxBlurSigma: image.DefaultMaxBlurSigma,
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("OptionsFromCommand() = %+v\nwant %+v", got, want)
	}
}

func TestOptionsFromCommandFlags(t *testing.T) {
	t.Parallel()

	got := runOptionsFromCommand(
		t,
		"--"+flagPublicURL, "https://storage.example.com",
		"--"+flagAPIRootPrefix, "/v2",
		"--"+flagHasuraEndpoint, "http://hasura:8080/v1",
		"--"+flagHasuraAdminSecret, "admin",
		"--"+flagHasuraMetadata,
		"--"+flagHasuraDBName, "main",
		"--"+flagPostgresMigrations,
		"--"+flagPostgresMigrationsSource, "postgres://localhost/postgres",
		"--"+flagS3Endpoint, "http://minio:9000",
		"--"+flagS3Region, "eu-central-1",
		"--"+flagS3DisableHTTPS,
		"--"+flagS3AccessKey, "access",
		"--"+flagS3SecretKey, "secret",
		"--"+flagS3Bucket, "files",
		"--"+flagS3RootFolder, "root",
		"--"+flagCorsAllowOrigins, "https://app.example.com",
		"--"+flagCorsAllowOrigins, "https://admin.example.com",
		"--"+flagCorsAllowCredentials,
		"--"+flagCDNCacheControl,
		"--"+flagFastlyService, "fastly-service",
		"--"+flagFastlyKey, "fastly-key",
		"--"+flagClamavServer, "tcp://clamavd:3310",
		"--"+flagImageTransformerWorkers, "4",
		"--"+flagImageTransformerMaxDim, "2048",
		"--"+flagImageTransformerMaxBlur, "12.5",
	)

	want := Options{
		Version:                  "",
		PublicURL:                "https://storage.example.com",
		APIRootPrefix:            "/v2",
		HasuraEndpoint:           "http://hasura:8080/v1",
		HasuraAdminSecret:        "admin",
		ApplyHasuraMetadata:      true,
		HasuraDBName:             "main",
		ApplyPostgresMigrations:  true,
		PostgresMigrationsSource: "postgres://localhost/postgres",
		S3Endpoint:               "http://minio:9000",
		S3Region:                 "eu-central-1",
		S3DisableHTTPS:           true,
		S3AccessKey:              "access",
		S3SecretKey:              "secret",
		S3Bucket:                 "files",
		S3RootFolder:             "root",
		CORSAllowOrigins: []string{
			"https://app.example.com",
			"https://admin.example.com",
		},
		CORSAllowCredentials:         true,
		CDNCacheControl:              true,
		FastlyService:                "fastly-service",
		FastlyKey:                    "fastly-key",
		ClamavServer:                 "tcp://clamavd:3310",
		ImageTransformerWorkers:      4,
		ImageTransformerMaxDimension: 2048,
		ImageTransformerMaxBlurSigma: 12.5,
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("OptionsFromCommand() = %+v\nwant %+v", got, want)
	}

	if err := got.Validate(); err != nil {
		t.Fatalf("fully configured options do not validate: %v", err)
	}
}
