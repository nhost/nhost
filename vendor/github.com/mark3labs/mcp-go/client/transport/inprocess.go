package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type InProcessTransport struct {
	server             *server.MCPServer
	samplingHandler    server.SamplingHandler
	elicitationHandler server.ElicitationHandler
	rootsHandler       server.RootsHandler
	session            *server.InProcessSession
	sessionID          string

	onNotification func(mcp.JSONRPCNotification)
	notifyMu       sync.RWMutex
	started        bool
	starting       bool
	startDone      chan struct{}
	closed         bool
	startedMu      sync.Mutex

	done      chan struct{}
	closeOnce sync.Once
}

type InProcessOption func(*InProcessTransport)

func WithSamplingHandler(handler server.SamplingHandler) InProcessOption {
	return func(t *InProcessTransport) {
		t.samplingHandler = handler
	}
}

func WithElicitationHandler(handler server.ElicitationHandler) InProcessOption {
	return func(t *InProcessTransport) {
		t.elicitationHandler = handler
	}
}

func WithRootsHandler(handler server.RootsHandler) InProcessOption {
	return func(t *InProcessTransport) {
		t.rootsHandler = handler
	}
}

func NewInProcessTransport(server *server.MCPServer) *InProcessTransport {
	return &InProcessTransport{
		server:    server,
		sessionID: server.GenerateInProcessSessionID(),
		done:      make(chan struct{}),
	}
}

func NewInProcessTransportWithOptions(server *server.MCPServer, opts ...InProcessOption) *InProcessTransport {
	t := &InProcessTransport{
		server:    server,
		sessionID: server.GenerateInProcessSessionID(),
		done:      make(chan struct{}),
	}

	for _, opt := range opts {
		opt(t)
	}

	return t
}

func (c *InProcessTransport) Start(ctx context.Context) error {
	for {
		c.startedMu.Lock()
		if c.closed {
			c.startedMu.Unlock()
			return ErrTransportClosed
		}
		if c.started {
			c.startedMu.Unlock()
			return nil
		}
		if c.starting {
			done := c.startDone
			c.startedMu.Unlock()
			select {
			case <-done:
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		c.starting = true
		c.startDone = make(chan struct{})
		session := server.NewInProcessSessionWithHandlers(c.sessionID, c.samplingHandler, c.elicitationHandler, c.rootsHandler)
		c.startedMu.Unlock()

		// Registration invokes user hooks, which may close this transport.
		// Keep callbacks outside startedMu and recheck closure before publishing
		// the session. Concurrent Start callers wait for this attempt to finish.
		err := c.server.RegisterSession(ctx, session)
		c.startedMu.Lock()
		closed := c.closed
		if err == nil && !closed {
			c.session = session
			c.started = true
		}
		c.starting = false
		close(c.startDone)
		c.startedMu.Unlock()

		if err != nil {
			return fmt.Errorf("failed to register session: %w", err)
		}
		if closed {
			c.server.UnregisterSession(context.Background(), c.sessionID)
			return ErrTransportClosed
		}
		go c.forwardNotifications()
		return nil
	}
}

// forwardNotifications drains the session's notification channel and
// forwards each notification to the registered client handler, mirroring
// the equivalent readResponses notification path in the stdio transport.
// Runs until Close() closes the done channel.
func (c *InProcessTransport) forwardNotifications() {
	notifications := c.session.ClientNotifications()
	for {
		select {
		case <-c.done:
			return
		case notification, ok := <-notifications:
			if !ok {
				return
			}
			c.notifyMu.RLock()
			handler := c.onNotification
			c.notifyMu.RUnlock()
			if handler != nil {
				handler(notification)
			}
		}
	}
}

func (c *InProcessTransport) SendRequest(ctx context.Context, request JSONRPCRequest) (*JSONRPCResponse, error) {
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	requestBytes = append(requestBytes, '\n')

	// Add session to context if available
	if c.session != nil {
		ctx = c.server.WithContext(ctx, c.session)
	}

	respMessage := c.server.HandleMessage(ctx, requestBytes)
	respByte, err := json.Marshal(respMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response message: %w", err)
	}
	var rpcResp JSONRPCResponse
	err = json.Unmarshal(respByte, &rpcResp)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response message: %w", err)
	}

	return &rpcResp, nil
}

func (c *InProcessTransport) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	notificationBytes, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}
	notificationBytes = append(notificationBytes, '\n')
	if c.session != nil {
		ctx = c.server.WithContext(ctx, c.session)
	}
	c.server.HandleMessage(ctx, notificationBytes)

	return nil
}

func (c *InProcessTransport) SetNotificationHandler(handler func(notification mcp.JSONRPCNotification)) {
	c.notifyMu.Lock()
	defer c.notifyMu.Unlock()
	c.onNotification = handler
}

func (c *InProcessTransport) Close() error {
	c.startedMu.Lock()
	c.closed = true
	session := c.session
	sessionID := c.sessionID
	c.startedMu.Unlock()

	c.closeOnce.Do(func() {
		close(c.done)
	})

	if session != nil {
		c.server.UnregisterSession(context.Background(), sessionID)
	}
	return nil
}

func (c *InProcessTransport) GetSessionId() string {
	return ""
}
