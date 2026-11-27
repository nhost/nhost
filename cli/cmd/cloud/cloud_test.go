package cloud_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cloud"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func isolateEnv(t *testing.T) {
	t.Helper()

	for _, entry := range os.Environ() {
		name, _, _ := strings.Cut(entry, "=")
		if name == "NHOST_PAT" || strings.HasPrefix(name, "NHOST_CLI_") {
			t.Setenv(name, "")

			if err := os.Unsetenv(name); err != nil {
				t.Fatal(err)
			}
		}
	}

	t.Setenv("HOME", t.TempDir())
}

type commandResult struct {
	stdout string
	err    error
}

func runCommand(t *testing.T, endpoint string, args []string) commandResult {
	t.Helper()

	argv := make([]string, 0, 8+len(args))
	argv = append(argv,
		"--auth-url", endpoint, "--graphql-url", endpoint+"/graphql",
		"--oauth2-client-id", "test-client", "cloud", "graphql",
	)

	return runCloudCommand(t, append(argv, args...))
}

func runCloudCommand(t *testing.T, args []string) commandResult {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatal(err)
	}

	var stdout bytes.Buffer

	root := &cli.Command{
		Name: "nhost", Flags: flags, Commands: []*cli.Command{cloud.Command()},
		Writer: &stdout, ErrWriter: io.Discard,
		ExitErrHandler: func(_ context.Context, _ *cli.Command, _ error) {},
	}
	err = root.Run(t.Context(), append([]string{"nhost"}, args...))

	return commandResult{stdout: stdout.String(), err: err}
}

type sentRequest struct {
	Query     string                     `json:"query"`
	Variables map[string]json.RawMessage `json:"variables"`
}

type testServer struct {
	server   *httptest.Server
	requests atomic.Int32
	sent     chan sentRequest
}

func newServer(t *testing.T, status int, body string, hangUp bool) *testServer {
	t.Helper()

	if status == 0 {
		status = http.StatusOK
	}

	s := &testServer{sent: make(chan sentRequest, 1)}
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.requests.Add(1)
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			writeBody(t, w, fmt.Sprintf(`{"token_endpoint":%q}`, s.server.URL+"/oauth2/token"))
		case "/oauth2/token":
			writeBody(
				t,
				w,
				`{"access_token":"synthetic-access","refresh_token":"rotated-refresh","expires_in":3600,"token_type":"Bearer"}`,
			)
		case "/graphql":
			if r.Header.Get("Authorization") != "Bearer synthetic-access" {
				t.Error("session bearer not forwarded")
			}

			var payload sentRequest
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Error(err)
				return
			}

			select {
			case s.sent <- payload:
			default:
				t.Error("GraphQL request sent more than once")
			}

			if hangUp {
				closeConnection(t, w)
				return
			}

			w.WriteHeader(status)
			writeBody(t, w, body)
		default:
			t.Errorf("unexpected endpoint: %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.server.Close)

	return s
}

func closeConnection(t *testing.T, w http.ResponseWriter) {
	t.Helper()

	conn, _, err := http.NewResponseController(w).Hijack()
	if err != nil {
		t.Error(err)
		return
	}

	if err := conn.Close(); err != nil {
		t.Error(err)
	}
}

func writeBody(t *testing.T, w io.Writer, body string) {
	t.Helper()

	if _, err := io.WriteString(w, body); err != nil {
		t.Error(err)
	}
}

func writeCredentials(t *testing.T) {
	t.Helper()

	path := filepath.Join(os.Getenv("XDG_STATE_HOME"), "nhost", "auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(
		path,
		[]byte(`{"oauth2RefreshToken":"synthetic-refresh"}`),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
}

func TestCommand(t *testing.T) {
	isolateEnv(t)
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	const (
		query      = `query Apps($n: Int) { apps(limit: $n) { id } }`
		mutation   = "mutation Update {\n  updateApp { id }\n}\n"
		errorsBody = `{"data":{"apps":[]},"errors":[{"message":"denied"}]}`

		duplicateFragment = `query { ...A } ` +
			`fragment A on query_root { apps { id } } fragment A on query_root { apps { id } }`
	)

	tests := []struct {
		name        string
		args        []string
		body        string
		status      int
		hangUp      bool
		noSession   bool
		wantData    string
		wantErr     string
		wantRequest *sentRequest
	}{
		{
			name:     "query variables and raw data",
			args:     []string{"request", query, "--variables", `{"n":9007199254740993}`},
			body:     ` { "data": { "apps": [], "text": "<>&" }, "extensions": {"ignored":true} } `,
			wantData: "{ \"apps\": [], \"text\": \"<>&\" }\n",
			wantRequest: &sentRequest{
				Query:     query,
				Variables: map[string]json.RawMessage{"n": json.RawMessage(`9007199254740993`)},
			},
		},
		{
			name:        "mutation",
			args:        []string{"request", "--", mutation},
			body:        `{"data":{"updateApp":{"id":"id"}}}`,
			wantData:    "{\"updateApp\":{\"id\":\"id\"}}\n",
			wantRequest: &sentRequest{Query: mutation, Variables: map[string]json.RawMessage{}},
		},
		{
			name:        "mutation sent once when the connection drops",
			args:        []string{"request", "--", mutation},
			hangUp:      true,
			wantErr:     "failed to query the Nhost Cloud API",
			wantRequest: &sentRequest{Query: mutation, Variables: map[string]json.RawMessage{}},
		},
		{
			name:        "GraphQL errors",
			args:        []string{"request", query},
			body:        errorsBody,
			wantErr:     errorsBody,
			wantRequest: &sentRequest{Query: query, Variables: map[string]json.RawMessage{}},
		},
		{
			name: "HTTP errors", args: []string{"request", query}, status: http.StatusForbidden,
			body: `{"error":"forbidden"}`, wantErr: `{"error":"forbidden"}`,
			wantRequest: &sentRequest{Query: query, Variables: map[string]json.RawMessage{}},
		},
		{
			name:    "missing document",
			args:    []string{"request"},
			wantErr: "expected one GraphQL document",
		},
		{
			name:    "extra document",
			args:    []string{"request", query, query},
			wantErr: "expected one GraphQL document",
		},
		{
			name:    "malformed variables",
			args:    []string{"request", query, "--variables", "{"},
			wantErr: "expected one JSON object: unexpected EOF",
		},
		{
			name:    "null variables",
			args:    []string{"request", query, "--variables", "null"},
			wantErr: "expected one JSON object, got null",
		},
		{
			name:    "trailing variables",
			args:    []string{"request", query, "--variables", "{} {}"},
			wantErr: "expected one JSON object, got more than one value",
		},
		{
			name:    "trailing garbage after variables",
			args:    []string{"request", query, "--variables", "{} x"},
			wantErr: "expected one JSON object: invalid character 'x'",
		},
		{
			name:      "no session",
			args:      []string{"request", query},
			noSession: true,
			wantErr:   "nhost login",
		},
		{
			name:    "duplicate fragment",
			args:    []string{"request", duplicateFragment},
			wantErr: "failed to check document: query not allowed: duplicate fragment A",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())

			if !tt.noSession {
				writeCredentials(t)
			}

			s := newServer(t, tt.status, tt.body, tt.hangUp)
			got := runCommand(t, s.server.URL, tt.args)
			checkResult(t, got, tt.wantData, tt.wantErr)

			if tt.wantRequest == nil {
				if s.requests.Load() != 0 {
					t.Errorf("requests = %d, want zero", s.requests.Load())
				}

				return
			}

			if len(s.sent) != 1 {
				t.Fatal("expected one GraphQL request")
			}

			if sent := <-s.sent; !reflect.DeepEqual(sent, *tt.wantRequest) {
				t.Errorf("request = %#v, want %#v", sent, *tt.wantRequest)
			}
		})
	}
}

func checkResult(t *testing.T, got commandResult, data, message string) {
	t.Helper()

	if got.stdout != data {
		t.Errorf("stdout = %q, want %q", got.stdout, data)
	}

	if message == "" {
		if got.err != nil {
			t.Fatal(got.err)
		}

		return
	}

	if got.err == nil || !strings.Contains(got.err.Error(), message) {
		t.Fatalf("error = %v, want one containing %q", got.err, message)
	}
}

func TestSchema(t *testing.T) {
	isolateEnv(t)
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	tests := []struct {
		name    string
		pat     string
		session bool
	}{
		{name: "no credentials"},
		{name: "unusable PAT", pat: "synthetic-unusable"},
		{name: "saved session", session: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())
			t.Setenv("NHOST_PAT", tt.pat)

			if tt.session {
				writeCredentials(t)
			}

			s := newServer(t, http.StatusInternalServerError, "must not be reached", false)
			t.Setenv("NHOST_CLI_AUTH_URL", s.server.URL)
			t.Setenv("NHOST_CLI_GRAPHQL_URL", s.server.URL+"/graphql")

			got := runCloudCommand(t, []string{"cloud", "graphql", "schema"})
			if got.err != nil {
				t.Fatal(got.err)
			}

			checkSchemaSummary(t, got.stdout)

			if n := s.requests.Load(); n != 0 {
				t.Errorf("schema sent %d requests, want zero", n)
			}
		})
	}
}

func checkSchemaSummary(t *testing.T, output string) {
	t.Helper()

	var summary struct {
		Query    []string `json:"query"`
		Mutation []string `json:"mutation"`
	}
	if err := json.Unmarshal([]byte(output), &summary); err != nil {
		t.Fatal(err)
	}

	if len(summary.Query) == 0 || len(summary.Mutation) == 0 {
		t.Errorf("summary = %s, want query and mutation names", output)
	}
}

func TestSubscriptionRefusal(t *testing.T) {
	isolateEnv(t)
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	s := newServer(t, http.StatusInternalServerError, "must not be reached", false)
	got := runCommand(t, s.server.URL, []string{"request", "subscription { apps { id } }"})

	const want = "Subscriptions are not supported. query not allowed: subscription { apps { id } }"
	if got.err == nil || got.err.Error() != want {
		t.Fatalf("error = %v, want %q", got.err, want)
	}

	if got.stdout != "" || s.requests.Load() != 0 {
		t.Fatal("refused subscription must produce no stdout and send zero requests")
	}
}

func TestSchemaSelections(t *testing.T) {
	isolateEnv(t)
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	tests := []struct {
		name     string
		args     []string
		rootOnly bool
		wantErr  string
	}{
		{name: "field", args: []string{"app"}},
		{name: "depth after the name", args: []string{"app", "--depth", "0"}, rootOnly: true},
		{name: "depth before the name", args: []string{"--depth", "0", "app"}, rootOnly: true},
		{name: "unknown", args: []string{"nope"}, wantErr: `unknown field "nope"`},
		{
			name:    "depth alone",
			args:    []string{"--depth", "2"},
			wantErr: "--depth requires a field name",
		},
		{
			name:    "explicit default depth alone",
			args:    []string{"--depth", "1"},
			wantErr: "--depth requires a field name",
		},
		{
			name:    "zero depth alone",
			args:    []string{"--depth", "0"},
			wantErr: "--depth requires a field name",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())
			s := newServer(t, http.StatusInternalServerError, "must not be reached", false)
			t.Setenv("NHOST_CLI_AUTH_URL", s.server.URL)
			t.Setenv("NHOST_CLI_GRAPHQL_URL", s.server.URL+"/graphql")

			got := runCloudCommand(t, append([]string{"cloud", "graphql", "schema"}, tt.args...))
			if n := s.requests.Load(); n != 0 {
				t.Errorf("schema sent %d requests, want zero", n)
			}

			if tt.wantErr != "" {
				checkResult(t, got, "", tt.wantErr)
				return
			}

			if got.err != nil {
				t.Fatal(got.err)
			}

			checkSelection(t, got.stdout, "app", tt.rootOnly)
		})
	}
}

func checkSelection(t *testing.T, output, field string, rootOnly bool) {
	t.Helper()

	doc, err := parser.ParseSchema(&ast.Source{Input: output})
	if err != nil {
		t.Fatal(err)
	}

	if len(doc.Schema) != 1 || len(doc.Schema[0].OperationTypes) != 1 ||
		doc.Schema[0].OperationTypes[0].Operation != ast.Query {
		t.Fatal("expected a schema block with only the query root")
	}

	root := doc.Definitions.ForName(doc.Schema[0].OperationTypes[0].Type)
	if root == nil || len(root.Fields) != 1 || root.Fields[0].Name != field {
		t.Fatalf("query root must contain only %s", field)
	}

	if !rootOnly {
		return
	}

	for _, def := range doc.Definitions {
		if def != root && !def.IsLeafType() {
			t.Errorf("--depth 0 defined %s %s", def.Kind, def.Name)
		}
	}
}
