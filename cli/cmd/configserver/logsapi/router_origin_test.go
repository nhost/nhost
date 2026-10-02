package logsapi //nolint:testpackage // exercises unexported originCheckedWebsocket wiring

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const wsHandshakeTimeout = 5 * time.Second

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	os.Exit(m.Run())
}

// stubWebsocketImpl records whether the wrapped implementation's Accept was
// reached, so the wrapper's fail-closed behaviour can be asserted directly.
type stubWebsocketImpl struct {
	called bool
}

func (s *stubWebsocketImpl) Accept(
	_ http.ResponseWriter,
	_ *http.Request,
	_ transport.WebsocketAcceptOptions,
) (transport.WebsocketConn, error) {
	s.called = true

	return nil, nil //nolint:nilnil // stub; the wrapper only inspects the error
}

func TestOriginCheckedWebsocketAccept(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		origin string
		allow  bool
	}{
		{"allowed localhost", "http://localhost:3000", true},
		{"allowed dashboard subdomain", "https://abc123.dashboard.local.nhost.run", true},
		{"disallowed evil", "https://evil.example.com", false},
		{"empty origin", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			stub := &stubWebsocketImpl{}
			ws := originCheckedWebsocket{inner: stub, checkOrigin: checkWebSocketOrigin}

			r := httptest.NewRequest(http.MethodGet, "/v1/logs/graphql", nil)
			if tt.origin != "" {
				r.Header.Set("Origin", tt.origin)
			}

			_, err := ws.Accept(httptest.NewRecorder(), r, transport.WebsocketAcceptOptions{})

			if tt.allow {
				if err != nil {
					t.Fatalf("Accept(%q) unexpected error: %v", tt.origin, err)
				}

				if !stub.called {
					t.Fatalf("Accept(%q) did not delegate to inner implementation", tt.origin)
				}

				return
			}

			if !errors.Is(err, errWebsocketOriginNotAllowed) {
				t.Fatalf("Accept(%q) error = %v, want errWebsocketOriginNotAllowed", tt.origin, err)
			}

			if stub.called {
				t.Fatalf(
					"Accept(%q) delegated to inner implementation for rejected origin",
					tt.origin,
				)
			}
		})
	}
}

// newLogsWebSocketServer stands up the real logs GraphQL route via AddRoutes and
// returns its websocket URL. The resolver's LogGatherer is nil because the tests
// below only exercise the upgrade handshake, which happens before any resolver
// is invoked.
func newLogsWebSocketServer(t *testing.T) string {
	t.Helper()

	engine := gin.New()
	AddRoutes(engine, "/v1/logs", &Resolver{}, false, "test")

	srv := httptest.NewServer(engine)
	t.Cleanup(srv.Close)

	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/v1/logs/graphql"
}

func newWebSocketDialer() *websocket.Dialer {
	return &websocket.Dialer{
		Subprotocols:     []string{"graphql-transport-ws"},
		HandshakeTimeout: wsHandshakeTimeout,
	}
}

// TestAddRoutesWebSocketRejectsDisallowedOrigin asserts that a disallowed Origin
// never reaches 101 Switching Protocols through the wired transport — i.e. the
// origin check is actually installed by AddRoutes, not just defined.
func TestAddRoutesWebSocketRejectsDisallowedOrigin(t *testing.T) {
	t.Parallel()

	wsURL := newLogsWebSocketServer(t)

	for _, origin := range []string{"https://evil.example.com", ""} {
		t.Run(origin, func(t *testing.T) {
			t.Parallel()

			hdr := http.Header{}
			if origin != "" {
				hdr.Set("Origin", origin)
			}

			conn, resp, err := newWebSocketDialer().Dial(wsURL, hdr)
			if conn != nil {
				_ = conn.Close()
			}

			if resp != nil && resp.Body != nil {
				_ = resp.Body.Close()
			}

			if err == nil {
				t.Fatalf("Dial(origin=%q) upgraded, want rejection", origin)
			}

			if resp != nil && resp.StatusCode != http.StatusBadRequest {
				t.Fatalf(
					"Dial(origin=%q) rejected with status %d, want %d",
					origin, resp.StatusCode, http.StatusBadRequest,
				)
			}
		})
	}
}

// TestAddRoutesWebSocketUpgradeRoundTrip is the regression test for the websocket
// transport being incompatible with gin's ResponseWriter: an implementation that
// writes the 101 header before hijacking (e.g. coder) cannot upgrade a gin
// ResponseWriter, which refuses to hijack an already-written response, leaving the
// socket dead server-side while the client still sees a 101. This drives a real
// graphql-transport-ws handshake (connection_init -> connection_ack), so it fails
// unless the upgrade actually completes on the server.
func TestAddRoutesWebSocketUpgradeRoundTrip(t *testing.T) {
	t.Parallel()

	wsURL := newLogsWebSocketServer(t)

	conn, resp, err := newWebSocketDialer().Dial(
		wsURL, http.Header{"Origin": {"http://localhost:3000"}},
	)
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}

	if err != nil {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}

		t.Fatalf("Dial(allowed origin) failed (status %d): %v", status, err)
	}

	defer func() { _ = conn.Close() }()

	if err := conn.WriteMessage(
		websocket.TextMessage, []byte(`{"type":"connection_init"}`),
	); err != nil {
		t.Fatalf("failed to send connection_init: %v", err)
	}

	if err := conn.SetReadDeadline(time.Now().Add(wsHandshakeTimeout)); err != nil {
		t.Fatalf("failed to set read deadline: %v", err)
	}

	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read connection_ack — server-side upgrade did not complete: %v", err)
	}

	if !strings.Contains(string(data), "connection_ack") {
		t.Fatalf("first server message = %q, want connection_ack", data)
	}
}
