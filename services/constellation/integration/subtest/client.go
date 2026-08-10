// Package subtest provides a minimal graphql-transport-ws client for
// integration tests. The client handles WebSocket I/O, automatic ping/pong,
// and the connection_init / subscribe / complete framing, leaving payload
// shaping and assertion logic to the test author.
package subtest

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

const (
	ConnectionInit = "connection_init"
	ConnectionAck  = "connection_ack"
	Ping           = "ping"
	Pong           = "pong"
	Subscribe      = "subscribe"
	Complete       = "complete"
	Next           = "next"
	Error          = "error"
)

const (
	defaultTimeout   = 2 * time.Second
	defaultGracePd   = 50 * time.Millisecond
	defaultCloseWait = 1500 * time.Millisecond
)

// Message represents a graphql-transport-ws protocol message.
type Message struct {
	ID      string         `json:"id,omitempty"`
	Type    string         `json:"type"`
	Payload jsontext.Value `json:"payload,omitempty"`
}

// Client is a simple websocket test client for graphql-transport-ws.
// It handles the websocket connection and ping/pong automatically.
// Everything else is left to the test writer.
type Client struct {
	t         *testing.T
	conn      *websocket.Conn
	msgs      chan Message
	timeout   time.Duration
	gracePd   time.Duration
	closeWait time.Duration
	done      chan struct{}
}

// Option configures the Client.
type Option func(*config)

type config struct {
	timeout   time.Duration
	gracePd   time.Duration
	closeWait time.Duration
	header    http.Header
	dialer    *websocket.Dialer
}

// WithTimeout sets the timeout for Expect calls.
func WithTimeout(d time.Duration) Option {
	return func(c *config) {
		c.timeout = d
	}
}

// WithGracePeriod sets how long Send/Do wait for an unexpected message
// before proceeding. A longer grace period makes the check more reliable
// but slows down the test. Default is 50ms.
func WithGracePeriod(d time.Duration) Option {
	return func(c *config) {
		c.gracePd = d
	}
}

// WithCloseWait sets how long Close waits to catch a stray message that
// may arrive on the next subscription poll cycle. Decoupled from the
// Expect timeout so stream tests (which use a multi-second timeout for
// receiving polled batches) don't pay that cost again at teardown.
// Default is 1.5s — slightly more than the server's 1s poll interval.
func WithCloseWait(d time.Duration) Option {
	return func(c *config) {
		c.closeWait = d
	}
}

// WithHeader sets HTTP headers for the websocket handshake.
func WithHeader(header http.Header) Option {
	return func(c *config) {
		c.header = header
	}
}

// WithDialer sets a custom websocket dialer.
func WithDialer(d *websocket.Dialer) Option {
	return func(c *config) {
		c.dialer = d
	}
}

// NewClient dials a websocket connection and returns a Client.
// The URL can use ws://, wss://, http://, or https:// schemes.
// The connection is closed automatically when the test ends.
func NewClient(t *testing.T, url string, opts ...Option) (*Client, error) {
	t.Helper()

	cfg := &config{
		timeout:   defaultTimeout,
		gracePd:   defaultGracePd,
		closeWait: defaultCloseWait,
		header:    nil,
		dialer: &websocket.Dialer{ //nolint:exhaustruct
			Subprotocols:    []string{"graphql-transport-ws"},
			ReadBufferSize:  1024, //nolint:mnd
			WriteBufferSize: 1024, //nolint:mnd
		},
	}

	for _, opt := range opts {
		opt(cfg)
	}

	// Ensure subprotocol is set even with custom dialer.
	if cfg.dialer.Subprotocols == nil {
		cfg.dialer.Subprotocols = []string{"graphql-transport-ws"}
	}

	wsURL := url
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)

	conn, resp, err := cfg.dialer.Dial(wsURL, cfg.header)
	if err != nil {
		return nil, fmt.Errorf("websocket dial: %w", err)
	}

	resp.Body.Close()

	c := &Client{
		t:         t,
		conn:      conn,
		msgs:      make(chan Message, 100), //nolint:mnd
		timeout:   cfg.timeout,
		gracePd:   cfg.gracePd,
		closeWait: cfg.closeWait,
		done:      make(chan struct{}),
	}

	t.Cleanup(func() {
		conn.WriteMessage( //nolint:errcheck
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
		)
		conn.Close()
		<-c.done
	})

	go c.readPump()

	return c, nil
}

// readPump reads messages from the websocket, auto-responds to pings,
// and forwards everything else to the msgs channel.
func (c *Client) readPump() {
	defer close(c.done)

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			close(c.msgs)

			return
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		if msg.Type == Ping {
			pong, _ := json.Marshal(Message{ID: "", Type: Pong, Payload: nil})
			c.conn.WriteMessage(websocket.TextMessage, pong) //nolint:errcheck

			continue
		}

		c.msgs <- msg
	}
}

// assertNoUnreadMessages waits for the grace period and then fails the
// test if a message arrived. This gives the server a short window to
// respond so we don't silently skip an unexpected message just because
// it hadn't arrived yet.
func (c *Client) assertNoUnreadMessages() {
	c.t.Helper()

	select {
	case msg, ok := <-c.msgs:
		if ok {
			c.t.Fatalf(
				"subtest: unexpected unread message: type=%s id=%s payload=%s",
				msg.Type, msg.ID, string(msg.Payload),
			)
		}
	case <-time.After(c.gracePd):
	}
}

// Send marshals and sends a Message over the websocket.
// Fails if there are unread messages — call Expect first to consume them.
func (c *Client) Send(msg Message) *Client {
	c.t.Helper()

	c.assertNoUnreadMessages()

	data, err := json.Marshal(msg)
	if err != nil {
		c.t.Fatalf("subtest: marshal message: %v", err)
	}

	if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		c.t.Fatalf("subtest: send message: %v", err)
	}

	return c
}

// Expect reads the next message (excluding pings, which are handled
// automatically) and passes it to fn. If no message arrives within
// the configured timeout, the test fails.
func (c *Client) Expect(fn func(Message)) *Client {
	c.t.Helper()

	select {
	case msg, ok := <-c.msgs:
		if !ok {
			c.t.Fatal("subtest: connection closed while expecting message")
		}

		fn(msg)
	case <-time.After(c.timeout):
		c.t.Fatal("subtest: timeout waiting for message")
	}

	return c
}

// Do runs an arbitrary function. This is useful for performing side
// effects between Expect calls, such as sending an HTTP mutation that
// should trigger a subscription update.
// Fails if there are unread messages — call Expect first to consume them.
func (c *Client) Do(fn func() error) *Client {
	c.t.Helper()

	c.assertNoUnreadMessages()

	if err := fn(); err != nil {
		c.t.Fatalf("subtest: do: %v", err)
	}

	return c
}

// ExpectNone waits for d and fails if any message arrives during that time.
// Use this to verify that no subscription updates are sent (e.g. after
// unsubscribing or when data hasn't changed).
func (c *Client) ExpectNone(d time.Duration) *Client {
	c.t.Helper()

	select {
	case msg, ok := <-c.msgs:
		if ok {
			c.t.Fatalf(
				"subtest: unexpected message during ExpectNone: type=%s id=%s payload=%s",
				msg.Type, msg.ID, string(msg.Payload),
			)
		}

		c.t.Fatal("subtest: connection closed during ExpectNone")
	case <-time.After(d):
	}

	return c
}

// ExpectClosed waits for the server to close the connection.
// Fails if a message arrives or if the connection is not closed within the
// configured timeout.
func (c *Client) ExpectClosed() {
	c.t.Helper()

	select {
	case msg, ok := <-c.msgs:
		if ok {
			c.t.Fatalf(
				"subtest: expected connection to close, got message: type=%s id=%s payload=%s",
				msg.Type, msg.ID, string(msg.Payload),
			)
		}
		// ok == false means channel is closed → connection closed
	case <-time.After(c.timeout):
		c.t.Fatal("subtest: timeout waiting for connection to close")
	}
}

// Close sends a close message and closes the underlying connection.
// Normally this is called automatically via t.Cleanup, but it can
// be called explicitly to test close behavior.
//
// Unlike Send/Do (which use the short grace period), Close waits for
// the configured closeWait (default 1.5s, slightly more than the
// server's 1s poll interval) to catch messages that arrive on the
// next poll cycle (e.g. stream subscription batches). Decoupled from
// the Expect timeout so stream tests with multi-second timeouts don't
// pay that cost again at teardown.
func (c *Client) Close() {
	c.t.Helper()

	select {
	case msg, ok := <-c.msgs:
		if ok {
			c.t.Fatalf(
				"subtest: unexpected unread message: type=%s id=%s payload=%s",
				msg.Type, msg.ID, string(msg.Payload),
			)
		}
	case <-time.After(c.closeWait):
	}

	c.conn.WriteMessage( //nolint:errcheck
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
	)
	c.conn.Close()
	<-c.done
}
