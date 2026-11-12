package api_test

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
	"github.com/nhost/nhost/cli/cmd/api"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/urfave/cli/v3"
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

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatal(err)
	}

	var stdout bytes.Buffer

	root := &cli.Command{
		Name: "nhost", Flags: flags, Commands: []*cli.Command{api.Command()},
		Writer: &stdout, ErrWriter: io.Discard,
		ExitErrHandler: func(_ context.Context, _ *cli.Command, _ error) {},
	}
	argv := make([]string, 0, 8+len(args))
	argv = append(argv,
		"nhost", "--auth-url", endpoint, "--graphql-url", endpoint+"/graphql",
		"--oauth2-client-id", "test-client", "api",
	)
	err = root.Run(t.Context(), append(argv, args...))

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
			args:     []string{"query", query, "--variables", `{"n":9007199254740993}`},
			body:     ` { "data": { "apps": [], "text": "<>&" }, "extensions": {"ignored":true} } `,
			wantData: "{ \"apps\": [], \"text\": \"<>&\" }\n",
			wantRequest: &sentRequest{
				Query:     query,
				Variables: map[string]json.RawMessage{"n": json.RawMessage(`9007199254740993`)},
			},
		},
		{
			name:        "mutation with --with-mutations",
			args:        []string{"query", "--with-mutations", "--", mutation},
			body:        `{"data":{"updateApp":{"id":"id"}}}`,
			wantData:    "{\"updateApp\":{\"id\":\"id\"}}\n",
			wantRequest: &sentRequest{Query: mutation, Variables: map[string]json.RawMessage{}},
		},
		{
			name:        "mutation sent once when the connection drops",
			args:        []string{"query", "--with-mutations", "--", mutation},
			hangUp:      true,
			wantErr:     "failed to query the Nhost Cloud API",
			wantRequest: &sentRequest{Query: mutation, Variables: map[string]json.RawMessage{}},
		},
		{
			name:        "schema",
			args:        []string{"schema"},
			body:        `{"data":{"__schema":{"types":[{"name":"App","description":"kept"}],"unfiltered":true}}}`,
			wantData:    "{\"__schema\":{\"types\":[{\"name\":\"App\",\"description\":\"kept\"}],\"unfiltered\":true}}\n",
			wantRequest: &sentRequest{Query: graphql.IntrospectionQuery},
		},
		{
			name: "mutation without --with-mutations", args: []string{"query", mutation},
			wantErr: "nhost api query sends mutations only with --with-mutations",
		},
		{
			name:    "subscription",
			args:    []string{"query", `subscription { apps { id } }`},
			wantErr: "Subscriptions are not supported",
		},
		{
			name:    "subscription with --with-mutations",
			args:    []string{"query", "--with-mutations", `subscription { apps { id } }`},
			wantErr: "Subscriptions are not supported",
		},
		{
			name:        "GraphQL errors",
			args:        []string{"query", query},
			body:        errorsBody,
			wantErr:     errorsBody,
			wantRequest: &sentRequest{Query: query, Variables: map[string]json.RawMessage{}},
		},
		{
			name: "HTTP errors", args: []string{"query", query}, status: http.StatusForbidden,
			body: `{"error":"forbidden"}`, wantErr: `{"error":"forbidden"}`,
			wantRequest: &sentRequest{Query: query, Variables: map[string]json.RawMessage{}},
		},
		{name: "missing query", args: []string{"query"}, wantErr: "expected one GraphQL document"},
		{
			name:    "extra document",
			args:    []string{"query", query, query},
			wantErr: "expected one GraphQL document",
		},
		{name: "schema argument", args: []string{"schema", query}, wantErr: "schema takes none"},
		{
			name:    "malformed variables",
			args:    []string{"query", query, "--variables", "{"},
			wantErr: "expected one JSON object: unexpected EOF",
		},
		{
			name:    "null variables",
			args:    []string{"query", query, "--variables", "null"},
			wantErr: "expected one JSON object, got null",
		},
		{
			name:    "trailing variables",
			args:    []string{"query", query, "--variables", "{} {}"},
			wantErr: "expected one JSON object, got more than one value",
		},
		{
			name:    "trailing garbage after variables",
			args:    []string{"query", query, "--variables", "{} x"},
			wantErr: "expected one JSON object: invalid character 'x'",
		},
		{
			name:      "no session",
			args:      []string{"query", query},
			noSession: true,
			wantErr:   "nhost login",
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
