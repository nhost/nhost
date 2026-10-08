package clienv

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

// sanitizeNameDrop matches every character a docker compose project name
// cannot hold and that nothing better can be done with than dropping it.
var sanitizeNameDrop = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

// sanitizeName turns a project name into one docker compose accepts --
// `[a-z0-9][a-z0-9_-]*` -- or into the empty string when the name holds nothing
// compose could be started from, which resolveProjectName then refuses.
//
// A dot is dropped, so `example.com` is `examplecom`. Mapping it to a dash
// instead would rename the compose project of every existing project with a
// dot in its name, and with it the Postgres volume, so its next `nhost up`
// would start from an empty database.
//
// A name that still leads with a dash or underscore comes back empty rather
// than trimmed into shape. Trimming would turn `_myapp` into `myapp` and hand
// it a neighbouring project's containers and Postgres volume, so the name is
// reported as unusable and resolveProjectName lets compose refuse it.
func sanitizeName(name string) string {
	lowered := strings.ToLower(sanitizeNameDrop.ReplaceAllString(name, ""))

	if lowered == "" || !isComposeNameStart(lowered[0]) {
		return ""
	}

	return lowered
}

// isComposeNameStart reports whether b can open a docker compose project name.
func isComposeNameStart(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')
}

type CliEnv struct {
	stdout         io.Writer
	stderr         io.Writer
	Path           *PathStructure
	authURL        string
	graphqlURL     string
	oauth2ClientID string
	pat            string
	branch         string
	nhclient       *graphql.Client
	nhpublicclient *graphql.Client
	projectName    string
	localSubdomain string
}

func New(
	stdout io.Writer,
	stderr io.Writer,
	path *PathStructure,
	authURL string,
	graphqlURL string,
	oauth2ClientID string,
	pat string,
	branch string,
	projectName string,
	localSubdomain string,
) *CliEnv {
	return &CliEnv{
		stdout:         stdout,
		stderr:         stderr,
		Path:           path,
		authURL:        authURL,
		graphqlURL:     graphqlURL,
		oauth2ClientID: oauth2ClientID,
		pat:            pat,
		branch:         branch,
		nhclient:       nil,
		nhpublicclient: nil,
		projectName:    projectName,
		localSubdomain: localSubdomain,
	}
}

func FromCLI(cmd *cli.Command) *CliEnv {
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	path := NewPathStructure(
		cwd,
		cmd.String(flagRootFolder),
		cmd.String(flagDotNhostFolder),
		cmd.String(flagNhostFolder),
	)

	ce := &CliEnv{
		stdout:         cmd.Writer,
		stderr:         cmd.ErrWriter,
		Path:           path,
		authURL:        cmd.String(flagAuthURL),
		graphqlURL:     cmd.String(flagGraphqlURL),
		oauth2ClientID: cmd.String(flagOAuth2ClientID),
		pat:            cmd.String(flagPAT),
		branch:         cmd.String(flagBranch),
		projectName:    "",
		nhclient:       nil,
		nhpublicclient: nil,
		localSubdomain: cmd.String(flagLocalSubdomain),
	}
	ce.projectName = ce.resolveProjectName(cmd)

	return ce
}

// resolveProjectName picks the docker compose project name, in the order
// --project-name, NHOST_PROJECT_NAME, and finally the working directory name.
// A blank flag or env value names no project, so it falls through like an unset
// one.
//
// A name sanitizeName can make nothing of is passed on raw instead of as the
// empty string, because compose reads an empty -p as no -p at all: it names the
// project after --project-directory and normalises that name on the way,
// trimming the very leading `_` and `-` this package refuses to trim. A
// directory holding nothing a name can be made of could therefore come up on
// the name a sibling project is already using. Handing compose the raw name
// gets it refused out loud instead.
//
// A directory already named `_myapp` is unaffected: the name survived
// sanitizing before this too, and compose refused it then as it does now.
func (ce *CliEnv) resolveProjectName(cmd *cli.Command) string {
	// IsSet covers both the flag and NHOST_PROJECT_NAME: a value taken from an
	// env source marks the flag as set too.
	name := cmd.String(flagProjectName)
	if !cmd.IsSet(flagProjectName) || strings.TrimSpace(name) == "" {
		name = filepath.Base(ce.Path.WorkingDir())
	}

	if sanitized := sanitizeName(name); sanitized != "" {
		return sanitized
	}

	return name
}

func (ce *CliEnv) ProjectName() string {
	return ce.projectName
}

func (ce *CliEnv) LocalSubdomain() string {
	return ce.localSubdomain
}

func (ce *CliEnv) AuthURL() string {
	return ce.authURL
}

func (ce *CliEnv) GraphqlURL() string {
	return ce.graphqlURL
}

func (ce *CliEnv) OAuth2ClientID() string {
	return ce.oauth2ClientID
}

func (ce *CliEnv) PAT() string {
	return ce.pat
}

func (ce *CliEnv) Branch() string {
	return ce.branch
}

func (ce *CliEnv) NewAuthClient() (*auth.ClientWithResponses, error) {
	cl, err := auth.NewClientWithResponses(
		ce.authURL,
		auth.WithHTTPClient(nhostclient.NewRetryDoer(nil)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create auth client: %w", err)
	}

	return cl, nil
}

func (ce *CliEnv) FetchOAuth2Metadata(
	ctx context.Context,
) (*auth.OAuth2DiscoveryResponse, error) {
	authClient, err := ce.NewAuthClient()
	if err != nil {
		return nil, err
	}

	metadataResp, err := authClient.GetOAuthAuthorizationServerWithResponse(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	if metadataResp.JSON200 == nil {
		return nil, fmt.Errorf( //nolint:err113
			"OAuth2 metadata endpoint returned status %d",
			metadataResp.StatusCode(),
		)
	}

	return metadataResp.JSON200, nil
}

func (ce *CliEnv) NewCloudInterceptor(
	ctx context.Context,
) (func(context.Context, *http.Request) error, error) {
	if pat := ce.PAT(); pat != "" {
		cl, err := ce.NewAuthClient()
		if err != nil {
			return nil, fmt.Errorf("failed to create auth client: %w", err)
		}

		return nhostclient.WithPAT(cl, pat), nil
	}

	creds, err := ce.Credentials()
	if err != nil {
		return nil, fmt.Errorf(
			"failed to load credentials (run `nhost login` first): %w",
			err,
		)
	}

	if creds.OAuth2RefreshToken != "" {
		return ce.newOAuth2CloudInterceptor(ctx, creds)
	}

	return ce.newRefreshTokenCloudInterceptor(ctx, creds)
}

func (ce *CliEnv) newOAuth2CloudInterceptor(
	ctx context.Context,
	creds Credentials,
) (func(context.Context, *http.Request) error, error) {
	metadata, err := ce.FetchOAuth2Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	src := auth.NewRotatingTokenSource(
		ctx,
		metadata.TokenEndpoint,
		ce.OAuth2ClientID(),
		creds.OAuth2RefreshToken,
	)
	baseInterceptor := nhostclient.WithOAuth2RefreshToken(src)

	return func(ctx context.Context, req *http.Request) error {
		if err := baseInterceptor(ctx, req); err != nil {
			return err
		}

		if rt := src.GetRefreshToken(); rt != creds.OAuth2RefreshToken {
			creds.OAuth2RefreshToken = rt
			_ = saveCredentials(ce, creds)
		}

		return nil
	}, nil
}

func (ce *CliEnv) newRefreshTokenCloudInterceptor(
	_ context.Context,
	creds Credentials,
) (func(context.Context, *http.Request) error, error) {
	cl, err := ce.NewAuthClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create auth client: %w", err)
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(cl, creds.RefreshToken)

	return func(ctx context.Context, req *http.Request) error {
		if err := interceptor.Intercept(ctx, req); err != nil {
			return err //nolint:wrapcheck // error is already wrapped by Intercept
		}

		if rt := interceptor.GetRefreshToken(); rt != creds.RefreshToken {
			creds.RefreshToken = rt
			_ = saveCredentials(ce, creds)
		}

		return nil
	}, nil
}

func (ce *CliEnv) GetNhostClient(ctx context.Context) (*graphql.Client, error) {
	if ce.nhclient == nil {
		accessToken, err := ce.LoadSession(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to load session: %w", err)
		}

		ce.nhclient = graphql.NewClient(
			nhostclient.NewRetryDoer(nil),
			ce.graphqlURL,
			&clientv2.Options{}, //nolint:exhaustruct
			graphql.WithAccessToken(accessToken),
		)
	}

	return ce.nhclient, nil
}

func (ce *CliEnv) GetNhostPublicClient() (*graphql.Client, error) {
	if ce.nhpublicclient == nil {
		ce.nhpublicclient = graphql.NewClient(
			nhostclient.NewRetryDoer(nil),
			ce.graphqlURL,
			&clientv2.Options{}, //nolint:exhaustruct
		)
	}

	return ce.nhpublicclient, nil
}
