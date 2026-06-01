package websocket

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	defaultReadBufferSize  = 1024
	defaultWriteBufferSize = 1024
)

// Timing knobs. Declared as vars (not consts) so internal tests can swap them
// for fast values via t.Cleanup. Production code never assigns to these.
//
//nolint:gochecknoglobals // intentional test-override knobs; see comment above.
var (
	connectionInitTimeout = 10 * time.Second
	defaultPingInterval   = 30 * time.Second
)

// MessageHandler handles graphql-transport-ws protocol events.
// The websocket package calls these when protocol events occur.
// Implementations handle business logic (session extraction, subscription management).
//
//go:generate mockgen -package mock -destination mock/message_handler.go . MessageHandler
type MessageHandler interface {
	// OnConnectionInit is called when client sends connection_init.
	// Return an error to reject the connection.
	OnConnectionInit(ctx context.Context, payload jsontext.Value) error

	// OnSubscribe is called when client sends subscribe.
	OnSubscribe(ctx context.Context, id string, payload SubscribePayload)

	// OnComplete is called when client sends complete.
	OnComplete(ctx context.Context, id string)

	// OnClose is called when the connection closes.
	OnClose(ctx context.Context)
}

// wsConn is the minimal surface Connection needs from the underlying
// WebSocket implementation. Keeping the dependency behind a consumer-side
// interface lets the state machine be unit-tested with an inline fake while
// confining gorilla types to the upgrade site in NewConnection.
type wsConn interface {
	ReadMessage() (int, []byte, error)
	WriteMessage(messageType int, data []byte) error
	SetReadDeadline(t time.Time) error
	Close() error
}

// connectionExpirationProvider is an optional capability for handlers that can
// provide an absolute authentication expiry for the WebSocket connection.
type connectionExpirationProvider interface {
	ConnectionExpiresAt() (time.Time, bool)
}

// Connection represents an upgraded WebSocket connection.
// Call Loop() to start processing incoming messages (blocks until connection closes).
type Connection struct {
	conn    wsConn
	handler MessageHandler
	sendCh  chan *Message
	// connectionAckWriteCh lets the read pump wait until the write pump has
	// flushed connection_ack before arming any post-init expiry deadline.
	// White-box tests that drive readPump without writePump leave it nil.
	connectionAckWriteCh chan error

	initialized bool
	expiresAt   time.Time
}

// NewConnection upgrades an HTTP connection to WebSocket.
// The sendCh is used by both the protocol (for acks, pings, errors) and by the
// handler (for subscription data). The caller should create the channel and
// pass it to both NewConnection() and the MessageHandler.
// Call connection.Loop() to start processing messages (this will block).
func NewConnection(
	w http.ResponseWriter,
	r *http.Request,
	handler MessageHandler,
	sendCh chan *Message,
) (*Connection, error) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:    defaultReadBufferSize,
		WriteBufferSize:   defaultWriteBufferSize,
		CheckOrigin:       func(_ *http.Request) bool { return true },
		Subprotocols:      []string{"graphql-transport-ws"},
		HandshakeTimeout:  0,
		WriteBufferPool:   nil,
		Error:             nil,
		EnableCompression: true,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, fmt.Errorf("websocket upgrade failed: %w", err)
	}

	return &Connection{
		conn:                 conn,
		handler:              handler,
		sendCh:               sendCh,
		connectionAckWriteCh: make(chan error, 1),
		initialized:          false,
		expiresAt:            time.Time{},
	}, nil
}

// Loop starts processing incoming messages and blocks until the connection closes.
// This starts the write pump in a goroutine and runs the read pump in the calling goroutine.
func (c *Connection) Loop(ctx context.Context, logger *slog.Logger) error {
	rctx, cancel := context.WithCancel(ctx)

	var closeOnce sync.Once

	closeConn := func(message string) {
		closeOnce.Do(func() {
			if err := c.conn.Close(); err != nil {
				logger.DebugContext(ctx, message, slog.String("error", err.Error()))
			}
		})
	}

	defer func() {
		c.handler.OnClose(ctx)
		closeConn("websocket close failed")
		cancel()
	}()

	go func() {
		<-rctx.Done()
		closeConn("websocket close after cancellation failed")
	}()

	errWriteCh := make(chan error, 1)

	go func() {
		errWriteCh <- c.writePump(rctx, logger)
		// if we cannot write, we should cancel the read pump
		cancel()
	}()

	errRead := c.readPump(rctx, logger)
	// Once the read pump has returned, signal the write pump to stop so we can
	// observe its error without deadlocking.
	cancel()

	errWrite := <-errWriteCh

	if errRead != nil {
		return errRead
	}

	return errWrite
}

type readMessageStatus uint8

const (
	readMessageStatusContinue readMessageStatus = iota
	readMessageStatusDone
	readMessageStatusInitialized
)

// readPump reads messages from the WebSocket connection.
func (c *Connection) readPump(ctx context.Context, logger *slog.Logger) error {
	initTimer := time.NewTimer(connectionInitTimeout)
	defer initTimer.Stop()

	if err := c.setReadDeadline(ctx, time.Now().Add(connectionInitTimeout)); err != nil {
		return fmt.Errorf("setting initial read deadline: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-initTimer.C:
			if !c.initialized {
				return errConnectionInitTimeout
			}
		default:
			// `default` is used so each loop iteration reaches ReadMessage even when
			// ctx is not yet done and the init timer has not yet fired. Cancellation
			// and the init timeout are observed by the next iteration's select once
			// ReadMessage returns via a read deadline, close frame, or conn.Close.
			status, err := c.readAndHandleMessage(ctx, logger)
			if err != nil {
				return err
			}

			if status == readMessageStatusDone {
				return nil
			}

			// Stop the init timeout once the handshake completes, then replace the
			// pre-init read deadline with the JWT expiry bound (or no deadline for
			// non-JWT sessions).
			if status == readMessageStatusInitialized {
				initTimer.Stop()

				if err := c.setPostInitReadDeadline(ctx); err != nil {
					return fmt.Errorf("setting post-init read deadline: %w", err)
				}
			}
		}
	}
}

func (c *Connection) readAndHandleMessage(
	ctx context.Context, logger *slog.Logger,
) (readMessageStatus, error) {
	_, message, err := c.conn.ReadMessage()
	if err != nil {
		return c.handleReadMessageError(ctx, err)
	}

	if contextDone(ctx) {
		return readMessageStatusDone, nil
	}

	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		return readMessageStatusContinue, fmt.Errorf("%w: %w", errInvalidMessageFormat, err)
	}

	if err := c.handleMessage(ctx, &msg, logger); err != nil {
		return readMessageStatusContinue, err
	}

	if msg.Type == messageTypeConnectionInit && c.initialized {
		return readMessageStatusInitialized, nil
	}

	return readMessageStatusContinue, nil
}

func (c *Connection) handleReadMessageError(
	ctx context.Context, readErr error,
) (readMessageStatus, error) {
	switch {
	case contextDone(ctx):
		return readMessageStatusDone, nil
	case websocket.IsCloseError(readErr, websocket.CloseNormalClosure, websocket.CloseGoingAway):
		return readMessageStatusDone, nil
	case isReadTimeout(readErr) && !c.initialized:
		return readMessageStatusContinue, errConnectionInitTimeout
	case isReadTimeout(readErr) && c.isExpired(time.Now()):
		return readMessageStatusContinue, errConnectionExpired
	default:
		return readMessageStatusContinue, fmt.Errorf("%w: %w", errCouldNotReadMessage, readErr)
	}
}

func (c *Connection) setPostInitReadDeadline(ctx context.Context) error {
	if c.expiresAt.IsZero() {
		return c.setReadDeadline(ctx, time.Time{})
	}

	return c.setReadDeadline(ctx, c.expiresAt)
}

func (c *Connection) setReadDeadline(ctx context.Context, deadline time.Time) error {
	if contextDone(ctx) {
		return nil
	}

	if err := c.conn.SetReadDeadline(deadline); err != nil {
		if contextDone(ctx) {
			return nil
		}

		return fmt.Errorf("setting websocket read deadline: %w", err)
	}

	return nil
}

// contextDone reports that connection shutdown has started. Read/deadline
// helpers treat transport errors after this point as graceful cancellation.
func contextDone(ctx context.Context) bool {
	return ctx.Err() != nil
}

func (c *Connection) isExpired(now time.Time) bool {
	return !c.expiresAt.IsZero() && !now.Before(c.expiresAt)
}

func isReadTimeout(err error) bool {
	var netErr net.Error

	return errors.As(err, &netErr) && netErr.Timeout()
}

// writePump writes messages to the WebSocket connection.
func (c *Connection) writePump(ctx context.Context, logger *slog.Logger) error {
	ticker := time.NewTicker(defaultPingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case msg := <-c.sendCh:
			data, err := json.Marshal(msg)
			if err != nil {
				writeErr := fmt.Errorf("could not marshal message: %w", err)
				c.notifyConnectionAckWrite(msg, writeErr)

				return writeErr
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				writeErr := fmt.Errorf("could not write message: %w", err)
				c.notifyConnectionAckWrite(msg, writeErr)

				return writeErr
			}

			c.notifyConnectionAckWrite(msg, nil)
		case <-ticker.C:
			c.sendMessage(ctx, newPingMessage(), logger)
		}
	}
}

// handleMessage dispatches incoming messages based on type.
func (c *Connection) handleMessage(ctx context.Context, msg *Message, logger *slog.Logger) error {
	switch msg.Type {
	case messageTypeConnectionInit:
		return c.handleConnectionInit(ctx, msg, logger)
	case messageTypePing:
		c.sendMessage(ctx, newPongMessage(), logger)
	case messageTypePong:
		// Pongs acknowledge our pings; no further action required.
	case messageTypeSubscribe:
		c.handleSubscribe(ctx, msg, logger)
	case messageTypeComplete:
		c.handler.OnComplete(ctx, msg.ID)
	default:
		logger.WarnContext(ctx, "unknown message type, ignoring", slog.String("type", msg.Type))
	}

	return nil
}

// handleConnectionInit processes connection_init messages.
func (c *Connection) handleConnectionInit(
	ctx context.Context, msg *Message, logger *slog.Logger,
) error {
	if c.initialized {
		return c.sendConnectionAck(ctx, logger)
	}

	if err := c.handler.OnConnectionInit(ctx, msg.Payload); err != nil {
		return fmt.Errorf("%w: %w", errConnectionInitFailed, err)
	}

	c.initialized = true
	if provider, ok := c.handler.(connectionExpirationProvider); ok {
		if expiresAt, ok := provider.ConnectionExpiresAt(); ok && !expiresAt.IsZero() {
			c.expiresAt = expiresAt
		}
	}

	logger.DebugContext(ctx, "connection initialized")

	return c.sendConnectionAck(ctx, logger)
}

func (c *Connection) notifyConnectionAckWrite(msg *Message, err error) {
	if c.connectionAckWriteCh == nil || msg == nil || msg.Type != messageTypeConnectionAck {
		return
	}

	select {
	case c.connectionAckWriteCh <- err:
	default:
	}
}

func (c *Connection) sendConnectionAck(ctx context.Context, logger *slog.Logger) error {
	msg := newConnectionAckMessage()
	if c.connectionAckWriteCh == nil {
		c.sendMessage(ctx, msg, logger)

		return nil
	}

	c.drainConnectionAckWriteNotifications()

	select {
	case c.sendCh <- msg:
	case <-ctx.Done():
		return nil
	}

	select {
	case err := <-c.connectionAckWriteCh:
		if err != nil {
			return fmt.Errorf("writing connection_ack: %w", err)
		}
	case <-ctx.Done():
	}

	return nil
}

func (c *Connection) drainConnectionAckWriteNotifications() {
	for {
		select {
		case <-c.connectionAckWriteCh:
		default:
			return
		}
	}
}

// handleSubscribe processes subscribe messages.
func (c *Connection) handleSubscribe(ctx context.Context, msg *Message, logger *slog.Logger) {
	if !c.initialized {
		c.sendError(ctx, msg.ID, "connection not initialized", logger)
		return
	}

	var payload SubscribePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		c.sendError(ctx, msg.ID, "invalid subscribe payload: "+err.Error(), logger)
		return
	}

	c.handler.OnSubscribe(ctx, msg.ID, payload)
}

// sendMessage sends a message to the WebSocket connection.
func (c *Connection) sendMessage(ctx context.Context, msg *Message, logger *slog.Logger) {
	select {
	case c.sendCh <- msg:
	default:
		logger.WarnContext(ctx, "send buffer full, dropping message")
	}
}

// sendError sends an error message to the client.
func (c *Connection) sendError(ctx context.Context, id string, errMsg string, logger *slog.Logger) {
	c.sendMessage(ctx, NewErrorMessage(id, []map[string]any{{"message": errMsg}}), logger)
}
