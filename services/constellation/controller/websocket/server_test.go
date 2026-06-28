package websocket_test

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	gorillaWS "github.com/gorilla/websocket"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	wsmock "github.com/nhost/nhost/services/constellation/controller/websocket/mock"
	"go.uber.org/mock/gomock"
)

// wsMessage mirrors websocket.Message for client-side JSON handling.
type wsMessage struct {
	ID      string `json:"id,omitempty"`
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}

// testConn wraps a client websocket and a channel that is closed when the
// server-side Loop() exits (after OnClose is called).
type testConn struct {
	client   *gorillaWS.Conn
	loopDone <-chan struct{}
}

// close gracefully closes the websocket and waits for the server to finish.
func (tc *testConn) close(t *testing.T) {
	t.Helper()

	tc.client.WriteMessage( //nolint:errcheck
		gorillaWS.CloseMessage,
		gorillaWS.FormatCloseMessage(gorillaWS.CloseNormalClosure, ""),
	)

	select {
	case <-tc.loopDone:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server loop to exit")
	}
}

// testConnWithErr is like testConn but also exposes the channel carrying
// the Loop return value so tests can assert on it.
type testConnWithErr struct {
	*testConn

	loopErr <-chan error
}

// dialTestServerCapturingErr is like dialTestServer but publishes the Loop
// return value on a channel for assertion.
func dialTestServerCapturingErr(
	t *testing.T,
	handler websocket.MessageHandler,
) *testConnWithErr {
	t.Helper()

	loopDone := make(chan struct{})
	loopErr := make(chan error, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sendCh := make(chan *websocket.Message, 50)

		conn, err := websocket.NewConnection(w, r, handler, sendCh)
		if err != nil {
			t.Errorf("NewConnection failed: %v", err)
			return
		}

		loopErr <- conn.Loop(r.Context(), slog.Default())

		close(loopDone)
	}))

	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	dialer := gorillaWS.Dialer{
		Subprotocols: []string{"graphql-transport-ws"},
	}

	client, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}

	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}

	return &testConnWithErr{
		testConn: &testConn{client: client, loopDone: loopDone},
		loopErr:  loopErr,
	}
}

// dialTestServer creates a test HTTP server that upgrades to WebSocket,
// runs Connection.Loop, and returns a testConn with the client and a
// channel that signals when the server finishes.
func dialTestServer(
	t *testing.T,
	handler websocket.MessageHandler,
) *testConn {
	t.Helper()

	loopDone := make(chan struct{})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sendCh := make(chan *websocket.Message, 50)

		conn, err := websocket.NewConnection(w, r, handler, sendCh)
		if err != nil {
			t.Errorf("NewConnection failed: %v", err)
			return
		}

		_ = conn.Loop(r.Context(), slog.Default())

		close(loopDone)
	}))

	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	dialer := gorillaWS.Dialer{
		Subprotocols: []string{"graphql-transport-ws"},
	}

	client, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}

	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}

	return &testConn{client: client, loopDone: loopDone}
}

// readMessage reads and unmarshals a single message from the websocket.
func readMessage(t *testing.T, client *gorillaWS.Conn) wsMessage {
	t.Helper()

	client.SetReadDeadline(time.Now().Add(2 * time.Second)) //nolint:errcheck

	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read message failed: %v", err)
	}

	var msg wsMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal message failed: %v", err)
	}

	return msg
}

// writeMessage marshals and sends a message to the websocket.
func writeMessage(t *testing.T, client *gorillaWS.Conn, msg wsMessage) {
	t.Helper()

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal message failed: %v", err)
	}

	if err := client.WriteMessage(gorillaWS.TextMessage, data); err != nil {
		t.Fatalf("write message failed: %v", err)
	}
}

type expiringHandler struct {
	expiresAfter time.Duration
	closeCh      chan struct{}
}

func (h *expiringHandler) OnConnectionInit(context.Context, jsontext.Value) error {
	return nil
}

func (h *expiringHandler) OnSubscribe(context.Context, string, websocket.SubscribePayload) {
	panic("unexpected subscribe")
}

func (h *expiringHandler) OnComplete(context.Context, string) {
	panic("unexpected complete")
}

func (h *expiringHandler) OnClose(context.Context) {
	close(h.closeCh)
}

func (h *expiringHandler) ConnectionExpiresAt() (time.Time, bool) {
	return time.Now().Add(h.expiresAfter), true
}

// protocolStep describes a single client->server interaction in a
// table-driven protocol test. Exactly one of expectOutbound or awaitHandler
// is set per step.
type protocolStep struct {
	// send is the message the client writes to the server.
	send wsMessage
	// expectOutbound, when non-empty, is the Type the server is expected to
	// write back (e.g. "connection_ack", "pong", "error"). If expectID is
	// non-empty it must match the inbound message ID.
	expectOutbound string
	expectID       string
	// awaitHandler, when non-nil, is a channel that the handler-mock setup
	// closes inside its Do(...) callback. The step waits on it before moving on.
	awaitHandler <-chan struct{}
}

func TestProtocol(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// setupHandler installs gomock expectations and returns any
		// synchronization channels referenced by steps (via awaitHandler).
		// OnClose is set up by the caller; setupHandler need not.
		setupHandler func(t *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{}
		// steps are executed in order using the shared client+server.
		// Each step's awaitHandler is resolved via the channels returned
		// from setupHandler keyed by the step's expectID (or send.ID).
		steps func(chans map[string]<-chan struct{}) []protocolStep
	}{
		{
			name: "connection_init produces connection_ack",
			setupHandler: func(_ *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{} {
				h.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
				return nil
			},
			steps: func(_ map[string]<-chan struct{}) []protocolStep {
				return []protocolStep{
					{send: wsMessage{Type: "connection_init"}, expectOutbound: "connection_ack"},
				}
			},
		},
		{
			name: "ping after init produces pong",
			setupHandler: func(_ *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{} {
				h.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
				return nil
			},
			steps: func(_ map[string]<-chan struct{}) []protocolStep {
				return []protocolStep{
					{send: wsMessage{Type: "connection_init"}, expectOutbound: "connection_ack"},
					{send: wsMessage{Type: "ping"}, expectOutbound: "pong"},
				}
			},
		},
		{
			name: "pong is silently accepted (subsequent ping still works)",
			setupHandler: func(_ *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{} {
				h.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
				return nil
			},
			steps: func(_ map[string]<-chan struct{}) []protocolStep {
				return []protocolStep{
					{send: wsMessage{Type: "connection_init"}, expectOutbound: "connection_ack"},
					{send: wsMessage{Type: "pong"}},
					{send: wsMessage{Type: "ping"}, expectOutbound: "pong"},
				}
			},
		},
		{
			name: "subscribe after init invokes OnSubscribe",
			setupHandler: func(t *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{} {
				t.Helper()

				done := make(chan struct{})

				h.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
				h.EXPECT().
					OnSubscribe(gomock.Any(), "sub-1", gomock.Any()).
					Do(func(_ context.Context, _ string, payload websocket.SubscribePayload) {
						if payload.Query != "{ users { id } }" {
							t.Errorf("unexpected query: %s", payload.Query)
						}

						close(done)
					})

				return map[string]<-chan struct{}{"sub-1": done}
			},
			steps: func(chans map[string]<-chan struct{}) []protocolStep {
				return []protocolStep{
					{send: wsMessage{Type: "connection_init"}, expectOutbound: "connection_ack"},
					{
						send: wsMessage{
							ID:      "sub-1",
							Type:    "subscribe",
							Payload: websocket.SubscribePayload{Query: "{ users { id } }"},
						},
						awaitHandler: chans["sub-1"],
					},
				}
			},
		},
		{
			name: "complete after init invokes OnComplete",
			setupHandler: func(_ *testing.T, h *wsmock.MockMessageHandler) map[string]<-chan struct{} {
				done := make(chan struct{})

				h.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
				h.EXPECT().OnComplete(gomock.Any(), "sub-1").
					Do(func(_ context.Context, _ string) {
						close(done)
					})

				return map[string]<-chan struct{}{"sub-1": done}
			},
			steps: func(chans map[string]<-chan struct{}) []protocolStep {
				return []protocolStep{
					{send: wsMessage{Type: "connection_init"}, expectOutbound: "connection_ack"},
					{
						send:         wsMessage{ID: "sub-1", Type: "complete"},
						awaitHandler: chans["sub-1"],
					},
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			handler := wsmock.NewMockMessageHandler(ctrl)
			handler.EXPECT().OnClose(gomock.Any())

			chans := tt.setupHandler(t, handler)
			tc := dialTestServer(t, handler)

			for i, step := range tt.steps(chans) {
				writeMessage(t, tc.client, step.send)

				switch {
				case step.expectOutbound != "":
					msg := readMessage(t, tc.client)
					if msg.Type != step.expectOutbound {
						t.Errorf(
							"step %d: expected outbound %q, got %q",
							i,
							step.expectOutbound,
							msg.Type,
						)
					}

					if step.expectID != "" && msg.ID != step.expectID {
						t.Errorf(
							"step %d: expected outbound ID %q, got %q",
							i,
							step.expectID,
							msg.ID,
						)
					}
				case step.awaitHandler != nil:
					select {
					case <-step.awaitHandler:
					case <-time.After(2 * time.Second):
						t.Fatalf("step %d: handler was not invoked", i)
					}
				}
			}

			tc.close(t)
		})
	}
}

func TestProtocol_SubscribeBeforeInitCloses4401(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	handler := wsmock.NewMockMessageHandler(ctrl)
	handler.EXPECT().OnClose(gomock.Any())

	tc := dialTestServerCapturingErr(t, handler)
	defer tc.client.Close()

	writeMessage(t, tc.client, wsMessage{
		ID:      "sub-1",
		Type:    "subscribe",
		Payload: websocket.SubscribePayload{Query: "{ users { id } }"},
	})

	tc.client.SetReadDeadline(time.Now().Add(2 * time.Second)) //nolint:errcheck

	_, _, err := tc.client.ReadMessage()
	if !gorillaWS.IsCloseError(err, 4401) {
		t.Fatalf("expected close code 4401, got %v", err)
	}

	select {
	case loopErr := <-tc.loopErr:
		if loopErr == nil {
			t.Fatal("expected subscribe-before-init loop error, got nil")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server loop to exit")
	}
}

func TestProtocol_DuplicateConnectionInitCloses4429(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	handler := wsmock.NewMockMessageHandler(ctrl)
	handler.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil).Times(1)
	handler.EXPECT().OnClose(gomock.Any())

	tc := dialTestServerCapturingErr(t, handler)
	defer tc.client.Close()

	writeMessage(t, tc.client, wsMessage{Type: "connection_init"})

	ack := readMessage(t, tc.client)
	if ack.Type != "connection_ack" {
		t.Fatalf("expected connection_ack, got %s", ack.Type)
	}

	writeMessage(t, tc.client, wsMessage{Type: "connection_init"})

	tc.client.SetReadDeadline(time.Now().Add(2 * time.Second)) //nolint:errcheck

	_, _, err := tc.client.ReadMessage()
	if !gorillaWS.IsCloseError(err, 4429) {
		t.Fatalf("expected close code 4429, got %v", err)
	}

	select {
	case loopErr := <-tc.loopErr:
		if loopErr == nil {
			t.Fatal("expected duplicate-init loop error, got nil")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server loop to exit")
	}
}

func TestProtocol_ConnectionInit_Rejected(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	handler := wsmock.NewMockMessageHandler(ctrl)

	//nolint:err113 // test sentinel error used to verify error propagation
	unauthorizedErr := errors.New("unauthorized")
	handler.EXPECT().
		OnConnectionInit(gomock.Any(), gomock.Any()).
		Return(unauthorizedErr)
	handler.EXPECT().OnClose(gomock.Any())

	tc := dialTestServer(t, handler)

	writeMessage(t, tc.client, wsMessage{Type: "connection_init"})

	// Server should close the connection after rejecting init
	tc.client.SetReadDeadline(time.Now().Add(2 * time.Second)) //nolint:errcheck

	_, _, err := tc.client.ReadMessage()
	if err == nil {
		t.Error("expected connection to close after rejected init")
	}

	// Wait for loop to exit
	select {
	case <-tc.loopDone:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server loop to exit")
	}
}

func TestProtocol_ConnectionClosesAtHandlerExpiration(t *testing.T) {
	t.Parallel()

	handler := &expiringHandler{
		expiresAfter: 50 * time.Millisecond,
		closeCh:      make(chan struct{}),
	}

	tc := dialTestServerCapturingErr(t, handler)
	defer tc.client.Close()

	writeMessage(t, tc.client, wsMessage{Type: "connection_init"})

	ack := readMessage(t, tc.client)
	if ack.Type != "connection_ack" {
		t.Fatalf("expected connection_ack, got %s", ack.Type)
	}

	tc.client.SetReadDeadline(time.Now().Add(2 * time.Second)) //nolint:errcheck

	_, _, err := tc.client.ReadMessage()
	if err == nil {
		t.Fatal("expected connection to close at expiration")
	}

	select {
	case err := <-tc.loopErr:
		if err == nil || !strings.Contains(err.Error(), "connection expired") {
			t.Fatalf("expected connection expired error, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server loop to exit")
	}

	select {
	case <-handler.closeCh:
	case <-time.After(2 * time.Second):
		t.Fatal("OnClose was not called")
	}
}

func TestProtocol_FullFlow(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	handler := wsmock.NewMockMessageHandler(ctrl)

	subscribeDone := make(chan struct{})
	completeDone := make(chan struct{})

	handler.EXPECT().OnConnectionInit(gomock.Any(), gomock.Any()).Return(nil)
	handler.EXPECT().
		OnSubscribe(gomock.Any(), "op-1", gomock.Any()).
		Do(func(_ context.Context, _ string, _ websocket.SubscribePayload) {
			close(subscribeDone)
		})
	handler.EXPECT().OnComplete(gomock.Any(), "op-1").
		Do(func(_ context.Context, _ string) {
			close(completeDone)
		})
	handler.EXPECT().OnClose(gomock.Any())

	tc := dialTestServer(t, handler)

	// Step 1: connection_init
	writeMessage(t, tc.client, wsMessage{Type: "connection_init"})

	ack := readMessage(t, tc.client)
	if ack.Type != "connection_ack" {
		t.Fatalf("expected connection_ack, got %s", ack.Type)
	}

	// Step 2: subscribe
	writeMessage(t, tc.client, wsMessage{
		ID:   "op-1",
		Type: "subscribe",
		Payload: websocket.SubscribePayload{
			Query:         "{ users { id name } }",
			OperationName: "GetUsers",
		},
	})

	select {
	case <-subscribeDone:
	case <-time.After(2 * time.Second):
		t.Fatal("subscribe was not called")
	}

	// Step 3: complete
	writeMessage(t, tc.client, wsMessage{
		ID:   "op-1",
		Type: "complete",
	})

	select {
	case <-completeDone:
	case <-time.After(2 * time.Second):
		t.Fatal("complete was not called")
	}

	tc.close(t)
}

func TestLoop_InvalidMessageFormatReturnsError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	handler := wsmock.NewMockMessageHandler(ctrl)
	handler.EXPECT().OnClose(gomock.Any())

	tc := dialTestServerCapturingErr(t, handler)

	// Send malformed JSON before any init — the readPump should return
	// wrapped errInvalidMessageFormat.
	if err := tc.client.WriteMessage(gorillaWS.TextMessage, []byte("not json")); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	select {
	case err := <-tc.loopErr:
		if err == nil {
			t.Fatal("expected Loop to return an error, got nil")
		}

		if !strings.Contains(err.Error(), "invalid message format") {
			t.Errorf("expected error wrapping errInvalidMessageFormat, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for Loop to return")
	}
}

func TestNewNextMessage(t *testing.T) {
	t.Parallel()

	msg := websocket.NewNextMessage("sub-1", map[string]any{"users": []any{}}, nil)

	if msg.ID != "sub-1" {
		t.Errorf("expected ID sub-1, got %s", msg.ID)
	}

	if msg.Type != "next" {
		t.Errorf("expected next, got %s", msg.Type)
	}

	if msg.Payload == nil {
		t.Fatal("expected non-nil payload")
	}
}

func TestNewErrorMessage(t *testing.T) {
	t.Parallel()

	msg := websocket.NewErrorMessage("sub-1", []map[string]any{{"message": "something went wrong"}})

	if msg.ID != "sub-1" {
		t.Errorf("expected ID sub-1, got %s", msg.ID)
	}

	if msg.Type != "error" {
		t.Errorf("expected error, got %s", msg.Type)
	}

	if msg.Payload == nil {
		t.Fatal("expected non-nil payload")
	}
}
