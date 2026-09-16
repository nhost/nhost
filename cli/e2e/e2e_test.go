//go:build e2e

// Package e2e_test contains black-box end-to-end tests that boot a real `nhost up`
// development environment and exercise auth, storage and GraphQL through the
// public ingress. The same assertions run against a standalone environment
// (individual auth/storage/graphql containers) and against the bundled engine
// (experimental.nhost), so a passing run in both modes proves the engine
// behaves like the standalone services.
//
// The suite is guarded by the `e2e` build tag and driven by environment
// variables (see envConfig) so it never runs as part of `go test ./...` and can
// target a locally built CLI + engine image. The host also needs Docker daemon
// access and registry egress for any stack images not already cached locally.
//
// Run it with, e.g.:
//
//	E2E_CLI_BIN=/tmp/nhostcli \
//	E2E_WORKDIR=/home/me/work/nhost \
//	E2E_MODE=engine \
//	E2E_CONFIGSERVER_IMAGE=cli:0.0.0-dev \
//	go test -tags e2e -run TestE2E -timeout 30m ./cli/e2e/
//
// The 30-minute outer timeout exceeds the 27-minute internal worst-case budget:
// 4m stale-stack reclamation + 1m init + 10m up + 30s ownership check +
// 7*30s HTTP requests + 4m logs + 4m down. TestE2E rejects a shorter deadline
// before starting Docker because a go test timeout bypasses all t.Cleanup calls.
// Concurrent runs on one host must set distinct E2E_HTTP_PORT and
// E2E_POSTGRES_PORT pairs; the pair also determines the reclaimable Compose
// project identity. E2E_KEEP prints the exact teardown command and releases the
// harness lock, so the next run using the same pair will reclaim the kept stack
// before starting.
//
// In engine mode the image tag defaults to the CLI/schema default; set
// E2E_ENGINE_VERSION to pin a specific locally built nhost/engine:<version>.
package e2e_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	toml "github.com/pelletier/go-toml/v2"
	"gopkg.in/yaml.v3"
)

func loadEnv(t *testing.T) envConfig {
	t.Helper()

	cliBin := os.Getenv("E2E_CLI_BIN")
	if cliBin == "" {
		t.Fatal("E2E_CLI_BIN not set; build the CLI and set E2E_CLI_BIN")
	}

	mode := os.Getenv("E2E_MODE")
	if mode == "" {
		mode = "standalone"
	}

	if mode != "standalone" && mode != "engine" {
		t.Fatalf("E2E_MODE must be 'standalone' or 'engine', got %q", mode)
	}

	httpPort := requirePort(t, "E2E_HTTP_PORT", envOr("E2E_HTTP_PORT", "8443"))
	postgresPort := requirePort(t, "E2E_POSTGRES_PORT", envOr("E2E_POSTGRES_PORT", "5434"))

	cfg := envConfig{
		cliBin:          cliBin,
		workdir:         os.Getenv("E2E_WORKDIR"),
		mode:            mode,
		httpPort:        httpPort,
		postgresPort:    postgresPort,
		projectName:     composeProjectName(httpPort, postgresPort),
		configserverImg: os.Getenv("E2E_CONFIGSERVER_IMAGE"),
		subdomain:       envOr("E2E_SUBDOMAIN", "local"),
		keep:            os.Getenv("E2E_KEEP") != "",
	}

	return cfg
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}

	return def
}

//nolint:paralleltest // The suite binds host ports and manages one Docker stack per port pair.
func TestE2E(t *testing.T) {
	env := loadEnv(t)
	requireSuiteDeadline(t)

	env, projectDir, releasePorts := prepareHarness(t, env)

	runCLI(t, env, projectDir, "init")

	copyExampleMetadata(t, projectDir)
	adminSecret := patchConfig(t, env, projectDir)

	// Register teardown before bringing anything up: `nhost up` starts the
	// compose stack before migrations/metadata, so even a partial boot must be
	// torn down. Cleanups run LIFO: the failure-only log dump registered below
	// runs first, then teardown (or the E2E_KEEP notice), and the projectDir
	// removal registered above runs last when enabled. Cleanup commands use
	// background-derived contexts because t.Context() is canceled before cleanup.
	if env.keep {
		t.Cleanup(func() {
			t.Logf(
				"E2E_KEEP set; leaving environment running at %s\nRecovery command: %s",
				projectDir,
				keepRecoveryCommand(env, projectDir),
			)
		})
	} else {
		t.Cleanup(func() {
			tearDownComposeProject(t, env, projectDir)
		})
	}

	t.Cleanup(func() {
		if !t.Failed() {
			return
		}

		logsCtx, cancel := context.WithTimeout(context.Background(), cleanupTimeout)
		defer cancel()

		logs := cliCmd(logsCtx, env, projectDir, "logs", "--tail=200", "--no-color")
		out, err := logs.CombinedOutput()

		switch {
		case errors.Is(logsCtx.Err(), context.DeadlineExceeded):
			t.Logf("`nhost logs` timed out after %s", cleanupTimeout)
		case err != nil:
			t.Logf("`nhost logs` failed: %v", err)
		case bytes.Contains(out, []byte(logsFailureText)):
			t.Logf("`nhost logs` reported a swallowed Docker failure")
		}

		t.Logf(
			"service logs (mode=%s; capped at %d lines/%d bytes):\n%s",
			env.mode,
			serviceLogOutputLines,
			serviceLogOutputBytes,
			redactedBoundedTail(out, serviceLogOutputLines, serviceLogOutputBytes),
		)
	})

	if err := releasePorts(); err != nil {
		t.Fatalf("release reserved host ports before `nhost up`: %v", err)
	}

	// Bring the environment up, streaming progress while retaining a failure tail.
	upCtx, cancelUp := context.WithTimeout(t.Context(), upTimeout)
	defer cancelUp()

	up := cliCmd(
		upCtx,
		env,
		projectDir,
		"up",
		"--http-port",
		env.httpPort,
		"--postgres-port",
		env.postgresPort,
	)

	var upOutput bytes.Buffer

	upStream := newRedactingLineWriter(os.Stdout)
	upWriter := io.MultiWriter(&upOutput, upStream)
	up.Stdout = upWriter
	up.Stderr = upWriter

	t.Logf("booting: %s", strings.Join(up.Args, " "))

	upErr := up.Run()

	if err := upStream.Flush(); err != nil {
		t.Errorf("flush redacted `nhost up` output: %v", err)
	}

	if upErr != nil {
		if errors.Is(upCtx.Err(), context.DeadlineExceeded) {
			t.Fatalf(
				"`nhost up` timed out after %s (mode=%s)\n%s",
				upTimeout,
				env.mode,
				redactedTail(upOutput.Bytes(), 40),
			)
		}

		t.Fatalf(
			"`nhost up` failed (mode=%s): %v\n%s",
			env.mode,
			upErr,
			redactedTail(upOutput.Bytes(), 40),
		)
	}

	if bytes.Contains(upOutput.Bytes(), []byte(upFailurePrompt)) {
		t.Fatalf(
			"`nhost up` reported a swallowed startup failure:\n%s",
			redactedTail(upOutput.Bytes(), 40),
		)
	}

	for _, warning := range []string{noMigrationsWarning, noMetadataWarning} {
		if bytes.Contains(upOutput.Bytes(), []byte(warning)) {
			t.Fatalf(
				"`nhost up` skipped required project state (%q):\n%s",
				warning,
				redactedTail(upOutput.Bytes(), 40),
			)
		}
	}

	assertComposeTopology(t, env, projectDir)
	assertComposeProjectOwnsPorts(t, env.projectName, env.httpPort, env.postgresPort)

	c := &client{
		http: &http.Client{
			Timeout: httpRequestTimeout,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					// Local stack uses a self-signed certificate.
					InsecureSkipVerify: true,
				},
			},
		},
		subdomain: env.subdomain,
		port:      env.httpPort,
		admin:     adminSecret,
	}

	var auth authSession
	if !t.Run("auth", func(t *testing.T) { auth = runAuthScenario(t, c) }) {
		t.FailNow()
	}

	t.Run("storage", func(t *testing.T) {
		runStorageScenario(t, c, auth.accessToken, auth.userID)
	})
	t.Run("graphql", func(t *testing.T) {
		runGraphQLScenario(t, c, auth.accessToken, auth.userID)
	})
}

// ---- auth ----------------------------------------------------------------

type authSession struct {
	accessToken string
	userID      string
}

//nolint:thelper // This is the auth subtest body; marking it as a helper hides assertion locations.
func runAuthScenario(
	t *testing.T,
	c *client,
) authSession {
	email := fmt.Sprintf("e2e-%d@example.com", time.Now().UnixNano())

	const password = "Str0ngPassw0rd"

	signup := c.authEmailPassword(t, "signup", email, password)
	assertAuthSession(t, "signup", signup)

	signin := c.authEmailPassword(t, "signin", email, password)
	assertAuthSession(t, "signin", signin)

	if signin.userID != signup.userID {
		t.Fatalf("signin user id %q does not match signup user id %q", signin.userID, signup.userID)
	}

	return authSession{accessToken: signin.accessToken, userID: signup.userID}
}

func assertAuthSession(t *testing.T, action string, session authSession) {
	t.Helper()

	if !looksLikeJWT(session.accessToken) {
		t.Fatalf(
			"%s did not return a JWT access token: len=%d segments=%d empty=%t",
			action,
			len(session.accessToken),
			len(strings.Split(session.accessToken, ".")),
			session.accessToken == "",
		)
	}

	if session.userID == "" {
		t.Fatalf("%s did not return a user id", action)
	}

	t.Logf(
		"%s issued JWT (len=%d) for user id=%s",
		action,
		len(session.accessToken),
		session.userID,
	)
}

func (c *client) authEmailPassword(t *testing.T, action, email, password string) authSession {
	t.Helper()

	body, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		t.Fatalf("marshal %s request: %v", action, err)
	}

	status, resp, respContentType := c.do(
		t,
		http.MethodPost,
		c.url("auth", "/v1/"+action+"/email-password"),
		nil,
		"application/json",
		body,
	)
	if status != http.StatusOK {
		t.Fatalf(
			"%s returned HTTP %d: %s",
			action,
			status,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	var payload struct {
		Session struct {
			AccessToken string `json:"accessToken"`
			User        struct {
				ID string `json:"id"`
			} `json:"user"`
		} `json:"session"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil {
		t.Fatalf(
			"%s: cannot decode session payload: %v\n%s",
			action,
			err,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	outputScrubber.add(payload.Session.AccessToken)

	return authSession{accessToken: payload.Session.AccessToken, userID: payload.Session.User.ID}
}

// ---- storage -------------------------------------------------------------

//nolint:thelper // This is the storage subtest body; marking it as a helper hides assertion locations.
func runStorageScenario(
	t *testing.T,
	c *client,
	accessToken string,
	userID string,
) {
	content := fmt.Appendf(nil, "hello-engine-e2e-%d", time.Now().UnixNano())

	adminFile := c.uploadFile(t, "e2e.txt", content, c.adminHeaders())
	t.Logf("uploaded file as admin id=%s", adminFile.id)

	status, resp, respContentType := c.do(
		t,
		http.MethodGet,
		c.url("storage", "/v1/files/"+adminFile.id),
		c.adminHeaders(),
		"",
		nil,
	)
	if status != http.StatusOK {
		t.Fatalf(
			"download returned HTTP %d: %s",
			status,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	if !bytes.Equal(resp, content) {
		t.Fatalf("downloaded content mismatch: %s", byteMismatchSummary(resp, content))
	}

	t.Logf("downloaded %d bytes as admin, content matches", len(resp))

	userFile := c.uploadFile(
		t,
		"user-e2e.txt",
		fmt.Appendf(nil, "hello-user-e2e-%d", time.Now().UnixNano()),
		c.bearerHeaders(accessToken),
	)
	if userFile.uploadedByUserID == nil {
		t.Fatalf("signed-in storage upload owner is missing; want signup user id=%q", userID)
	}

	if *userFile.uploadedByUserID != userID {
		t.Fatalf(
			"signed-in storage upload owner = %q, want signup user id=%q",
			*userFile.uploadedByUserID,
			userID,
		)
	}

	t.Logf("uploaded file as signed-in user id=%s", userFile.id)
}

type uploadedFile struct {
	id               string
	uploadedByUserID *string
}

func (c *client) uploadFile(
	t *testing.T,
	name string,
	content []byte,
	headers map[string]string,
) uploadedFile {
	t.Helper()

	var buf bytes.Buffer

	w := multipart.NewWriter(&buf)
	if err := w.WriteField("bucket-id", "default"); err != nil {
		t.Fatalf("write bucket-id field: %v", err)
	}

	fw, err := w.CreateFormFile("file[]", name)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}

	if _, err := fw.Write(content); err != nil {
		t.Fatalf("write form file: %v", err)
	}

	if err := w.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	status, resp, respContentType := c.do(
		t,
		http.MethodPost,
		c.url("storage", "/v1/files"),
		headers,
		w.FormDataContentType(),
		buf.Bytes(),
	)
	if status != http.StatusCreated && status != http.StatusOK {
		t.Fatalf(
			"upload returned HTTP %d: %s",
			status,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	var payload struct {
		ProcessedFiles []struct {
			ID               string  `json:"id"`
			UploadedByUserID *string `json:"uploadedByUserId"`
		} `json:"processedFiles"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil || len(payload.ProcessedFiles) == 0 {
		t.Fatalf(
			"upload: cannot decode processedFiles: %v\n%s",
			err,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	file := payload.ProcessedFiles[0]
	if file.ID == "" {
		t.Fatalf("upload returned an empty file id")
	}

	return uploadedFile{id: file.ID, uploadedByUserID: file.UploadedByUserID}
}

// ---- graphql -------------------------------------------------------------

//nolint:thelper // This is the GraphQL subtest body; marking it as a helper hides assertion locations.
func runGraphQLScenario(
	t *testing.T,
	c *client,
	accessToken string,
	userID string,
) {
	// Admin introspection: works against both Hasura (standalone) and
	// constellation (engine); the public /v1 path is rewritten to the GraphQL
	// endpoint by the ingress in both modes.
	body, err := json.Marshal(map[string]string{"query": "{ __schema { queryType { name } } }"})
	if err != nil {
		t.Fatalf("marshal GraphQL request: %v", err)
	}

	status, resp, respContentType := c.do(
		t,
		http.MethodPost,
		c.url("graphql", "/v1"),
		c.adminHeaders(),
		"application/json",
		body,
	)
	if status != http.StatusOK {
		t.Fatalf(
			"graphql introspection returned HTTP %d: %s",
			status,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	var out struct {
		Data struct {
			Schema struct {
				QueryType struct {
					Name string `json:"name"`
				} `json:"queryType"`
			} `json:"__schema"`
		} `json:"data"`
		// []json.RawMessage treats an absent, null, or empty `errors` field all as
		// length 0, so an explicit `"errors": null`/`[]` does not false-fail (the
		// two GraphQL backends need not serialize an empty error list identically).
		Errors []json.RawMessage `json:"errors"`
	}
	if err := json.Unmarshal(resp, &out); err != nil {
		t.Fatalf(
			"graphql: cannot decode response: %v\n%s",
			err,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	if len(out.Errors) > 0 {
		t.Fatalf(
			"graphql introspection returned errors: %s",
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	if out.Data.Schema.QueryType.Name == "" {
		t.Fatalf(
			"graphql introspection missing query type name: %s",
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	t.Logf("graphql query root type: %s", out.Data.Schema.QueryType.Name)

	assertAuthenticatedGraphQLUser(t, c, accessToken, userID)
}

func assertAuthenticatedGraphQLUser(t *testing.T, c *client, accessToken, userID string) {
	t.Helper()

	body, err := json.Marshal(map[string]string{
		"query": "{ authRefreshTokens { userId } }",
	})
	if err != nil {
		t.Fatalf("marshal authenticated GraphQL request: %v", err)
	}

	status, resp, respContentType := c.do(
		t,
		http.MethodPost,
		c.url("graphql", "/v1"),
		c.bearerHeaders(accessToken),
		"application/json",
		body,
	)
	if status != http.StatusOK {
		t.Fatalf(
			"authenticated graphql query returned HTTP %d: %s",
			status,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	var out struct {
		Data struct {
			RefreshTokens []struct {
				UserID string `json:"userId"`
			} `json:"authRefreshTokens"`
		} `json:"data"`
		Errors []json.RawMessage `json:"errors"`
	}
	if err := json.Unmarshal(resp, &out); err != nil {
		t.Fatalf(
			"authenticated graphql: cannot decode response: %v\n%s",
			err,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	if len(out.Errors) > 0 {
		t.Fatalf(
			"authenticated graphql query returned errors: %s",
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	if len(out.Data.RefreshTokens) == 0 {
		t.Fatalf("authenticated graphql query returned no refresh tokens for user id=%s", userID)
	}

	for _, refreshToken := range out.Data.RefreshTokens {
		if refreshToken.UserID != userID {
			t.Fatalf(
				"authenticated graphql returned user id=%q, want signup user id=%q",
				refreshToken.UserID,
				userID,
			)
		}
	}

	t.Logf(
		"authenticated graphql returned %d refresh token(s) for user id=%s",
		len(out.Data.RefreshTokens),
		userID,
	)
}

// ---- HTTP client ---------------------------------------------------------

type client struct {
	http      *http.Client
	subdomain string
	port      string
	admin     string
}

func (c *client) url(service, path string) string {
	return fmt.Sprintf("https://%s.%s.local.nhost.run:%s%s", c.subdomain, service, c.port, path)
}

func (c *client) adminHeaders() map[string]string {
	return map[string]string{"x-hasura-admin-secret": c.admin}
}

func (c *client) bearerHeaders(accessToken string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + accessToken}
}

func (c *client) do(
	t *testing.T,
	method, url string,
	headers map[string]string,
	contentType string,
	body []byte,
) (int, []byte, string) {
	t.Helper()

	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(t.Context(), method, url, rdr)
	if err != nil {
		t.Fatalf("build request %s %s: %v", method, url, err)
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		t.Fatalf("request %s %s failed: %v", method, url, err)
	}
	defer resp.Body.Close()

	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response %s %s: %v", method, url, err)
	}

	return resp.StatusCode, out, resp.Header.Get("Content-Type")
}

// ---- CLI + config helpers ------------------------------------------------

const (
	cliStepTimeout        = time.Minute
	upTimeout             = 10 * time.Minute
	cleanupTimeout        = 4 * time.Minute
	downCommandTimeout    = 3 * time.Minute
	dockerInspectTimeout  = 30 * time.Second
	httpRequestTimeout    = 30 * time.Second
	httpRequestCount      = 7
	serviceLogOutputLines = 200
	serviceLogOutputBytes = 32 * 1024
	suiteTestTimeout      = 30 * time.Minute

	// suiteTimeoutBudget covers every bounded phase, including failure-only logs
	// and stale-project reclamation. suiteTestTimeout leaves 3m of
	// scheduling/process-exit headroom above this 27m internal maximum.
	suiteTimeoutBudget = cleanupTimeout + cliStepTimeout + upTimeout + dockerInspectTimeout +
		httpRequestCount*httpRequestTimeout + cleanupTimeout + cleanupTimeout
)

func runCLI(t *testing.T, env envConfig, projectDir string, args ...string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(t.Context(), cliStepTimeout)
	defer cancel()

	cmd := cliCmd(ctx, env, projectDir, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		if registerErr := registerProjectSecrets(projectDir); registerErr != nil {
			t.Logf(
				"could not register project secrets before reporting CLI failure: %v",
				registerErr,
			)
		}

		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			t.Fatalf(
				"`nhost %s` timed out after %s\n%s",
				strings.Join(args, " "),
				cliStepTimeout,
				redactedTail(out, 20),
			)
		}

		t.Fatalf(
			"`nhost %s` failed: %v\n%s",
			strings.Join(args, " "),
			err,
			redactedTail(out, 20),
		)
	}
}

func assertComposeTopology(t *testing.T, env envConfig, projectDir string) {
	t.Helper()

	composePath := filepath.Join(projectDir, ".nhost", "docker-compose.yaml")

	raw, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("read generated compose file %s: %v", composePath, err)
	}

	var compose struct {
		Services map[string]any `yaml:"services"`
	}
	if err := yaml.Unmarshal(raw, &compose); err != nil {
		t.Fatalf("unmarshal generated compose file %s: %v", composePath, err)
	}

	var (
		requiredServices  = []string{"graphql", "auth", "storage"}
		forbiddenServices = []string{"engine"}
	)
	if env.mode == "engine" {
		requiredServices = []string{"graphql", "engine"}
		forbiddenServices = []string{"auth", "storage"}
	}

	for _, service := range requiredServices {
		if _, ok := compose.Services[service]; !ok {
			t.Fatalf(
				"generated compose topology does not match %s mode: service %q is missing (services: %v)",
				env.mode,
				service,
				slices.Sorted(maps.Keys(compose.Services)),
			)
		}
	}

	for _, service := range forbiddenServices {
		if _, ok := compose.Services[service]; ok {
			t.Fatalf(
				"generated compose topology does not match %s mode: unexpected service %q (services: %v)",
				env.mode,
				service,
				slices.Sorted(maps.Keys(compose.Services)),
			)
		}
	}
}

// copyExampleMetadata installs only the example metadata that the default
// scratch project can satisfy, so TestE2E exercises metadata apply and the
// post-apply restart without inheriting AI or functions dependencies.
func copyExampleMetadata(t *testing.T, projectDir string) {
	t.Helper()

	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate e2e test source")
	}

	exampleNhostDir := filepath.Join(
		filepath.Dir(thisFile),
		"..",
		"examples",
		"myproject",
		"nhost",
	)

	metadataDir := filepath.Join(projectDir, "nhost", "metadata")
	for _, name := range []string{
		"version.yaml",
		filepath.Join("databases", "databases.yaml"),
	} {
		copyExampleFile(
			t,
			filepath.Join(exampleNhostDir, "metadata", name),
			filepath.Join(metadataDir, name),
		)
	}

	tableFiles := []string{
		"auth_oauth2_auth_requests.yaml",
		"auth_oauth2_authorization_codes.yaml",
		"auth_oauth2_clients.yaml",
		"auth_oauth2_refresh_tokens.yaml",
		"auth_provider_requests.yaml",
		"auth_providers.yaml",
		"auth_refresh_token_types.yaml",
		"auth_refresh_tokens.yaml",
		"auth_roles.yaml",
		"auth_user_providers.yaml",
		"auth_user_roles.yaml",
		"auth_user_security_keys.yaml",
		"auth_users.yaml",
		"public_animals.yaml",
		"storage_buckets.yaml",
		"storage_files.yaml",
		"storage_virus.yaml",
	}
	tablesDir := filepath.Join(metadataDir, "databases", "default", "tables")

	var tableIncludes strings.Builder

	for _, name := range tableFiles {
		source := filepath.Join(
			exampleNhostDir,
			"metadata",
			"databases",
			"default",
			"tables",
			name,
		)
		destination := filepath.Join(tablesDir, name)

		if name == "storage_files.yaml" {
			copyStorageFilesMetadataForE2E(t, source, destination)
		} else {
			copyExampleFile(t, source, destination)
		}

		fmt.Fprintf(&tableIncludes, "- \"!include %s\"\n", name)
	}

	writeExampleFile(t, filepath.Join(tablesDir, "tables.yaml"), []byte(tableIncludes.String()))
	writeExampleFile(t, filepath.Join(metadataDir, "remote_schemas.yaml"), []byte("[]\n"))

	for _, migration := range []string{
		"1684245591231_create_table_public_animals",
		"1753779357316_alter_table_public_animals_add_column_user_id",
		"1753779380523_set_fk_public_animals_user_id",
	} {
		for _, name := range []string{"up.sql", "down.sql"} {
			relativePath := filepath.Join("default", migration, name)
			copyExampleFile(
				t,
				filepath.Join(exampleNhostDir, "migrations", relativePath),
				filepath.Join(projectDir, "nhost", "migrations", relativePath),
			)
		}
	}
}

func copyStorageFilesMetadataForE2E(t *testing.T, source, destination string) {
	t.Helper()

	raw, err := os.ReadFile(source)
	if err != nil {
		t.Fatalf("read example metadata %s: %v", source, err)
	}

	var metadata map[string]any
	if err := yaml.Unmarshal(raw, &metadata); err != nil {
		t.Fatalf("parse example metadata %s: %v", source, err)
	}

	delete(metadata, "event_triggers")
	metadata["insert_permissions"] = []map[string]any{
		{
			"role": "user",
			"permission": map[string]any{
				"check": map[string]any{
					"bucket_id": map[string]any{"_eq": "default"},
				},
				"set": map[string]any{
					"uploaded_by_user_id": "X-Hasura-User-Id",
				},
				"columns": []string{"id", "bucket_id", "name", "size", "mime_type"},
			},
		},
	}

	raw, err = yaml.Marshal(metadata)
	if err != nil {
		t.Fatalf("encode curated metadata %s: %v", source, err)
	}

	writeExampleFile(t, destination, raw)
}

func copyExampleFile(t *testing.T, source, destination string) {
	t.Helper()

	raw, err := os.ReadFile(source)
	if err != nil {
		t.Fatalf("read example fixture %s: %v", source, err)
	}

	writeExampleFile(t, destination, raw)
}

func writeExampleFile(t *testing.T, destination string, content []byte) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		t.Fatalf("create example fixture directory %s: %v", filepath.Dir(destination), err)
	}

	if err := os.WriteFile(destination, content, 0o600); err != nil {
		t.Fatalf("write example fixture %s: %v", destination, err)
	}
}

func TestCopyExampleMetadata(t *testing.T) {
	t.Parallel()

	projectDir := t.TempDir()
	for _, name := range []string{"metadata", filepath.Join("migrations", "default")} {
		if err := os.MkdirAll(filepath.Join(projectDir, "nhost", name), 0o755); err != nil {
			t.Fatalf("create initialized project directory %s: %v", name, err)
		}
	}

	copyExampleMetadata(t, projectDir)

	tests := []struct {
		name string
		path string
	}{
		{
			name: "metadata version",
			path: filepath.Join("metadata", "version.yaml"),
		},
		{
			name: "database metadata",
			path: filepath.Join("metadata", "databases", "databases.yaml"),
		},
		{
			name: "auth table metadata",
			path: filepath.Join(
				"metadata",
				"databases",
				"default",
				"tables",
				"auth_users.yaml",
			),
		},
		{
			name: "storage table metadata",
			path: filepath.Join(
				"metadata",
				"databases",
				"default",
				"tables",
				"storage_files.yaml",
			),
		},
		{
			name: "public table metadata",
			path: filepath.Join(
				"metadata",
				"databases",
				"default",
				"tables",
				"public_animals.yaml",
			),
		},
		{
			name: "empty remote schemas metadata",
			path: filepath.Join("metadata", "remote_schemas.yaml"),
		},
		{
			name: "final companion migration",
			path: filepath.Join(
				"migrations",
				"default",
				"1753779380523_set_fk_public_animals_user_id",
				"up.sql",
			),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if _, err := os.Stat(filepath.Join(projectDir, "nhost", tt.path)); err != nil {
				t.Errorf("expected copied fixture %s: %v", tt.path, err)
			}
		})
	}

	assertCuratedMetadata(t, filepath.Join(projectDir, "nhost", "metadata"))
}

func assertCuratedMetadata(t *testing.T, metadataDir string) {
	t.Helper()

	remoteSchemas, err := os.ReadFile(filepath.Join(metadataDir, "remote_schemas.yaml"))
	if err != nil {
		t.Fatalf("read copied remote schemas metadata: %v", err)
	}

	if strings.TrimSpace(string(remoteSchemas)) != "[]" {
		t.Errorf("remote schemas metadata = %q, want an empty list", remoteSchemas)
	}

	tablesDir := filepath.Join(metadataDir, "databases", "default", "tables")

	tableEntries, err := os.ReadDir(tablesDir)
	if err != nil {
		t.Fatalf("read copied metadata tables: %v", err)
	}

	for _, entry := range tableEntries {
		if strings.HasPrefix(entry.Name(), "graphite_") {
			t.Errorf("copied project-specific Graphite table metadata %s", entry.Name())
		}
	}

	assertStorageUserInsertPermission(t, filepath.Join(tablesDir, "storage_files.yaml"))

	for _, forbidden := range []string{"graphite_", "ai:8090", "NHOST_FUNCTIONS_URL"} {
		err := filepath.WalkDir(
			metadataDir,
			func(path string, entry os.DirEntry, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}

				if entry.IsDir() {
					return nil
				}

				raw, readErr := os.ReadFile(path)
				if readErr != nil {
					return fmt.Errorf("read %s: %w", path, readErr)
				}

				if bytes.Contains(raw, []byte(forbidden)) {
					t.Errorf(
						"copied metadata %s contains forbidden project dependency %q",
						path,
						forbidden,
					)
				}

				return nil
			},
		)
		if err != nil {
			t.Fatalf("inspect copied metadata for %q: %v", forbidden, err)
		}
	}
}

func assertStorageUserInsertPermission(t *testing.T, path string) {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read copied storage files metadata: %v", err)
	}

	var metadata struct {
		InsertPermissions []struct {
			Role       string `yaml:"role"`
			Permission struct {
				Check struct {
					BucketID struct {
						Equal string `yaml:"_eq"`
					} `yaml:"bucket_id"`
				} `yaml:"check"`
				Set struct {
					UploadedByUserID string `yaml:"uploaded_by_user_id"`
				} `yaml:"set"`
				Columns []string `yaml:"columns"`
			} `yaml:"permission"`
		} `yaml:"insert_permissions"`
	}
	if err := yaml.Unmarshal(raw, &metadata); err != nil {
		t.Fatalf("parse copied storage files metadata: %v", err)
	}

	if len(metadata.InsertPermissions) != 1 {
		t.Fatalf("storage insert permissions count = %d, want 1", len(metadata.InsertPermissions))
	}

	permission := metadata.InsertPermissions[0]
	if permission.Role != "user" {
		t.Errorf("storage insert permission role = %q, want user", permission.Role)
	}

	if permission.Permission.Check.BucketID.Equal != "default" {
		t.Errorf(
			"storage insert permission bucket = %q, want default",
			permission.Permission.Check.BucketID.Equal,
		)
	}

	if permission.Permission.Set.UploadedByUserID != "X-Hasura-User-Id" {
		t.Errorf(
			"storage insert permission uploader = %q, want X-Hasura-User-Id",
			permission.Permission.Set.UploadedByUserID,
		)
	}

	gotColumns := slices.Clone(permission.Permission.Columns)
	slices.Sort(gotColumns)

	wantColumns := []string{"bucket_id", "id", "mime_type", "name", "size"}
	if !slices.Equal(gotColumns, wantColumns) {
		t.Errorf(
			"storage insert permission columns = %v, want %v",
			permission.Permission.Columns,
			wantColumns,
		)
	}
}

// patchConfig disables email verification (so signup returns a session) and, in
// engine mode, opts into experimental.nhost and strips explicit per-service
// version/resources from the root auth/storage sections. Non-default overrides
// are rejected once experimental.nhost is enabled; default-valued fields are
// ignored. Stripping them keeps the scratch project from drifting into an
// unsupported combination. It returns the admin secret.
func patchConfig(t *testing.T, env envConfig, projectDir string) string {
	t.Helper()

	secretsPath := filepath.Join(projectDir, ".secrets")

	secrets, err := readAndRegisterSecrets(secretsPath)
	if err != nil {
		t.Fatalf("load .secrets: %v", err)
	}

	adminSecret, ok := secrets["HASURA_GRAPHQL_ADMIN_SECRET"]
	if !ok || adminSecret == "" {
		t.Fatalf("could not find HASURA_GRAPHQL_ADMIN_SECRET in .secrets")
	}

	tomlPath := filepath.Join(projectDir, "nhost", "nhost.toml")

	raw, err := os.ReadFile(tomlPath)
	if err != nil {
		t.Fatalf("read nhost.toml: %v", err)
	}

	var cfg map[string]any
	if err := toml.Unmarshal(raw, &cfg); err != nil {
		t.Fatalf("unmarshal nhost.toml: %v", err)
	}

	// signup should return a session immediately in both modes.
	setNested(cfg, false, "auth", "method", "emailPassword", "emailVerificationRequired")

	if env.mode == "engine" {
		// Non-default per-service version/resources are rejected once
		// experimental.nhost is enabled, while default-valued fields are ignored.
		// Strip them so this scratch project cannot drift into an unsupported
		// combination as defaults evolve.
		for _, svc := range []string{"auth", "storage"} {
			if m, ok := cfg[svc].(map[string]any); ok {
				delete(m, "version")
				delete(m, "resources")
			}
		}
		// Opt into the engine without pinning a version so the CLI/schema default
		// drives the image tag; the local image only needs to match that default.
		// E2E_ENGINE_VERSION overrides it to target a specific locally built tag.
		nhost := map[string]any{}
		if v := os.Getenv("E2E_ENGINE_VERSION"); v != "" {
			nhost["version"] = v
		}

		cfg["experimental"] = map[string]any{"nhost": nhost}
	}

	outBuf := &bytes.Buffer{}
	enc := toml.NewEncoder(outBuf)
	enc.SetIndentTables(true)

	if err := enc.Encode(cfg); err != nil {
		t.Fatalf("marshal nhost.toml: %v", err)
	}

	if err := os.WriteFile(tomlPath, outBuf.Bytes(), 0o600); err != nil {
		t.Fatalf("write nhost.toml: %v", err)
	}

	return adminSecret
}

func registerProjectSecrets(projectDir string) error {
	_, err := readAndRegisterSecrets(filepath.Join(projectDir, ".secrets"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}

	return err
}

func readAndRegisterSecrets(path string) (map[string]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}

	var secrets map[string]string
	if err := toml.Unmarshal(raw, &secrets); err != nil {
		return nil, fmt.Errorf("unmarshalling %s: %w", path, err)
	}

	for _, secret := range secrets {
		outputScrubber.add(secret)
	}

	return secrets, nil
}

// setNested sets a value at a nested key path, creating intermediate maps.
func setNested(m map[string]any, value any, path ...string) {
	cur := m
	for _, k := range path[:len(path)-1] {
		next, ok := cur[k].(map[string]any)
		if !ok {
			next = map[string]any{}
			cur[k] = next
		}

		cur = next
	}

	cur[path[len(path)-1]] = value
}

// ---- misc ----------------------------------------------------------------

func byteMismatchSummary(got, want []byte) string {
	firstDifference := min(len(got), len(want))
	for i := range firstDifference {
		if got[i] != want[i] {
			firstDifference = i

			break
		}
	}

	const contextBytes = 8

	start := max(0, firstDifference-contextBytes)
	gotEnd := min(len(got), firstDifference+contextBytes)
	wantEnd := min(len(want), firstDifference+contextBytes)
	gotHash := sha256.Sum256(got)
	wantHash := sha256.Sum256(want)

	return fmt.Sprintf(
		"got-len=%d want-len=%d first-difference=%d got-sha256=%x want-sha256=%x got-hex[%d:%d]=%x want-hex[%d:%d]=%x",
		len(got),
		len(want),
		firstDifference,
		gotHash,
		wantHash,
		start,
		gotEnd,
		got[start:gotEnd],
		start,
		wantEnd,
		want[start:wantEnd],
	)
}

func truncate(s string) string {
	const maxLength = 200

	if len(s) <= maxLength {
		return s
	}

	return s[:maxLength] + "..."
}
