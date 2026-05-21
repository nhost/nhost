package websocket

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// fakeWSConn is an inline stub implementing wsConn. It lets internal tests
// drive readPump / writePump / handleMessage without spinning up an
// httptest.Server + gorilla dialer. Each method is a func field so individual
// tests can script behavior (scripted reads, controlled write errors, blocking
// reads, etc.) without needing a separate type per scenario.
type fakeWSConn struct {
	readFn  func() (int, []byte, error)
	writeFn func(messageType int, data []byte) error
	closeFn func() error

	mu       sync.Mutex
	writes   [][]byte
	writeIDs []int
	closed   bool
}

func (f *fakeWSConn) ReadMessage() (int, []byte, error) {
	if f.readFn == nil {
		return 0, nil, errFakeWSReadUnused
	}

	return f.readFn()
}

// errFakeWSReadUnused is returned by fakeWSConn.ReadMessage when no readFn is
// installed. Tests that drive writePump in isolation never invoke ReadMessage,
// but a nil-safe default is friendlier than a panic if the test is reorganised.
var errFakeWSReadUnused = errors.New("fakeWSConn: ReadMessage called without a configured readFn")

func (f *fakeWSConn) WriteMessage(messageType int, data []byte) error {
	f.mu.Lock()
	// Snapshot the bytes — gorilla's contract is that the buffer is reusable
	// after WriteMessage returns, so callers expect us not to retain it.
	buf := make([]byte, len(data))
	copy(buf, data)
	f.writes = append(f.writes, buf)
	f.writeIDs = append(f.writeIDs, messageType)
	f.mu.Unlock()

	if f.writeFn == nil {
		return nil
	}

	return f.writeFn(messageType, data)
}

func (f *fakeWSConn) Close() error {
	f.mu.Lock()
	f.closed = true
	f.mu.Unlock()

	if f.closeFn == nil {
		return nil
	}

	return f.closeFn()
}

func (f *fakeWSConn) writtenMessages() [][]byte {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([][]byte, len(f.writes))
	copy(out, f.writes)

	return out
}

// nopHandler is a MessageHandler that records calls but does nothing else.
// Tests that need richer expectations use the gomock-generated mock from the
// black-box test file; tests that only need a no-op handler use this so they
// can stay in package websocket and access unexported state.
type nopHandler struct {
	onInit     func(ctx context.Context, payload jsontext.Value) error
	onSub      func(ctx context.Context, id string, payload SubscribePayload)
	onComplete func(ctx context.Context, id string)
	onClose    func(ctx context.Context)
}

func (h *nopHandler) OnConnectionInit(ctx context.Context, payload jsontext.Value) error {
	if h.onInit == nil {
		return nil
	}

	return h.onInit(ctx, payload)
}

func (h *nopHandler) OnSubscribe(ctx context.Context, id string, payload SubscribePayload) {
	if h.onSub == nil {
		return
	}

	h.onSub(ctx, id, payload)
}

func (h *nopHandler) OnComplete(ctx context.Context, id string) {
	if h.onComplete == nil {
		return
	}

	h.onComplete(ctx, id)
}

func (h *nopHandler) OnClose(ctx context.Context) {
	if h.onClose == nil {
		return
	}

	h.onClose(ctx)
}

// withTimingOverrides installs short timing knobs for the duration of the test
// and restores them via t.Cleanup. Without this, tests for the init timeout
// and ping ticker would have to wait 10s / 30s of real time.
func withTimingOverrides(t *testing.T, initTimeout, pingInterval time.Duration) {
	t.Helper()

	origInit := connectionInitTimeout
	origPing := defaultPingInterval

	connectionInitTimeout = initTimeout
	defaultPingInterval = pingInterval

	t.Cleanup(func() {
		connectionInitTimeout = origInit
		defaultPingInterval = origPing
	})
}

// TestLoop_ConnectionInitTimeout covers M5 sub-item (1): the readPump's
// init-timer branch. When the client opens the connection but never sends
// connection_init, Loop must return errConnectionInitTimeout.
//
// The current readPump uses `select { case <-ctx.Done(); case <-initTimer.C;
// default: ReadMessage }`, so ReadMessage must return periodically for the
// timer case to be observed. The fake here returns a stream of `pong`
// messages (a no-op in handleMessage), which keeps the loop spinning fast
// enough that the init timer is sampled.
//
//nolint:paralleltest // mutates package-level timing knobs.
func TestLoop_ConnectionInitTimeout(t *testing.T) {
	withTimingOverrides(t, 50*time.Millisecond, time.Hour)

	pongBytes, err := json.Marshal(&Message{ID: "", Type: messageTypePong, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal pong: %v", err)
	}

	fake := &fakeWSConn{
		readFn: func() (int, []byte, error) {
			// Pause briefly so we do not spin a hot CPU loop while the test
			// runs — but stay well under the init timeout so the timer wins.
			time.Sleep(time.Millisecond)
			return websocket.TextMessage, pongBytes, nil
		},
		writeFn: nil,
		closeFn: nil,
	}

	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 16),
		initialized: false,
	}

	errCh := make(chan error, 1)

	go func() {
		errCh <- conn.Loop(t.Context(), slog.New(slog.DiscardHandler))
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, errConnectionInitTimeout) {
			t.Fatalf("expected errConnectionInitTimeout, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Loop did not return within the deadline")
	}
}

// TestWritePump_MarshalFailureReturnsError covers M5 sub-item (2): the
// json.Marshal branch in writePump. We push a Message whose Payload is an
// invalid jsontext.Value — jsontext.Value.MarshalJSON validates its bytes and
// surfaces the error through json.Marshal.
//
//nolint:paralleltest // mutates package-level timing knobs.
func TestWritePump_MarshalFailureReturnsError(t *testing.T) {
	withTimingOverrides(t, time.Hour, time.Hour)

	fake := &fakeWSConn{readFn: nil, writeFn: nil, closeFn: nil}
	sendCh := make(chan *Message, 1)

	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      sendCh,
		initialized: false,
	}

	// jsontext.Value bytes must be valid JSON — feeding it raw garbage forces
	// json.Marshal to surface an error.
	sendCh <- &Message{ID: "x", Type: "next", Payload: jsontext.Value("not valid json")}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	errCh := make(chan error, 1)

	go func() {
		errCh <- conn.writePump(ctx, slog.New(slog.DiscardHandler))
	}()

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected writePump to return an error")
		}

		// writePump wraps the marshal failure with a fixed prefix; we assert on
		// the prefix because the inner error type is internal to encoding/json/v2.
		if !strings.Contains(err.Error(), "could not marshal message") {
			t.Fatalf("expected wrapped marshal error, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("writePump did not return within the deadline")
	}

	if len(fake.writtenMessages()) != 0 {
		t.Fatalf("expected no writes after marshal failure, got %d", len(fake.writtenMessages()))
	}
}

// TestWritePump_WriteMessageFailureReturnsError covers M5 sub-item (3): the
// WriteMessage error branch in writePump. The fake's writeFn returns a
// deterministic error; the pump must wrap and return it.
//
//nolint:paralleltest // mutates package-level timing knobs.
func TestWritePump_WriteMessageFailureReturnsError(t *testing.T) {
	withTimingOverrides(t, time.Hour, time.Hour)

	writeErr := errors.New("simulated write failure")
	fake := &fakeWSConn{
		readFn: nil,
		writeFn: func(_ int, _ []byte) error {
			return writeErr
		},
		closeFn: nil,
	}

	sendCh := make(chan *Message, 1)
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      sendCh,
		initialized: false,
	}

	sendCh <- newPongMessage()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	errCh := make(chan error, 1)

	go func() {
		errCh <- conn.writePump(ctx, slog.New(slog.DiscardHandler))
	}()

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected writePump to return an error")
		}

		if !errors.Is(err, writeErr) {
			t.Fatalf("expected error wrapping the simulated write failure, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("writePump did not return within the deadline")
	}
}

// TestWritePump_PingTickerSendsPing covers M5 sub-item (4): the
// defaultPingInterval ticker fires sendMessage(newPingMessage()). We crank
// the interval down to ~10ms and assert a ping lands on sendCh.
//
//nolint:paralleltest // mutates package-level timing knobs.
func TestWritePump_PingTickerSendsPing(t *testing.T) {
	withTimingOverrides(t, time.Hour, 10*time.Millisecond)

	fake := &fakeWSConn{readFn: nil, writeFn: nil, closeFn: nil}
	// Buffer of 1 lets the ticker enqueue a single ping; we read it before the
	// next tick to avoid the drop-on-full path in sendMessage.
	sendCh := make(chan *Message, 1)

	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      sendCh,
		initialized: false,
	}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	pumpErr := make(chan error, 1)

	go func() {
		pumpErr <- conn.writePump(ctx, slog.New(slog.DiscardHandler))
	}()

	// The first thing writePump does after a tick is sendMessage(newPing) →
	// enqueue on sendCh → re-enter the select and pop it off → call WriteMessage.
	// We can verify either side: read from sendCh OR check fake.writtenMessages().
	// Reading from sendCh races with writePump's own consumption, so we wait on
	// the fake's record of writes.
	deadline := time.After(2 * time.Second)

	tick := time.NewTicker(5 * time.Millisecond)
	defer tick.Stop()

	for {
		select {
		case <-deadline:
			t.Fatal("ping ticker did not produce a write within the deadline")
		case <-tick.C:
			writes := fake.writtenMessages()
			if len(writes) == 0 {
				continue
			}

			var msg Message
			if err := json.Unmarshal(writes[0], &msg); err != nil {
				t.Fatalf("could not parse written message: %v", err)
			}

			if msg.Type != messageTypePing {
				t.Fatalf("expected ping message, got type=%q", msg.Type)
			}

			cancel()

			select {
			case <-pumpErr:
			case <-time.After(2 * time.Second):
				t.Fatal("writePump did not exit after context cancellation")
			}

			return
		}
	}
}

// TestHandleMessage_UnknownTypeFallsThrough covers M5 sub-item (5): the
// `default` warn branch in handleMessage. An unknown message type must not
// invoke any MessageHandler method and must not return an error.
func TestHandleMessage_UnknownTypeFallsThrough(t *testing.T) {
	t.Parallel()

	var (
		mu     sync.Mutex
		called []string
	)

	record := func(name string) {
		mu.Lock()

		called = append(called, name)
		mu.Unlock()
	}

	handler := &nopHandler{
		onInit: func(_ context.Context, _ jsontext.Value) error {
			record("OnConnectionInit")
			return nil
		},
		onSub: func(_ context.Context, _ string, _ SubscribePayload) {
			record("OnSubscribe")
		},
		onComplete: func(_ context.Context, _ string) {
			record("OnComplete")
		},
		onClose: func(_ context.Context) {
			record("OnClose")
		},
	}

	fake := &fakeWSConn{readFn: nil, writeFn: nil, closeFn: nil}
	conn := &Connection{
		conn:        fake,
		handler:     handler,
		sendCh:      make(chan *Message, 4),
		initialized: false,
	}

	err := conn.handleMessage(
		t.Context(),
		&Message{ID: "id-1", Type: "definitely-not-a-real-type", Payload: nil},
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("handleMessage returned unexpected error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(called) != 0 {
		t.Fatalf("expected no MessageHandler calls for unknown type, got %v", called)
	}
}

// Compile-time check: *websocket.Conn must satisfy wsConn. This is the real
// production wiring — a regression that breaks the interface would block the
// package from compiling, but the explicit assertion documents the contract
// and gives a clearer error message at the point of breakage.
var _ wsConn = (*websocket.Conn)(nil)
