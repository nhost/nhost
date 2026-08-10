package websocket

import (
	"context"
	"encoding/binary"
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
	readFn             func() (int, []byte, error)
	writeFn            func(messageType int, data []byte) error
	setReadDeadlineFn  func(time.Time) error
	setWriteDeadlineFn func(time.Time) error
	setPongHandlerFn   func(func(string) error)
	writeControlFn     func(messageType int, data []byte, deadline time.Time) error
	closeFn            func() error

	mu                sync.Mutex
	writes            [][]byte
	writeIDs          []int
	readDeadlines     []time.Time
	writeDeadlines    []time.Time
	writeControlCalls []fakeWriteControlCall
	pongHandler       func(string) error
	events            []string
	closed            bool
}

type fakeWriteControlCall struct {
	messageType int
	data        []byte
	deadline    time.Time
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

var errFakeWSPongHandlerUnused = errors.New(
	"fakeWSConn: pong handler invoked before SetPongHandler",
)

type fakeTimeoutError struct{}

func (fakeTimeoutError) Error() string { return "fake timeout" }

func (fakeTimeoutError) Timeout() bool { return true }

func (fakeTimeoutError) Temporary() bool { return true }

func (f *fakeWSConn) WriteMessage(messageType int, data []byte) error {
	f.mu.Lock()
	// Snapshot the bytes — gorilla's contract is that the buffer is reusable
	// after WriteMessage returns, so callers expect us not to retain it.
	buf := make([]byte, len(data))
	copy(buf, data)
	f.writes = append(f.writes, buf)
	f.writeIDs = append(f.writeIDs, messageType)
	f.events = append(f.events, "write_message")
	f.mu.Unlock()

	if f.writeFn == nil {
		return nil
	}

	return f.writeFn(messageType, data)
}

func (f *fakeWSConn) SetReadDeadline(t time.Time) error {
	f.mu.Lock()
	f.readDeadlines = append(f.readDeadlines, t)
	f.mu.Unlock()

	if f.setReadDeadlineFn == nil {
		return nil
	}

	return f.setReadDeadlineFn(t)
}

func (f *fakeWSConn) SetWriteDeadline(t time.Time) error {
	f.mu.Lock()
	f.writeDeadlines = append(f.writeDeadlines, t)
	f.events = append(f.events, "set_write_deadline")
	f.mu.Unlock()

	if f.setWriteDeadlineFn == nil {
		return nil
	}

	return f.setWriteDeadlineFn(t)
}

func (f *fakeWSConn) SetPongHandler(h func(string) error) {
	f.mu.Lock()
	f.pongHandler = h
	f.mu.Unlock()

	if f.setPongHandlerFn != nil {
		f.setPongHandlerFn(h)
	}
}

func (f *fakeWSConn) WriteControl(messageType int, data []byte, deadline time.Time) error {
	buf := make([]byte, len(data))
	copy(buf, data)

	f.mu.Lock()
	f.writeControlCalls = append(f.writeControlCalls, fakeWriteControlCall{
		messageType: messageType,
		data:        buf,
		deadline:    deadline,
	})
	f.events = append(f.events, "write_control")
	f.mu.Unlock()

	if f.writeControlFn == nil {
		return nil
	}

	return f.writeControlFn(messageType, data, deadline)
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

func (f *fakeWSConn) readDeadlineCalls() []time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]time.Time, len(f.readDeadlines))
	copy(out, f.readDeadlines)

	return out
}

func (f *fakeWSConn) writeDeadlineCalls() []time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]time.Time, len(f.writeDeadlines))
	copy(out, f.writeDeadlines)

	return out
}

func (f *fakeWSConn) writeControlRecords() []fakeWriteControlCall {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]fakeWriteControlCall, len(f.writeControlCalls))
	copy(out, f.writeControlCalls)

	return out
}

func (f *fakeWSConn) eventRecords() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]string, len(f.events))
	copy(out, f.events)

	return out
}

func (f *fakeWSConn) invokePongHandler(data string) error {
	f.mu.Lock()
	handler := f.pongHandler
	f.mu.Unlock()

	if handler == nil {
		return errFakeWSPongHandlerUnused
	}

	return handler(data)
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

type expiringNopHandler struct {
	nopHandler

	expiresAt func() time.Time
}

func (h *expiringNopHandler) ConnectionExpiresAt() (time.Time, bool) {
	return h.expiresAt(), true
}

// withTimingOverrides installs short timing knobs for the duration of the test
// and restores them via t.Cleanup. Without this, tests for the init timeout
// and ping ticker would have to wait 10s / 30s of real time.
func withTimingOverrides(t *testing.T, initTimeout, pingInterval time.Duration) {
	t.Helper()

	withAllTimingOverrides(t, initTimeout, pingInterval, pongWait, writeWait)
}

func withAllTimingOverrides(
	t *testing.T,
	initTimeout time.Duration,
	pingInterval time.Duration,
	livenessTimeout time.Duration,
	writeTimeout time.Duration,
) {
	t.Helper()

	origInit := connectionInitTimeout
	origPing := defaultPingInterval
	origPong := pongWait
	origWrite := writeWait

	connectionInitTimeout = initTimeout
	defaultPingInterval = pingInterval
	pongWait = livenessTimeout
	writeWait = writeTimeout

	t.Cleanup(func() {
		connectionInitTimeout = origInit
		defaultPingInterval = origPing
		pongWait = origPong
		writeWait = origWrite
	})
}

func TestSetReadDeadlineSuppressesCancellation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		cancelBefore   bool
		cancelInSetter bool
		wantCalled     bool
		wantErr        bool
	}{
		{
			name:           "canceled before call skips websocket deadline",
			cancelBefore:   true,
			cancelInSetter: false,
			wantCalled:     false,
			wantErr:        false,
		},
		{
			name:           "canceled during setter suppresses deadline error",
			cancelBefore:   false,
			cancelInSetter: true,
			wantCalled:     true,
			wantErr:        false,
		},
		{
			name:           "active context returns deadline error",
			cancelBefore:   false,
			cancelInSetter: false,
			wantCalled:     true,
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			if tt.cancelBefore {
				cancel()
			}

			called := false
			fake := &fakeWSConn{
				setReadDeadlineFn: func(time.Time) error {
					called = true

					if tt.cancelInSetter {
						cancel()
					}

					return context.Canceled
				},
			}
			conn := &Connection{
				conn:        fake,
				handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
				sendCh:      make(chan *Message, 1),
				initialized: false,
				expiresAt:   time.Time{},
			}

			err := conn.setReadDeadline(ctx, time.Now())

			if called != tt.wantCalled {
				t.Fatalf("expected SetReadDeadline called=%v, got %v", tt.wantCalled, called)
			}

			if tt.wantErr {
				if !errors.Is(err, context.Canceled) {
					t.Fatalf("expected context.Canceled error, got %v", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
		})
	}
}

func TestReadPumpInitialDeadlineCancellationReturnsNil(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	deadlineCalled := false
	fake := &fakeWSConn{
		readFn: func() (int, []byte, error) {
			t.Fatal("ReadMessage should not be called after context cancellation")

			return 0, nil, nil
		},
		setReadDeadlineFn: func(time.Time) error {
			deadlineCalled = true

			return context.Canceled
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 1),
		initialized: false,
		expiresAt:   time.Time{},
	}

	if err := conn.readPump(ctx, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("expected nil error after context cancellation, got %v", err)
	}

	if deadlineCalled {
		t.Fatal("SetReadDeadline should not be called after context cancellation")
	}
}

func TestLoopWritesConnectionAckBeforeExpirationDeadline(t *testing.T) {
	t.Parallel()

	initBytes, err := json.Marshal(&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal connection_init: %v", err)
	}

	ackWritten := make(chan struct{})
	postInitDeadlineSet := make(chan struct{})

	var expiresAt time.Time

	readCalls := 0
	deadlineCalls := 0
	fake := &fakeWSConn{
		readFn: func() (int, []byte, error) {
			readCalls++
			if readCalls == 1 {
				return websocket.TextMessage, initBytes, nil
			}

			select {
			case <-postInitDeadlineSet:
			case <-time.After(2 * time.Second):
				t.Fatal("post-init read deadline was not set")
			}

			if expiresAt.IsZero() {
				t.Fatal("connection expiration was not captured")
			}

			if untilExpiry := time.Until(expiresAt); untilExpiry > 0 {
				time.Sleep(untilExpiry + time.Millisecond)
			}

			return 0, nil, fakeTimeoutError{}
		},
		writeFn: func(_ int, data []byte) error {
			var msg Message
			if err := json.Unmarshal(data, &msg); err != nil {
				t.Errorf("could not unmarshal written message: %v", err)
			}

			if msg.Type != messageTypeConnectionAck {
				t.Errorf("expected connection_ack write, got %q", msg.Type)
			}

			close(ackWritten)

			return nil
		},
		setReadDeadlineFn: func(time.Time) error {
			deadlineCalls++
			if deadlineCalls == 2 {
				select {
				case <-ackWritten:
				default:
					t.Fatal("post-init read deadline was set before connection_ack was written")
				}

				close(postInitDeadlineSet)
			}

			return nil
		},
	}
	conn := &Connection{
		conn: fake,
		handler: &expiringNopHandler{
			nopHandler: nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
			expiresAt: func() time.Time {
				expiresAt = time.Now().Add(100 * time.Millisecond)

				return expiresAt
			},
		},
		sendCh:               make(chan *Message, 1),
		connectionAckWriteCh: make(chan error, 1),
		initialized:          false,
		expiresAt:            time.Time{},
	}

	err = conn.Loop(t.Context(), slog.New(slog.DiscardHandler))
	if !errors.Is(err, errConnectionExpired) {
		t.Fatalf("expected errConnectionExpired, got %v", err)
	}

	if deadlineCalls != 2 {
		t.Fatalf("expected initial and post-init deadline calls, got %d", deadlineCalls)
	}
}

func TestSendConnectionAckFullQueueReturnsExpired(t *testing.T) {
	t.Parallel()

	conn := &Connection{
		conn:                 &fakeWSConn{},
		handler:              &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:               make(chan *Message, 1),
		connectionAckWriteCh: make(chan error, 1),
		initialized:          true,
		expiresAt:            time.Time{},
	}
	conn.sendCh <- newPingMessage()

	errCh := make(chan error, 1)
	go func() {
		conn.expiresAt = time.Now().Add(50 * time.Millisecond)
		errCh <- conn.sendConnectionAck(t.Context(), slog.New(slog.DiscardHandler))
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, errConnectionExpired) {
			t.Fatalf("expected errConnectionExpired, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("sendConnectionAck did not return after connection expiration")
	}

	msg := <-conn.sendCh
	if msg.Type != messageTypePing {
		t.Fatalf("expected queued ping to remain, got %q", msg.Type)
	}
}

func TestSendConnectionAckBlockedWriteNotificationReturnsExpired(t *testing.T) {
	t.Parallel()

	conn := &Connection{
		conn:                 &fakeWSConn{},
		handler:              &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:               make(chan *Message, 1),
		connectionAckWriteCh: make(chan error, 1),
		initialized:          true,
		expiresAt:            time.Time{},
	}

	errCh := make(chan error, 1)
	go func() {
		conn.expiresAt = time.Now().Add(50 * time.Millisecond)
		errCh <- conn.sendConnectionAck(t.Context(), slog.New(slog.DiscardHandler))
	}()

	select {
	case msg := <-conn.sendCh:
		if msg.Type != messageTypeConnectionAck {
			t.Fatalf("expected connection_ack to be queued, got %q", msg.Type)
		}
	case err := <-errCh:
		t.Fatalf("sendConnectionAck returned before queuing ack: %v", err)
	case <-time.After(2 * time.Second):
		t.Fatal("connection_ack was not queued")
	}

	select {
	case err := <-errCh:
		if !errors.Is(err, errConnectionExpired) {
			t.Fatalf("expected errConnectionExpired, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("sendConnectionAck did not return after connection expiration")
	}
}

func TestReadPumpPostInitDeadlineCancellationReturnsNil(t *testing.T) {
	t.Parallel()

	initBytes, err := json.Marshal(&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal connection_init: %v", err)
	}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	readCalls := 0
	deadlineCalls := 0
	fake := &fakeWSConn{
		readFn: func() (int, []byte, error) {
			readCalls++
			if readCalls > 1 {
				t.Fatal("ReadMessage should not be called again after context cancellation")
			}

			return websocket.TextMessage, initBytes, nil
		},
		setReadDeadlineFn: func(time.Time) error {
			deadlineCalls++
			if deadlineCalls > 1 {
				return context.Canceled
			}

			return nil
		},
	}
	conn := &Connection{
		conn: fake,
		handler: &nopHandler{
			onInit: func(_ context.Context, _ jsontext.Value) error {
				cancel()

				return nil
			},
			onSub:      nil,
			onComplete: nil,
			onClose:    nil,
		},
		sendCh:      make(chan *Message, 1),
		initialized: false,
		expiresAt:   time.Time{},
	}

	if err := conn.readPump(ctx, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("expected nil error after context cancellation, got %v", err)
	}

	if deadlineCalls != 1 {
		t.Fatalf("expected only the initial deadline call, got %d", deadlineCalls)
	}
}

//nolint:paralleltest,cyclop // mutates timing knobs; keeping the scripted read flow inline is clearer.
func TestReadPump_RefreshesLivenessOnPostInitAppFrames(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, 2*time.Second, time.Hour)

	initBytes, err := json.Marshal(&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal connection_init: %v", err)
	}

	pongBytes, err := json.Marshal(&Message{ID: "", Type: messageTypePong, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal pong: %v", err)
	}

	completeBytes, err := json.Marshal(
		&Message{ID: "sub-1", Type: messageTypeComplete, Payload: nil},
	)
	if err != nil {
		t.Fatalf("could not marshal complete: %v", err)
	}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	reads := make(chan []byte, 3)
	reads <- initBytes

	reads <- pongBytes

	reads <- completeBytes

	deadlineRefreshed := make(chan struct{})

	var closeDeadlineRefreshed sync.Once

	var fake *fakeWSConn

	fake = &fakeWSConn{
		readFn: func() (int, []byte, error) {
			select {
			case data := <-reads:
				return websocket.TextMessage, data, nil
			case <-ctx.Done():
				return 0, nil, ctx.Err()
			}
		},
		setReadDeadlineFn: func(time.Time) error {
			if len(fake.readDeadlineCalls()) >= 4 {
				closeDeadlineRefreshed.Do(func() { close(deadlineRefreshed) })
			}

			return nil
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 4),
		initialized: false,
		expiresAt:   time.Time{},
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- conn.readPump(ctx, slog.New(slog.DiscardHandler))
	}()

	select {
	case <-deadlineRefreshed:
	case <-time.After(2 * time.Second):
		t.Fatal("post-init app frames did not refresh the read deadline")
	}

	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected nil readPump error after cancellation, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("readPump did not exit after context cancellation")
	}

	deadlines := fake.readDeadlineCalls()
	if len(deadlines) < 4 {
		t.Fatalf(
			"expected initial, post-init, pong, and complete deadlines, got %d",
			len(deadlines),
		)
	}

	lastDeadline := deadlines[len(deadlines)-1]
	if lastDeadline.IsZero() {
		t.Fatal("expected non-zero liveness deadline")
	}

	if until := time.Until(lastDeadline); until <= 0 || until > pongWait+time.Second {
		t.Fatalf("expected last deadline within pongWait, got %v from now", until)
	}
}

//nolint:paralleltest,cyclop // mutates timing knobs; keeping the scripted read flow inline is clearer.
func TestReadPump_ControlPongRefreshesAfterInitOnly(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, 2*time.Second, time.Hour)

	initBytes, err := json.Marshal(&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal connection_init: %v", err)
	}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	reads := make(chan []byte, 1)
	pongHandlerRegistered := make(chan struct{})
	postInitDeadlineSet := make(chan struct{})

	var (
		fake                  *fakeWSConn
		closeRegistered       sync.Once
		closePostInitDeadline sync.Once
	)

	fake = &fakeWSConn{
		readFn: func() (int, []byte, error) {
			select {
			case data := <-reads:
				return websocket.TextMessage, data, nil
			case <-ctx.Done():
				return 0, nil, ctx.Err()
			}
		},
		setPongHandlerFn: func(func(string) error) {
			closeRegistered.Do(func() { close(pongHandlerRegistered) })
		},
		setReadDeadlineFn: func(time.Time) error {
			if len(fake.readDeadlineCalls()) >= 2 {
				closePostInitDeadline.Do(func() { close(postInitDeadlineSet) })
			}

			return nil
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 4),
		initialized: false,
		expiresAt:   time.Time{},
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- conn.readPump(ctx, slog.New(slog.DiscardHandler))
	}()

	select {
	case <-pongHandlerRegistered:
	case <-time.After(2 * time.Second):
		t.Fatal("SetPongHandler was not registered")
	}

	if err := fake.invokePongHandler("pre-init"); err != nil {
		t.Fatalf("pre-init control pong returned an error: %v", err)
	}

	if got := len(fake.readDeadlineCalls()); got != 1 {
		t.Fatalf("pre-init control pong should not refresh deadline, got %d calls", got)
	}

	reads <- initBytes

	select {
	case <-postInitDeadlineSet:
	case <-time.After(2 * time.Second):
		t.Fatal("post-init deadline was not set")
	}

	if err := fake.invokePongHandler("post-init"); err != nil {
		t.Fatalf("post-init control pong returned an error: %v", err)
	}

	if got := len(fake.readDeadlineCalls()); got < 3 {
		t.Fatalf("post-init control pong should refresh deadline, got %d calls", got)
	}

	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected nil readPump error after cancellation, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("readPump did not exit after context cancellation")
	}
}

//nolint:paralleltest // mutates package-level timing knobs.
func TestReadPump_LivenessTimeoutReturnsSentinel(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, 50*time.Millisecond, time.Hour)

	initBytes, err := json.Marshal(&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil})
	if err != nil {
		t.Fatalf("could not marshal connection_init: %v", err)
	}

	readCalls := 0
	fake := &fakeWSConn{
		readFn: func() (int, []byte, error) {
			readCalls++
			if readCalls == 1 {
				return websocket.TextMessage, initBytes, nil
			}

			return 0, nil, fakeTimeoutError{}
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 4),
		initialized: false,
		expiresAt:   time.Time{},
	}

	err = conn.readPump(t.Context(), slog.New(slog.DiscardHandler))
	if !errors.Is(err, errConnectionLivenessTimeout) {
		t.Fatalf("expected errConnectionLivenessTimeout, got %v", err)
	}
}

//nolint:paralleltest // mutates package-level timing knobs.
func TestPostInitReadDeadlineCappedByJWTExpiry(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, time.Hour, time.Hour)

	expiresAt := time.Now().Add(50 * time.Millisecond)
	fake := &fakeWSConn{}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 1),
		initialized: true,
		expiresAt:   expiresAt,
	}

	if err := conn.setPostInitReadDeadline(t.Context()); err != nil {
		t.Fatalf("setPostInitReadDeadline returned an error: %v", err)
	}

	deadlines := fake.readDeadlineCalls()
	if len(deadlines) != 1 {
		t.Fatalf("expected one read deadline, got %d", len(deadlines))
	}

	if !deadlines[0].Equal(expiresAt) {
		t.Fatalf("expected deadline capped at JWT expiry %v, got %v", expiresAt, deadlines[0])
	}
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

	//nolint:err113 // test sentinel error used to verify error propagation
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

//nolint:paralleltest // mutates package-level timing knobs.
func TestWritePump_SetsWriteDeadlineBeforeWrite(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, time.Hour, 500*time.Millisecond)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	fake := &fakeWSConn{
		writeFn: func(_ int, _ []byte) error {
			cancel()

			return nil
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 1),
		initialized: false,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- conn.writePump(ctx, slog.New(slog.DiscardHandler))
	}()

	beforeSend := time.Now()

	conn.sendCh <- newPongMessage()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected nil writePump error, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("writePump did not exit after context cancellation")
	}

	events := fake.eventRecords()
	if len(events) < 2 {
		t.Fatalf("expected deadline and write events, got %v", events)
	}

	if events[0] != "set_write_deadline" || events[1] != "write_message" {
		t.Fatalf("expected SetWriteDeadline before WriteMessage, got events %v", events)
	}

	deadlines := fake.writeDeadlineCalls()
	if len(deadlines) != 1 {
		t.Fatalf("expected one write deadline, got %d", len(deadlines))
	}

	if !deadlines[0].After(beforeSend) {
		t.Fatalf("expected write deadline after send time, got %v <= %v", deadlines[0], beforeSend)
	}

	if deadlines[0].After(beforeSend.Add(writeWait + 2*time.Second)) {
		t.Fatalf("write deadline %v was not bounded by writeWait from %v", deadlines[0], beforeSend)
	}
}

//nolint:paralleltest // mutates package-level timing knobs.
func TestWritePump_SetWriteDeadlineFailureReturnsError(t *testing.T) {
	withAllTimingOverrides(t, time.Hour, time.Hour, time.Hour, time.Hour)

	//nolint:err113 // test sentinel error used to verify error propagation
	deadlineErr := errors.New("simulated write deadline failure")
	fake := &fakeWSConn{
		setWriteDeadlineFn: func(time.Time) error {
			return deadlineErr
		},
		writeFn: func(_ int, _ []byte) error {
			t.Fatal("WriteMessage should not be called after SetWriteDeadline fails")

			return nil
		},
	}
	conn := &Connection{
		conn:        fake,
		handler:     &nopHandler{onInit: nil, onSub: nil, onComplete: nil, onClose: nil},
		sendCh:      make(chan *Message, 1),
		initialized: false,
	}

	conn.sendCh <- newPongMessage()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- conn.writePump(ctx, slog.New(slog.DiscardHandler))
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, deadlineErr) {
			t.Fatalf("expected error wrapping write deadline failure, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("writePump did not return after SetWriteDeadline failure")
	}

	if len(fake.writtenMessages()) != 0 {
		t.Fatalf("expected no writes after deadline failure, got %d", len(fake.writtenMessages()))
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

func TestHandleConnectionInit_DuplicateClosesWith4429(t *testing.T) {
	t.Parallel()

	fake := &fakeWSConn{}
	conn := &Connection{
		conn: fake,
		handler: &nopHandler{
			onInit: func(context.Context, jsontext.Value) error {
				t.Fatal("OnConnectionInit should not be called for duplicate init")

				return nil
			},
			onSub:      nil,
			onComplete: nil,
			onClose:    nil,
		},
		sendCh:      make(chan *Message, 1),
		initialized: true,
		expiresAt:   time.Time{},
	}

	err := conn.handleMessage(
		t.Context(),
		&Message{ID: "", Type: messageTypeConnectionInit, Payload: nil},
		slog.New(slog.DiscardHandler),
	)
	if !errors.Is(err, errDuplicateConnectionInit) {
		t.Fatalf("expected errDuplicateConnectionInit, got %v", err)
	}

	assertCloseControl(
		t,
		fake.writeControlRecords(),
		closeCodeTooManyInitialisationRequests,
		closeReasonTooManyInitialisationRequests,
	)

	if len(fake.writtenMessages()) != 0 {
		t.Fatalf("expected no data writes for duplicate init, got %d", len(fake.writtenMessages()))
	}
}

func TestHandleSubscribe_BeforeInitClosesWith4401(t *testing.T) {
	t.Parallel()

	payload, err := json.Marshal(SubscribePayload{Query: "{ users { id } }"})
	if err != nil {
		t.Fatalf("could not marshal subscribe payload: %v", err)
	}

	fake := &fakeWSConn{}
	conn := &Connection{
		conn: fake,
		handler: &nopHandler{
			onInit: nil,
			onSub: func(context.Context, string, SubscribePayload) {
				t.Fatal("OnSubscribe should not be called before init")
			},
			onComplete: nil,
			onClose:    nil,
		},
		sendCh:      make(chan *Message, 1),
		initialized: false,
		expiresAt:   time.Time{},
	}

	err = conn.handleMessage(
		t.Context(),
		&Message{ID: "sub-1", Type: messageTypeSubscribe, Payload: payload},
		slog.New(slog.DiscardHandler),
	)
	if !errors.Is(err, errSubscribeBeforeInit) {
		t.Fatalf("expected errSubscribeBeforeInit, got %v", err)
	}

	assertCloseControl(
		t,
		fake.writeControlRecords(),
		closeCodeUnauthorized,
		closeReasonUnauthorized,
	)

	select {
	case msg := <-conn.sendCh:
		t.Fatalf("expected no operation error frame, got %s", msg.Type)
	default:
	}

	if len(fake.writtenMessages()) != 0 {
		t.Fatalf("expected no data writes before init, got %d", len(fake.writtenMessages()))
	}
}

func assertCloseControl(
	t *testing.T,
	calls []fakeWriteControlCall,
	wantCode int,
	wantReason string,
) {
	t.Helper()

	if len(calls) != 1 {
		t.Fatalf("expected one close control frame, got %d", len(calls))
	}

	call := calls[0]
	if call.messageType != websocket.CloseMessage {
		t.Fatalf("expected CloseMessage control frame, got message type %d", call.messageType)
	}

	if call.deadline.IsZero() {
		t.Fatal("expected close control frame deadline to be set")
	}

	if len(call.data) < 2 {
		t.Fatalf("close frame payload too short: %d", len(call.data))
	}

	gotCode := int(binary.BigEndian.Uint16(call.data[:2]))
	if gotCode != wantCode {
		t.Fatalf("expected close code %d, got %d", wantCode, gotCode)
	}

	if gotReason := string(call.data[2:]); gotReason != wantReason {
		t.Fatalf("expected close reason %q, got %q", wantReason, gotReason)
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
