package websocket

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"
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
	Close() error
}

// Connection represents an upgraded WebSocket connection.
// Call Loop() to start processing incoming messages (blocks until connection closes).
type Connection struct {
	conn    wsConn
	handler MessageHandler
	sendCh  chan *Message

	initialized bool
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
		conn:        conn,
		handler:     handler,
		sendCh:      sendCh,
		initialized: false,
	}, nil
}

// Loop starts processing incoming messages and blocks until the connection closes.
// This starts the write pump in a goroutine and runs the read pump in the calling goroutine.
func (c *Connection) Loop(ctx context.Context, logger *slog.Logger) error {
	rctx, cancel := context.WithCancel(ctx)

	defer func() {
		c.handler.OnClose(ctx)
		c.conn.Close()
		cancel()
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

// readPump reads messages from the WebSocket connection.
func (c *Connection) readPump(ctx context.Context, logger *slog.Logger) error {
	initTimer := time.NewTimer(connectionInitTimeout)
	defer initTimer.Stop()

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
			// ReadMessage returns (typically via the read deadline or a close frame).
			_, message, err := c.conn.ReadMessage()
			switch {
			case websocket.IsCloseError(
				err, websocket.CloseNormalClosure, websocket.CloseGoingAway):
				return nil
			case err != nil:
				return fmt.Errorf("%w: %w", errCouldNotReadMessage, err)
			}

			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				return fmt.Errorf("%w: %w", errInvalidMessageFormat, err)
			}

			if err := c.handleMessage(ctx, &msg, logger); err != nil {
				return err
			}

			// Stop the init timeout once the handshake completes.
			if msg.Type == messageTypeConnectionInit && c.initialized {
				initTimer.Stop()
			}
		}
	}
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
				return fmt.Errorf("could not marshal message: %w", err)
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return fmt.Errorf("could not write message: %w", err)
			}
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
		c.sendMessage(ctx, newConnectionAckMessage(), logger)
		return nil
	}

	if err := c.handler.OnConnectionInit(ctx, msg.Payload); err != nil {
		return fmt.Errorf("%w: %w", errConnectionInitFailed, err)
	}

	c.initialized = true

	logger.DebugContext(ctx, "connection initialized")
	c.sendMessage(ctx, newConnectionAckMessage(), logger)

	return nil
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
