package clienv

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

func sanitizeName(name string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	return strings.ToLower(re.ReplaceAllString(name, ""))
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

	return &CliEnv{
		stdout: cmd.Writer,
		stderr: cmd.ErrWriter,
		Path: NewPathStructure(
			cwd,
			cmd.String(flagRootFolder),
			cmd.String(flagDotNhostFolder),
			cmd.String(flagNhostFolder),
		),
		authURL:        cmd.String(flagAuthURL),
		graphqlURL:     cmd.String(flagGraphqlURL),
		oauth2ClientID: cmd.String(flagOAuth2ClientID),
		pat:            cmd.String(flagPAT),
		branch:         cmd.String(flagBranch),
		projectName:    sanitizeName(cmd.String(flagProjectName)),
		nhclient:       nil,
		nhpublicclient: nil,
		localSubdomain: cmd.String(flagLocalSubdomain),
	}
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
