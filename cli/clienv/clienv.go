package clienv

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
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
var sanitizeNameDrop = regexp.MustCompile(`[^a-zA-Z0-9._-]`)

// sanitizeName turns a project name into one docker compose accepts --
// `[a-z0-9][a-z0-9_-]*` -- or into the empty string when the name holds nothing
// compose could be started from. What the empty string means is each caller's
// to decide: WriteProjectName and projectNameFileSource.Lookup refuse a name
// that sanitizes to it, while resolveProjectName passes the raw name on for
// compose to refuse.
//
// A dot becomes a dash rather than being dropped. Dropping it merged names that
// are different projects: `my.app` and `myapp` both became `myapp`, so two
// sibling projects shared one set of containers and one Postgres volume. The
// mapping reduces those collisions rather than removing them -- no mapping into
// compose's narrower alphabet can be one-to-one, and `my.app` and `my-app` now
// land on the same `my-app`.
//
// A name that still leads with a dash or underscore comes back empty rather
// than trimmed into shape, because trimming merged `_myapp` into a neighbouring
// `myapp` and quietly handed it that project's volume.
func sanitizeName(name string) string {
	lowered := strings.ToLower(sanitizeNameDrop.ReplaceAllString(name, ""))

	// Leading dots go before the mapping below, so `.app` stays `app` rather
	// than turning into a `-app` this function would then have to reject.
	lowered = strings.ReplaceAll(strings.TrimLeft(lowered, "."), ".", "-")

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

	return &CliEnv{
		stdout:         cmd.Writer,
		stderr:         cmd.ErrWriter,
		Path:           path,
		authURL:        cmd.String(flagAuthURL),
		graphqlURL:     cmd.String(flagGraphqlURL),
		oauth2ClientID: cmd.String(flagOAuth2ClientID),
		pat:            cmd.String(flagPAT),
		branch:         cmd.String(flagBranch),
		projectName:    resolveProjectName(cmd, path),
		nhclient:       nil,
		nhpublicclient: nil,
		localSubdomain: cmd.String(flagLocalSubdomain),
	}
}

// resolveProjectName picks the docker compose project name, in the order
// --project-name, NHOST_PROJECT_NAME, the recorded nhost/project-name, and
// finally the working directory name the flag defaults to.
//
// The recorded name is read here rather than as a flag ValueSource because a
// source runs during parsing, before --nhost-folder is resolved, and so would
// only ever find ./nhost/project-name. Reading it against the resolved path is
// what lets `nhost up --nhost-folder backend/nhost` reach the same project the
// backend directory records, instead of falling back to the directory name and
// bringing up a second set of containers and a second Postgres volume.
//
// A name sanitizeName can make nothing of is passed on raw instead of as the
// empty string, because compose reads an empty -p as no -p at all: it names the
// project after --project-directory and normalises that name by trimming the
// very leading `_` and `-` this package refuses to trim, so a directory named
// `_myapp` silently took over `myapp`'s containers and Postgres volume. Handing
// compose the raw name gets the name refused out loud instead.
func resolveProjectName(cmd *cli.Command, path *PathStructure) string {
	// IsSet covers both the flag and NHOST_PROJECT_NAME: a value taken from an
	// env source marks the flag as set too.
	if !cmd.IsSet(flagProjectName) {
		src := &projectNameFileSource{path: path.ProjectNameFile()}
		if name, found := src.Lookup(); found {
			return name
		}
	}

	name := cmd.String(flagProjectName)
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
