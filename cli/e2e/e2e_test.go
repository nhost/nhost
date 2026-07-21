//go:build e2e

// Package e2e contains black-box end-to-end tests that boot a real `nhost up`
// development environment and exercise auth, storage and GraphQL through the
// public ingress. The same assertions run against a standalone environment
// (individual auth/storage/graphql containers) and against the bundled engine
// (experimental.engine), so a passing run in both modes proves the engine
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
package e2e

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	toml "github.com/pelletier/go-toml/v2"
)

// defaultEngineVersion mirrors the CLI's default engine image tag; the engine
// image must be present locally as nhost/nhost-engine:<version>.
const defaultEngineVersion = "0.0.1"

type envConfig struct {
	cliBin          string // path to the nhost CLI binary
	workdir         string // parent dir for the scratch project (must be docker-mountable)
	mode            string // "standalone" or "engine"
	httpPort        string
	postgresPort    string
	configserverImg string // optional NHOST_CONFIGSERVER_IMAGE override
	subdomain       string
	keep            bool // skip teardown for debugging
}

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

func TestE2E(t *testing.T) {
	env := loadEnv(t)

	projectDir, err := os.MkdirTemp(env.workdir, "nhost-e2e-*")
	if err != nil {
		t.Fatalf("failed to create project dir under %q: %v", env.workdir, err)
	}
	t.Logf("project dir: %s (mode=%s)", projectDir, env.mode)
	if !env.keep {
		t.Cleanup(func() { _ = os.RemoveAll(projectDir) })
	}

	runCLI(t, env, projectDir, "init")

	adminSecret := patchConfig(t, env, projectDir)

	// Bring the environment up; always tear it down afterwards.
	up := cliCmd(
		env,
		projectDir,
		"up",
		"--http-port",
		env.httpPort,
		"--postgres-port",
		env.postgresPort,
	)
	t.Logf("booting: %s", strings.Join(up.Args, " "))
	if out, err := up.CombinedOutput(); err != nil {
		t.Fatalf("`nhost up` failed (mode=%s): %v\n%s", env.mode, err, tail(out, 40))
	}
	t.Cleanup(func() {
		if env.keep {
			t.Logf("E2E_KEEP set; leaving environment running at %s", projectDir)
			return
		}
		down := cliCmd(env, projectDir, "down", "--volumes")
		if out, err := down.CombinedOutput(); err != nil {
			t.Logf("`nhost down` failed: %v\n%s", err, tail(out, 20))
		}
	})

	c := &client{
		http: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			}, //nolint:gosec // local self-signed
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
	email := fmt.Sprintf("e2e-%d@example.com", time.Now().UnixNano())
	const password = "Str0ngPassw0rd"

	signupTok := c.authEmailPassword(t, "signup", email, password)
	if !looksLikeJWT(signupTok) {
		t.Fatalf("signup did not return a JWT access token: %q", truncate(signupTok, 40))
	}
	t.Logf("signup issued JWT (len=%d)", len(signupTok))

	signinTok := c.authEmailPassword(t, "signin", email, password)
	if !looksLikeJWT(signinTok) {
		t.Fatalf("signin did not return a JWT access token: %q", truncate(signinTok, 40))
	}
	t.Logf("signin issued JWT (len=%d)", len(signinTok))
}

func (c *client) authEmailPassword(t *testing.T, action, email, password string) string {
	t.Helper()

	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	status, resp := c.do(
		t,
		http.MethodPost,
		c.url("auth", "/v1/"+action+"/email-password"),
		nil,
		"application/json",
		body,
	)
	if status != http.StatusOK {
		t.Fatalf("%s returned HTTP %d: %s", action, status, truncate(string(resp), 200))
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
			truncate(string(resp), 200),
		)
	}
	return payload.Session.AccessToken
}

// ---- storage -------------------------------------------------------------

func testStorage(t *testing.T, c *client) {
	content := []byte(fmt.Sprintf("hello-engine-e2e-%d", time.Now().UnixNano()))

	id := c.uploadFile(t, "e2e.txt", content)
	t.Logf("uploaded file id=%s", id)

	status, resp := c.do(
		t,
		http.MethodGet,
		c.url("storage", "/v1/files/"+id),
		c.adminHeaders(),
		"",
		nil,
	)
	if status != http.StatusOK {
		t.Fatalf("download returned HTTP %d: %s", status, truncate(string(resp), 200))
	}
	if !bytes.Equal(resp, content) {
		t.Fatalf("downloaded content mismatch: got %q want %q", resp, content)
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

	status, resp := c.do(
		t,
		http.MethodPost,
		c.url("storage", "/v1/files"),
		c.adminHeaders(),
		w.FormDataContentType(),
		buf.Bytes(),
	)
	if status != http.StatusCreated && status != http.StatusOK {
		t.Fatalf("upload returned HTTP %d: %s", status, truncate(string(resp), 200))
	}

	var payload struct {
		ProcessedFiles []struct {
			ID string `json:"id"`
		} `json:"processedFiles"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil || len(payload.ProcessedFiles) == 0 {
		t.Fatalf("upload: cannot decode processedFiles: %v\n%s", err, truncate(string(resp), 200))
	}
	return payload.ProcessedFiles[0].ID
}

// ---- graphql -------------------------------------------------------------

func testGraphQL(t *testing.T, c *client) {
	// Admin introspection: works against both Hasura (standalone) and
	// constellation (engine); the public /v1 path is rewritten to the GraphQL
	// endpoint by the ingress in both modes.
	body, _ := json.Marshal(map[string]string{"query": "{ __schema { queryType { name } } }"})
	status, resp := c.do(
		t,
		http.MethodPost,
		c.url("graphql", "/v1"),
		c.adminHeaders(),
		"application/json",
		body,
	)
	if status != http.StatusOK {
		t.Fatalf("graphql introspection returned HTTP %d: %s", status, truncate(string(resp), 200))
	}

	var out struct {
		Data struct {
			Schema struct {
				QueryType struct {
					Name string `json:"name"`
				} `json:"queryType"`
			} `json:"__schema"`
		} `json:"data"`
		Errors json.RawMessage `json:"errors"`
	}
	if err := json.Unmarshal(resp, &out); err != nil {
		t.Fatalf("graphql: cannot decode response: %v\n%s", err, truncate(string(resp), 200))
	}
	if len(out.Errors) > 0 {
		t.Fatalf("graphql introspection returned errors: %s", out.Errors)
	}
	if out.Data.Schema.QueryType.Name == "" {
		t.Fatalf("graphql introspection missing query type name: %s", truncate(string(resp), 200))
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
) (int, []byte) {
	t.Helper()

	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, url, rdr)
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
	return resp.StatusCode, out
}

// ---- CLI + config helpers ------------------------------------------------

func cliCmd(env envConfig, projectDir string, args ...string) *exec.Cmd {
	full := append([]string{"--branch", "e2e"}, args...)
	cmd := exec.Command(env.cliBin, full...) //nolint:gosec // test-controlled binary + args
	cmd.Dir = projectDir
	cmd.Stdin = nil // avoid interactive prompts blocking on stdin
	cmd.Env = os.Environ()
	if env.configserverImg != "" {
		cmd.Env = append(cmd.Env, "NHOST_CONFIGSERVER_IMAGE="+env.configserverImg)
	}
	return cmd
}

func runCLI(t *testing.T, env envConfig, projectDir string, args ...string) {
	t.Helper()
	cmd := cliCmd(env, projectDir, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("`nhost %s` failed: %v\n%s", strings.Join(args, " "), err, tail(out, 20))
	}
}

var adminSecretRe = regexp.MustCompile(`HASURA_GRAPHQL_ADMIN_SECRET\s*=\s*['"]([^'"]+)['"]`)

// patchConfig disables email verification (so signup returns a session) and, in
// engine mode, mirrors the root auth/storage config into
// experimental.engine.settings so the bundled engine is configured identically
// to the standalone services. It returns the project's admin secret.
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
		authSettings := stripKeys(deepCopy(cfg["auth"]), "version", "resources")
		storageSettings := stripKeys(deepCopy(cfg["storage"]), "version", "resources")
		cfg["experimental"] = map[string]any{
			"engine": map[string]any{
				"version": defaultEngineVersion,
				"settings": map[string]any{
					"auth":    authSettings,
					"storage": storageSettings,
				},
			},
		}
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

// stripKeys deletes top-level keys from a map (used to drop version/resources,
// which the #AuthSettings/#StorageSettings schema does not allow).
func stripKeys(v any, keys ...string) any {
	m, ok := v.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	for _, k := range keys {
		delete(m, k)
	}
	return m
}

// deepCopy clones a TOML-decoded value tree, preserving Go types so re-encoding
// does not change ints to floats.
func deepCopy(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[k] = deepCopy(val)
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i, val := range t {
			out[i] = deepCopy(val)
		}
		return out
	default:
		return v
	}
}

// ---- misc ----------------------------------------------------------------

func looksLikeJWT(s string) bool {
	return len(strings.Split(s, ".")) == 3 && len(s) > 20
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func tail(b []byte, lines int) string {
	parts := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
	if len(parts) > lines {
		parts = parts[len(parts)-lines:]
	}
	return strings.Join(parts, "\n")
}
