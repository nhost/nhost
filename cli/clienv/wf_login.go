package clienv

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"golang.org/x/oauth2"
)

const loginTimeout = 5 * time.Minute

func saveCredentials(
	ce *CliEnv,
	creds Credentials,
) error {
	dir := filepath.Dir(ce.Path.AuthFile())
	if !PathExists(dir) {
		if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("failed to create dir: %w", err)
		}
	}

	if err := MarshalFile(creds, ce.Path.AuthFile(), json.Marshal); err != nil {
		return fmt.Errorf("failed to write credentials to file: %w", err)
	}

	return nil
}

func openBrowser(ctx context.Context, url string) error {
	var (
		cmd  string
		args []string //nolint:prealloc
	)

	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}

	args = append(args, url)
	if err := exec.CommandContext(ctx, cmd, args...).Start(); err != nil {
		return fmt.Errorf("failed to open browser: %w", err)
	}

	return nil
}

func generateState() (string, error) {
	const stateBytes = 16

	b := make([]byte, stateBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate state: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

type callbackResult struct {
	code string
	err  error
}

func callbackHandler(
	expectedState string,
	resultCh chan<- callbackResult,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		if errParam := r.URL.Query().Get("error"); errParam != "" {
			desc := r.URL.Query().Get("error_description")
			fmt.Fprintf(w, "Login failed: %s", desc)

			resultCh <- callbackResult{
				code: "",
				err: fmt.Errorf( //nolint:err113
					"oauth2 error: %s: %s",
					errParam,
					desc,
				),
			}

			return
		}

		if r.URL.Query().Get("state") != expectedState {
			fmt.Fprint(w, "Login failed: state mismatch")

			resultCh <- callbackResult{
				code: "",
				err:  errors.New("oauth2 callback state mismatch"), //nolint:err113
			}

			return
		}

		code := r.URL.Query().Get("code")

		fmt.Fprint(w, "Login successful. You may close this window.")

		resultCh <- callbackResult{code: code, err: nil}
	}
}

type callbackServer struct {
	port     int
	resultCh <-chan callbackResult
	server   *http.Server
}

func startCallbackServer(
	ctx context.Context,
	state string,
) (*callbackServer, error) {
	lc := net.ListenConfig{} //nolint:exhaustruct

	listener, err := lc.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("failed to start callback server: %w", err)
	}

	tcpAddr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		listener.Close()

		return nil, errors.New("unexpected listener address type") //nolint:err113
	}

	resultCh := make(chan callbackResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", callbackHandler(state, resultCh))

	srv := &http.Server{ //nolint:exhaustruct
		Handler:           mux,
		ReadHeaderTimeout: time.Second * 10, //nolint:mnd
	}

	go func() {
		if serveErr := srv.Serve(listener); serveErr != nil &&
			!errors.Is(serveErr, http.ErrServerClosed) {
			resultCh <- callbackResult{
				code: "",
				err:  fmt.Errorf("callback server error: %w", serveErr),
			}
		}
	}()

	return &callbackServer{
		port:     tcpAddr.Port,
		resultCh: resultCh,
		server:   srv,
	}, nil
}

func waitForCallback(
	ctx context.Context,
	resultCh <-chan callbackResult,
) (string, error) {
	select {
	case result := <-resultCh:
		if result.err != nil {
			return "", result.err
		}

		return result.code, nil
	case <-time.After(loginTimeout):
		return "", errors.New( //nolint:err113
			"login timed out waiting for browser callback",
		)
	case <-ctx.Done():
		return "", fmt.Errorf(
			"login cancelled: %w",
			ctx.Err(),
		)
	}
}

func (ce *CliEnv) loginOAuth2PKCE(
	ctx context.Context,
) (Credentials, error) {
	authClient, err := ce.NewAuthClient()
	if err != nil {
		return Credentials{}, fmt.Errorf("failed to create auth client: %w", err)
	}

	metadataResp, err := authClient.GetOAuthAuthorizationServerWithResponse(ctx)
	if err != nil {
		return Credentials{}, fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	if metadataResp.JSON200 == nil {
		return Credentials{}, fmt.Errorf( //nolint:err113
			"OAuth2 metadata endpoint returned status %d",
			metadataResp.StatusCode(),
		)
	}

	metadata := metadataResp.JSON200

	verifier := oauth2.GenerateVerifier()

	state, err := generateState()
	if err != nil {
		return Credentials{}, err
	}

	cb, err := startCallbackServer(ctx, state)
	if err != nil {
		return Credentials{}, err
	}
	defer cb.server.Shutdown(ctx) //nolint:errcheck

	oauthCfg := &oauth2.Config{ //nolint:exhaustruct
		ClientID: ce.OAuth2ClientID(),
		Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
			AuthURL:   metadata.AuthorizationEndpoint,
			TokenURL:  metadata.TokenEndpoint,
			AuthStyle: oauth2.AuthStyleInParams,
		},
		RedirectURL: fmt.Sprintf("http://localhost:%d/callback", cb.port),
		Scopes:      []string{"openid", "offline_access", "graphql"},
	}

	authURL := oauthCfg.AuthCodeURL(
		state,
		oauth2.S256ChallengeOption(verifier),
	)

	ce.Infoln("Opening browser to sign in")

	if err := openBrowser(ctx, authURL); err != nil {
		ce.Warnln("Failed to open browser automatically")
	}

	ce.Infoln("If the browser didn't open, visit:\n%s\n", authURL)
	ce.Infoln("Waiting for sign-in to complete\n")

	code, err := waitForCallback(ctx, cb.resultCh)
	if err != nil {
		return Credentials{}, err
	}

	token, err := oauthCfg.Exchange(
		ctx,
		code,
		oauth2.VerifierOption(verifier),
	)
	if err != nil {
		return Credentials{}, fmt.Errorf(
			"failed to exchange authorization code: %w",
			err,
		)
	}

	if token.RefreshToken == "" {
		return Credentials{}, errors.New( //nolint:err113
			"no refresh token received; ensure offline_access scope is requested",
		)
	}

	ce.Infoln("Successfully logged in")

	return Credentials{
		RefreshToken: token.RefreshToken,
	}, nil
}

func (ce *CliEnv) signInWithPAT(
	ctx context.Context,
) (string, error) {
	cl, err := ce.NewAuthClient()
	if err != nil {
		return "", fmt.Errorf("failed to create auth client: %w", err)
	}

	resp, err := cl.SignInPATWithResponse(ctx, auth.SignInPATJSONRequestBody{
		PersonalAccessToken: ce.pat,
	})
	if err != nil {
		return "", fmt.Errorf("failed to sign in with PAT: %w", err)
	}

	if resp.JSON200 == nil || resp.JSON200.Session == nil {
		return "", fmt.Errorf( //nolint:err113
			"unexpected response from PAT sign-in: %s",
			resp.Status(),
		)
	}

	return resp.JSON200.Session.AccessToken, nil
}

func (ce *CliEnv) Login(
	ctx context.Context,
) (Credentials, error) {
	if ce.pat != "" {
		if _, err := ce.signInWithPAT(ctx); err != nil {
			return Credentials{}, err
		}

		ce.Infoln("Successfully authenticated with PAT")

		return Credentials{}, nil //nolint:exhaustruct
	}

	creds, err := ce.loginOAuth2PKCE(ctx)
	if err != nil {
		return creds, err
	}

	if err := saveCredentials(ce, creds); err != nil {
		return Credentials{}, err
	}

	return creds, nil
}
