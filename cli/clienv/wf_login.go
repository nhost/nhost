package clienv

import (
	"context"
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/nhost/cli/nhostclient"
	"github.com/nhost/cli/nhostclient/credentials"
	"github.com/nhost/cli/ssl"
)

func savePAT(
	ce *CliEnv,
	session credentials.Credentials,
) error {
	dir := filepath.Dir(ce.Path.AuthFile())
	if !PathExists(dir) {
		if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("failed to create dir: %w", err)
		}
	}

	if err := MarshalFile(session, ce.Path.AuthFile(), json.Marshal); err != nil {
		return fmt.Errorf("failed to write PAT to file: %w", err)
	}

	return nil
}

func signinHandler(ch chan<- string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ch <- r.URL.Query().Get("refreshToken")

		fmt.Fprintf(w, "You may now close this window.")
	}
}

func openBrowser(ctx context.Context, url string) error {
	var (
		cmd  string
		args []string
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

func getTLSServer() (*http.Server, error) {
	block, _ := pem.Decode(ssl.LocalKeyFile)
	// Parse the PEM data to obtain the private key
	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// Type assert the private key to crypto.PrivateKey
	pk, ok := privateKey.(crypto.PrivateKey)
	if !ok {
		return nil, errors.New( //nolint:err113
			"failed to type assert private key to crypto.PrivateKey",
		)
	}

	block, _ = pem.Decode(ssl.LocalCertFile)

	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	tlsConfig := &tls.Config{ //nolint:exhaustruct
		MinVersion:   tls.VersionTLS12,
		CipherSuites: nil,
		Certificates: []tls.Certificate{
			{ //nolint:exhaustruct
				Certificate: [][]byte{certificate.Raw},
				PrivateKey:  pk,
			},
		},
	}

	return &http.Server{ //nolint:exhaustruct
		Addr:              ":8099",
		TLSConfig:         tlsConfig,
		ReadHeaderTimeout: time.Second * 10, //nolint:mnd
	}, nil
}

func (ce *CliEnv) loginPAT(pat string) credentials.Credentials {
	session := credentials.Credentials{
		ID:                  "",
		PersonalAccessToken: pat,
	}

	return session
}

func (ce *CliEnv) loginEmailPassword(
	ctx context.Context,
	email string,
	password string,
) (credentials.Credentials, error) {
	cl := nhostclient.New(ce.AuthURL(), ce.GraphqlURL())

	var err error

	if email == "" {
		ce.PromptMessage("email: ")

		email, err = ce.PromptInput(false)
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read email: %w", err)
		}
	}

	if password == "" {
		ce.PromptMessage("password: ")
		password, err = ce.PromptInput(true)
		ce.Println("")

		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read password: %w", err)
		}
	}

	ce.Infoln("Authenticating")

	loginResp, err := cl.Login(ctx, email, password)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to login: %w", err)
	}

	session, err := cl.CreatePAT(ctx, loginResp.Session.AccessToken)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to create PAT: %w", err)
	}

	ce.Infoln("Successfully logged in")

	return session, nil
}

func (ce *CliEnv) loginGithub(ctx context.Context) (credentials.Credentials, error) {
	refreshToken := make(chan string)
	http.HandleFunc("/signin", signinHandler(refreshToken))

	go func() {
		server, err := getTLSServer()
		if err != nil {
			log.Fatal(err)
		}

		if err := server.ListenAndServeTLS("", ""); err != nil {
			log.Fatal(err)
		}
	}()

	signinPage := ce.AuthURL() + "/signin/provider/github/?redirectTo=https://local.dashboard.local.nhost.run:8099/signin"
	ce.Infoln("Opening browser to sign-in")

	if err := openBrowser(ctx, signinPage); err != nil {
		return credentials.Credentials{}, err
	}

	ce.Infoln("Waiting for sign-in to complete")

	refreshTokenValue := <-refreshToken

	cl := nhostclient.New(ce.AuthURL(), ce.GraphqlURL())

	refreshTokenResp, err := cl.RefreshToken(ctx, refreshTokenValue)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to get access token: %w", err)
	}

	session, err := cl.CreatePAT(ctx, refreshTokenResp.AccessToken)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to create PAT: %w", err)
	}

	ce.Infoln("Successfully logged in")

	return session, nil
}

func (ce *CliEnv) loginMethod(ctx context.Context) (credentials.Credentials, error) {
	ce.Infoln("Select authentication method:\n1. PAT\n2. Email/Password\n3. Github")
	ce.PromptMessage("method: ")

	method, err := ce.PromptInput(false)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf(
			"failed to read authentication method: %w",
			err,
		)
	}

	var session credentials.Credentials

	switch method {
	case "1":
		ce.PromptMessage("PAT: ")

		pat, err := ce.PromptInput(true)
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read PAT: %w", err)
		}

		session = ce.loginPAT(pat)
	case "2":
		session, err = ce.loginEmailPassword(ctx, "", "")
	case "3":
		session, err = ce.loginGithub(ctx)
	default:
		return ce.loginMethod(ctx)
	}

	return session, err
}

func (ce *CliEnv) verifyEmail(
	ctx context.Context,
	email string,
) error {
	ce.Infoln("Your email address is not verified")

	cl := nhostclient.New(ce.AuthURL(), ce.GraphqlURL())
	if err := cl.VerifyEmail(ctx, email); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	ce.Infoln("A verification email has been sent to %s", email)
	ce.Infoln("Please verify your email address and try again")

	return nil
}

func (ce *CliEnv) Login(
	ctx context.Context,
	pat string,
	email string,
	password string,
) (credentials.Credentials, error) {
	var (
		session credentials.Credentials
		err     error
	)

	switch {
	case pat != "":
		session = ce.loginPAT(pat)
	case email != "" || password != "":
		session, err = ce.loginEmailPassword(ctx, email, password)
	default:
		session, err = ce.loginMethod(ctx)
	}

	var reqErr *nhostclient.RequestError
	if errors.As(err, &reqErr) && reqErr.ErrorCode == "unverified-user" {
		return credentials.Credentials{}, ce.verifyEmail(ctx, email)
	}

	if err != nil {
		return session, err
	}

	if err := savePAT(ce, session); err != nil {
		return credentials.Credentials{}, err
	}

	return session, nil
}
