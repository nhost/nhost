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
// target a locally built CLI + engine image.
//
// Run it with, e.g.:
//
//	E2E_CLI_BIN=/tmp/nhostcli \
//	E2E_WORKDIR=/home/me/work/nhost \
//	E2E_MODE=engine \
//	E2E_CONFIGSERVER_IMAGE=cli:0.0.0-dev \
//	go test -tags e2e -run TestE2E -timeout 20m ./cli/e2e/
//
// In engine mode the image tag defaults to the CLI/schema default; set
// E2E_ENGINE_VERSION to pin a specific locally built nhost/engine:<version>.
package e2e_test

import (
	"bytes"
	"context"
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
	"regexp"
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
		t.Skip("E2E_CLI_BIN not set; skipping e2e (build the CLI and set E2E_CLI_BIN)")
	}

	workdir := os.Getenv("E2E_WORKDIR")
	if workdir == "" {
		workdir = t.TempDir()
	}

	mode := os.Getenv("E2E_MODE")
	if mode == "" {
		mode = "standalone"
	}

	if mode != "standalone" && mode != "engine" {
		t.Fatalf("E2E_MODE must be 'standalone' or 'engine', got %q", mode)
	}

	cfg := envConfig{
		cliBin:          cliBin,
		workdir:         workdir,
		mode:            mode,
		httpPort:        envOr("E2E_HTTP_PORT", "8443"),
		postgresPort:    envOr("E2E_POSTGRES_PORT", "5434"),
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

//nolint:paralleltest // The suite binds fixed ports and manages one shared Docker stack.
func TestE2E(t *testing.T) {
	env := loadEnv(t)

	projectDir, err := os.MkdirTemp( //nolint:usetesting // Must honor Docker-mountable E2E_WORKDIR.
		env.workdir,
		"nhost-e2e-*",
	)
	if err != nil {
		t.Fatalf("failed to create project dir under %q: %v", env.workdir, err)
	}

	projectDir, err = normalizeProjectDir(projectDir)
	if err != nil {
		t.Fatalf("failed to normalize project dir: %v", err)
	}

	t.Logf("project dir: %s (mode=%s)", projectDir, env.mode)

	if !env.keep {
		t.Cleanup(func() { _ = os.RemoveAll(projectDir) })
	}

	runCLI(t, env, projectDir, "init")

	adminSecret := patchConfig(t, env, projectDir)

	// Register teardown before bringing anything up: `nhost up` starts the
	// compose stack before migrations/metadata, so even a partial boot must be
	// torn down. Cleanups run LIFO: the failure-only log dump registered below
	// runs first, then teardown (or the E2E_KEEP notice), and the projectDir
	// removal registered above runs last when enabled. Cleanup commands use
	// background-derived contexts because t.Context() is canceled before cleanup.
	if env.keep {
		t.Cleanup(func() {
			t.Logf("E2E_KEEP set; leaving environment running at %s", projectDir)
		})
	} else {
		t.Cleanup(func() {
			downCtx, cancel := context.WithTimeout(context.Background(), cleanupTimeout)
			defer cancel()

			down := cliCmd(downCtx, env, projectDir, "down", "--volumes")
			if out, err := down.CombinedOutput(); err != nil {
				if errors.Is(downCtx.Err(), context.DeadlineExceeded) {
					t.Logf("`nhost down` timed out after %s\n%s", cleanupTimeout, tail(out, 20))

					return
				}

				t.Logf("`nhost down` failed: %v\n%s", err, tail(out, 20))
			}
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

		if errors.Is(logsCtx.Err(), context.DeadlineExceeded) {
			t.Logf("`nhost logs` timed out after %s", cleanupTimeout)
		} else if err != nil {
			t.Logf("`nhost logs` failed: %v", err)
		}

		t.Logf("service logs (mode=%s):\n%s", env.mode, out)
	})

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

	upWriter := io.MultiWriter(os.Stdout, &upOutput)
	up.Stdout = upWriter
	up.Stderr = upWriter

	t.Logf("booting: %s", strings.Join(up.Args, " "))

	if err := up.Run(); err != nil {
		if errors.Is(upCtx.Err(), context.DeadlineExceeded) {
			t.Fatalf(
				"`nhost up` timed out after %s (mode=%s)\n%s",
				upTimeout,
				env.mode,
				tail(upOutput.Bytes(), 40),
			)
		}

		t.Fatalf("`nhost up` failed (mode=%s): %v\n%s", env.mode, err, tail(upOutput.Bytes(), 40))
	}

	assertComposeTopology(t, env, projectDir)

	c := &client{
		http: &http.Client{
			Timeout: 30 * time.Second,
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

	t.Run("auth", func(t *testing.T) { testAuth(t, c) })
	t.Run("storage", func(t *testing.T) { testStorage(t, c) })
	t.Run("graphql", func(t *testing.T) { testGraphQL(t, c) })
}

// ---- auth ----------------------------------------------------------------

func testAuth(t *testing.T, c *client) {
	t.Helper()

	email := fmt.Sprintf("e2e-%d@example.com", time.Now().UnixNano())

	const password = "Str0ngPassw0rd"

	signupTok := c.authEmailPassword(t, "signup", email, password)
	if !looksLikeJWT(signupTok) {
		t.Fatalf(
			"signup did not return a JWT access token: len=%d segments=%d empty=%t",
			len(signupTok),
			len(strings.Split(signupTok, ".")),
			signupTok == "",
		)
	}

	t.Logf("signup issued JWT (len=%d)", len(signupTok))

	signinTok := c.authEmailPassword(t, "signin", email, password)
	if !looksLikeJWT(signinTok) {
		t.Fatalf(
			"signin did not return a JWT access token: len=%d segments=%d empty=%t",
			len(signinTok),
			len(strings.Split(signinTok, ".")),
			signinTok == "",
		)
	}

	t.Logf("signin issued JWT (len=%d)", len(signinTok))
}

func (c *client) authEmailPassword(t *testing.T, action, email, password string) string {
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

	return payload.Session.AccessToken
}

// ---- storage -------------------------------------------------------------

func testStorage(t *testing.T, c *client) {
	t.Helper()

	content := fmt.Appendf(nil, "hello-engine-e2e-%d", time.Now().UnixNano())

	id := c.uploadFile(t, "e2e.txt", content)
	t.Logf("uploaded file id=%s", id)

	status, resp, respContentType := c.do(
		t,
		http.MethodGet,
		c.url("storage", "/v1/files/"+id),
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
		t.Fatalf(
			"downloaded content mismatch: got %q (%d bytes) want %q (%d bytes)",
			truncate(redactResponseBody(resp, respContentType)),
			len(resp),
			content,
			len(content),
		)
	}

	t.Logf("downloaded %d bytes, content matches", len(resp))
}

func (c *client) uploadFile(t *testing.T, name string, content []byte) string {
	t.Helper()

	var buf bytes.Buffer

	w := multipart.NewWriter(&buf)
	_ = w.WriteField("bucket-id", "default")

	fw, err := w.CreateFormFile("file[]", name)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}

	if _, err := fw.Write(content); err != nil {
		t.Fatalf("write form file: %v", err)
	}

	_ = w.Close()

	status, resp, respContentType := c.do(
		t,
		http.MethodPost,
		c.url("storage", "/v1/files"),
		c.adminHeaders(),
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
			ID string `json:"id"`
		} `json:"processedFiles"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil || len(payload.ProcessedFiles) == 0 {
		t.Fatalf(
			"upload: cannot decode processedFiles: %v\n%s",
			err,
			truncate(redactResponseBody(resp, respContentType)),
		)
	}

	return payload.ProcessedFiles[0].ID
}

// ---- graphql -------------------------------------------------------------

func testGraphQL(t *testing.T, c *client) {
	t.Helper()

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
	cliStepTimeout = 2 * time.Minute
	upTimeout      = 20 * time.Minute
	cleanupTimeout = 5 * time.Minute
)

func runCLI(t *testing.T, env envConfig, projectDir string, args ...string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(t.Context(), cliStepTimeout)
	defer cancel()

	cmd := cliCmd(ctx, env, projectDir, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			t.Fatalf(
				"`nhost %s` timed out after %s\n%s",
				strings.Join(args, " "),
				cliStepTimeout,
				tail(out, 20),
			)
		}

		t.Fatalf("`nhost %s` failed: %v\n%s", strings.Join(args, " "), err, tail(out, 20))
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
		requiredService   = "storage"
		forbiddenServices = []string{"engine"}
	)
	if env.mode == "engine" {
		requiredService = "engine"
		forbiddenServices = []string{"auth", "storage"}
	}

	if _, ok := compose.Services[requiredService]; !ok {
		t.Fatalf(
			"generated compose topology does not match %s mode: service %q is missing (services: %v)",
			env.mode,
			requiredService,
			slices.Sorted(maps.Keys(compose.Services)),
		)
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

var adminSecretRe = regexp.MustCompile(`HASURA_GRAPHQL_ADMIN_SECRET\s*=\s*['"]([^'"]+)['"]`)

// patchConfig disables email verification (so signup returns a session) and, in
// engine mode, opts into experimental.nhost and strips the per-service
// version/resources from the root auth/storage sections (which the single engine
// binary rejects). The engine reads the same root sections the standalone
// services do, so no config duplication is needed. It returns the admin secret.
func patchConfig(t *testing.T, env envConfig, projectDir string) string {
	t.Helper()

	secretsPath := filepath.Join(projectDir, ".secrets")

	secretsRaw, err := os.ReadFile(secretsPath)
	if err != nil {
		t.Fatalf("read .secrets: %v", err)
	}

	m := adminSecretRe.FindSubmatch(secretsRaw)
	if m == nil {
		t.Fatalf("could not find HASURA_GRAPHQL_ADMIN_SECRET in .secrets")
	}

	adminSecret := string(m[1])

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
		// The single engine binary has one version and one resources block
		// (experimental.nhost), so per-service version/resources for auth and
		// storage are rejected. Strip them from the root sections the engine reads
		// directly.
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

func truncate(s string) string {
	const maxLength = 200

	if len(s) <= maxLength {
		return s
	}

	return s[:maxLength] + "..."
}

func tail(b []byte, lines int) string {
	parts := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
	if len(parts) > lines {
		parts = parts[len(parts)-lines:]
	}

	return strings.Join(parts, "\n")
}
