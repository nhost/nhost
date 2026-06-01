// Package websocket implements the graphql-transport-ws protocol
// (https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md).
//
// This package is a pure protocol handler - it handles WebSocket upgrades,
// message parsing, and the protocol state machine, but delegates all business
// logic to the caller via the MessageHandler interface.
//
// # Architecture Overview
//
//	┌─────────────────────────────────────────────────────────────────────────┐
//	│                     websocket.NewConnection() (this package)                   │
//	│  - Upgrades HTTP to WebSocket                                           │
//	│  - Returns Connection with Loop() method                                │
//	│  - Uses sendCh for outgoing messages (shared with caller)               │
//	└─────────────────────────────────────────────────────────────────────────┘
//	                           │                    │
//	                           ▼                    ▼
//	┌───────────────────────────────────┐  ┌───────────────────────────────────┐
//	│        MessageHandler             │  │        sendCh chan *Message       │
//	│  (implemented by caller)          │  │  - Both protocol and caller       │
//	│  - OnConnectionInit: auth/session │  │    send messages via this channel │
//	│  - OnSubscribe: start sub         │  │  - writePump reads and sends to   │
//	│  - OnComplete: stop sub           │  │    WebSocket                      │
//	│  - OnClose: cleanup               │  └───────────────────────────────────┘
//	└───────────────────────────────────┘
//
// # Usage
//
// The caller creates a send channel, MessageHandler, and calls NewConnection():
//
//	// Create send channel for messages
//	sendCh := make(chan *websocket.Message, 50)
//
//	// Create your message handler (implements websocket.MessageHandler)
//	// Pass sendCh so it can send subscription data
//	handler := &MyHandler{
//	    sendCh: sendCh,
//	}
//
//	// Upgrade HTTP to WebSocket
//	conn, err := websocket.NewConnection(w, r, handler, sendCh)
//	if err != nil {
//	    return
//	}
//
//	// Start the message loop (blocks until connection closes)
//	conn.Loop()
//
// # Sending Messages
//
// Both the protocol (for acks, pings, errors) and the handler (for subscription
// data) send messages via the shared sendCh channel:
//
//	// Send subscription data
//	sendCh <- websocket.NewNextMessage(id, data, nil)
//
//	// Send error
//	sendCh <- websocket.NewErrorMessage(id, []map[string]any{{"message": "error"}})
//
// # MessageHandler Interface
//
// The MessageHandler interface defines callbacks for protocol events:
//
//   - OnConnectionInit: Called when client sends connection_init. Use this to
//     extract session information, validate credentials, etc. Return an error
//     to reject the connection.
//
//   - OnSubscribe: Called when client sends subscribe with query/variables.
//     Start the subscription and send updates via sendCh.
//
//   - OnComplete: Called when client sends complete to stop a subscription.
//
//   - OnClose: Called when the connection closes. Clean up all subscriptions.
//
// # Goroutine Model
//
// Per connection, the package manages two goroutines:
//
//	┌─────────────┐
//	│  readPump   │ ← Reads from WebSocket, parses messages, calls handlers
//	└─────────────┘
//
//	┌─────────────┐
//	│ writePump   │ ← Reads from sendCh, writes to WebSocket, sends pings
//	└─────────────┘
//
// The caller's MessageHandler implementation runs in the context of the
// readPump goroutine. All goroutines share a context derived from the HTTP
// request. When the connection closes, the context is cancelled.
//
// # Protocol Messages
//
// Client → Server:
//   - connection_init: Initialize connection with optional credentials
//   - ping: Keep-alive ping
//   - pong: Response to server ping
//   - subscribe: Start a new subscription
//   - complete: Stop a subscription
//
// Server → Client:
//   - connection_ack: Connection accepted (sent automatically after OnConnectionInit)
//   - ping: Keep-alive ping (sent automatically)
//   - next: Subscription data update (send via sendCh)
//   - error: Subscription error (send via sendCh)
//   - complete: Subscription ended (send via sendCh)
package websocket
