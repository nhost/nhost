package cmd

import (
	"errors"
	"fmt"

	"github.com/urfave/cli/v3"
)

var (
	errHasuraEndpointRequired    = errors.New("HasuraEndpoint is required")
	errHasuraAdminSecretRequired = errors.New("HasuraAdminSecret is required")
	errHasuraDBNameRequired      = errors.New(
		"HasuraDBName is required when ApplyHasuraMetadata is set",
	)
	errPostgresSourceRequired = errors.New(
		"PostgresMigrationsSource is required when ApplyPostgresMigrations is set",
	)
	errS3BucketRequired = errors.New("S3Bucket is required")
)

// Options is everything NewService needs to build storage. It carries no
// listener settings: whoever runs the service owns the listener, so the bind
// address stays with the standalone serve command or the engine.
type Options struct {
	// PublicURL is the externally reachable URL of the service, used to build
	// presigned URLs.
	PublicURL string
	// APIRootPrefix is the path the API is served under, e.g. "/v1".
	APIRootPrefix string

	// HasuraEndpoint is the Hasura base URL; file metadata is read and written
	// through its /graphql endpoint.
	HasuraEndpoint string
	// HasuraAdminSecret authenticates storage to Hasura and authorizes admin
	// requests to storage.
	HasuraAdminSecret string
	// ApplyHasuraMetadata tracks storage's tables and relationships in Hasura
	// at startup, in the database named HasuraDBName.
	ApplyHasuraMetadata bool
	HasuraDBName        string

	// ApplyPostgresMigrations runs storage's schema migrations at startup
	// against PostgresMigrationsSource.
	ApplyPostgresMigrations  bool
	PostgresMigrationsSource string

	// S3Endpoint, S3Region and S3DisableHTTPS locate the object store. An empty
	// region is sent as "no-region", which S3-compatible stores accept.
	S3Endpoint     string
	S3Region       string
	S3DisableHTTPS bool
	// S3AccessKey and S3SecretKey are static credentials. When either is empty
	// the AWS default credential chain is used instead.
	S3AccessKey string
	S3SecretKey string
	// S3Bucket holds every file; S3RootFolder, when set, prefixes their keys.
	S3Bucket     string
	S3RootFolder string

	// CORSAllowOrigins lists the origins allowed cross-origin access. Nil, like
	// "*", allows every origin, even together with CORSAllowCredentials, for
	// backward compatibility.
	CORSAllowOrigins     []string
	CORSAllowCredentials bool

	// CDNCacheControl sets CDN-Cache-Control headers on responses.
	CDNCacheControl bool
	// FastlyService, when set, enables the Fastly middleware, which purges
	// changed files from the CDN using FastlyKey.
	FastlyService string
	FastlyKey     string

	// ClamavServer, when set, scans uploads with ClamAV at this address, e.g.
	// tcp://clamavd:3310.
	ClamavServer string

	// ImageTransformerWorkers bounds concurrent image transformations; 0 uses
	// 2×GOMAXPROCS. ImageTransformerMaxDimension and
	// ImageTransformerMaxBlurSigma bound per-request libvips work; 0 uses the
	// image package defaults.
	ImageTransformerWorkers      int
	ImageTransformerMaxDimension int
	ImageTransformerMaxBlurSigma float64
}

// Validate reports the settings NewService would reject before connecting to
// anything, so a caller running several services can check all of them before
// building any. Settings that can only be checked against a live dependency,
// such as the migrations database or the Hasura endpoint, fail later, if at
// all.
func (o Options) Validate() error {
	var errs []error

	if o.HasuraEndpoint == "" {
		errs = append(errs, errHasuraEndpointRequired)
	}

	if o.HasuraAdminSecret == "" {
		errs = append(errs, errHasuraAdminSecretRequired)
	}

	if o.ApplyHasuraMetadata && o.HasuraDBName == "" {
		errs = append(errs, errHasuraDBNameRequired)
	}

	if o.ApplyPostgresMigrations && o.PostgresMigrationsSource == "" {
		errs = append(errs, errPostgresSourceRequired)
	}

	if o.S3Bucket == "" {
		errs = append(errs, errS3BucketRequired)
	}

	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("invalid storage options: %w", err)
	}

	return nil
}

// optionsFromCommand maps the serve command's flags onto Options. It does not
// validate; NewService does.
func optionsFromCommand(cmd *cli.Command) Options {
	return Options{
		PublicURL:                    cmd.String(flagPublicURL),
		APIRootPrefix:                cmd.String(flagAPIRootPrefix),
		HasuraEndpoint:               cmd.String(flagHasuraEndpoint),
		HasuraAdminSecret:            cmd.String(flagHasuraAdminSecret),
		ApplyHasuraMetadata:          cmd.Bool(flagHasuraMetadata),
		HasuraDBName:                 cmd.String(flagHasuraDBName),
		ApplyPostgresMigrations:      cmd.Bool(flagPostgresMigrations),
		PostgresMigrationsSource:     cmd.String(flagPostgresMigrationsSource),
		S3Endpoint:                   cmd.String(flagS3Endpoint),
		S3Region:                     cmd.String(flagS3Region),
		S3DisableHTTPS:               cmd.Bool(flagS3DisableHTTPS),
		S3AccessKey:                  cmd.String(flagS3AccessKey),
		S3SecretKey:                  cmd.String(flagS3SecretKey),
		S3Bucket:                     cmd.String(flagS3Bucket),
		S3RootFolder:                 cmd.String(flagS3RootFolder),
		CORSAllowOrigins:             cmd.StringSlice(flagCorsAllowOrigins),
		CORSAllowCredentials:         cmd.Bool(flagCorsAllowCredentials),
		CDNCacheControl:              cmd.Bool(flagCDNCacheControl),
		FastlyService:                cmd.String(flagFastlyService),
		FastlyKey:                    cmd.String(flagFastlyKey),
		ClamavServer:                 cmd.String(flagClamavServer),
		ImageTransformerWorkers:      cmd.Int(flagImageTransformerWorkers),
		ImageTransformerMaxDimension: cmd.Int(flagImageTransformerMaxDim),
		ImageTransformerMaxBlurSigma: cmd.Float(flagImageTransformerMaxBlur),
	}
}
