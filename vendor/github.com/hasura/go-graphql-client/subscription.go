package graphql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// Subscription transport follow Apollo's subscriptions-transport-ws protocol specification
// https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md

// OperationMessageType
type OperationMessageType string

const (
	// Client sends this message after plain websocket connection to start the communication with the server
	GQL_CONNECTION_INIT OperationMessageType = "connection_init"
	// The server may responses with this message to the GQL_CONNECTION_INIT from client, indicates the server rejected the connection.
	GQL_CONNECTION_ERROR OperationMessageType = "conn_err"
	// Client sends this message to execute GraphQL operation
	GQL_START OperationMessageType = "start"
	// Client sends this message in order to stop a running GraphQL operation execution (for example: unsubscribe)
	GQL_STOP OperationMessageType = "stop"
	// Server sends this message upon a failing operation, before the GraphQL execution, usually due to GraphQL validation errors (resolver errors are part of GQL_DATA message, and will be added as errors array)
	GQL_ERROR OperationMessageType = "error"
	// The server sends this message to transfter the GraphQL execution result from the server to the client, this message is a response for GQL_START message.
	GQL_DATA OperationMessageType = "data"
	// Server sends this message to indicate that a GraphQL operation is done, and no more data will arrive for the specific operation.
	GQL_COMPLETE OperationMessageType = "complete"
	// Server message that should be sent right after each GQL_CONNECTION_ACK processed and then periodically to keep the client connection alive.
	// The client starts to consider the keep alive message only upon the first received keep alive message from the server.
	GQL_CONNECTION_KEEP_ALIVE OperationMessageType = "ka"
	// The server may responses with this message to the GQL_CONNECTION_INIT from client, indicates the server accepted the connection. May optionally include a payload.
	GQL_CONNECTION_ACK OperationMessageType = "connection_ack"
	// Client sends this message to terminate the connection.
	GQL_CONNECTION_TERMINATE OperationMessageType = "connection_terminate"
	// Unknown operation type, for logging only
	GQL_UNKNOWN OperationMessageType = "unknown"
	// Internal status, for logging only
	GQL_INTERNAL OperationMessageType = "internal"
)

// ErrSubscriptionStopped a special error which forces the subscription stop
var ErrSubscriptionStopped = errors.New("subscription stopped")

// OperationMessage represents a subscription operation message
type OperationMessage struct {
	ID      string               `json:"id,omitempty"`
	Type    OperationMessageType `json:"type"`
	Payload json.RawMessage      `json:"payload,omitempty"`
}

func (om OperationMessage) String() string {
	bs, _ := json.Marshal(om)

	return string(bs)
}

// WebsocketHandler abstracts WebSocket connection functions
// ReadJSON and WriteJSON data of a frame from the WebSocket connection.
// Close the WebSocket connection.
type WebsocketConn interface {
	ReadJSON(v interface{}) error
	WriteJSON(v interface{}) error
	Close() error
	// SetReadLimit sets the maximum size in bytes for a message read from the peer. If a
	// message exceeds the limit, the connection sends a close message to the peer
	// and returns ErrReadLimit to the application.
	SetReadLimit(limit int64)
}

type handlerFunc func(data []byte, err error) error
type subscription struct {
	query     string
	variables map[string]interface{}
	handler   func(data []byte, err error)
	started   Boolean
}

// SubscriptionClient is a GraphQL subscription client.
type SubscriptionClient struct {
	url              string
	conn             WebsocketConn
	connectionParams map[string]interface{}
	websocketOptions WebsocketOptions
	context          context.Context
	subscriptions    map[string]*subscription
	cancel           context.CancelFunc
	subscribersMu    sync.Mutex
	timeout          time.Duration
	isRunning        int64
	readLimit        int64 // max size of response message. Default 10 MB
	log              func(args ...interface{})
	createConn       func(sc *SubscriptionClient) (WebsocketConn, error)
	retryTimeout     time.Duration
	onConnected      func()
	onDisconnected   func()
	onError          func(sc *SubscriptionClient, err error) error
	errorChan        chan error
	disabledLogTypes []OperationMessageType
}

func NewSubscriptionClient(url string) *SubscriptionClient {
	return &SubscriptionClient{
		url:           url,
		timeout:       time.Minute,
		readLimit:     10 * 1024 * 1024, // set default limit 10MB
		subscriptions: make(map[string]*subscription),
		createConn:    newWebsocketConn,
		retryTimeout:  time.Minute,
		errorChan:     make(chan error),
	}
}

// GetURL returns GraphQL server's URL
func (sc *SubscriptionClient) GetURL() string {
	return sc.url
}

// GetContext returns current context of subscription client
func (sc *SubscriptionClient) GetContext() context.Context {
	return sc.context
}

// GetContext returns write timeout of websocket client
func (sc *SubscriptionClient) GetTimeout() time.Duration {
	return sc.timeout
}

// WithWebSocket replaces customized websocket client constructor
// In default, subscription client uses https://github.com/nhooyr/websocket
func (sc *SubscriptionClient) WithWebSocket(fn func(sc *SubscriptionClient) (WebsocketConn, error)) *SubscriptionClient {
	sc.createConn = fn
	return sc
}

// WithWebSocketOptions provides options to the websocket client
func (sc *SubscriptionClient) WithWebSocketOptions(options WebsocketOptions) *SubscriptionClient {
	sc.websocketOptions = options
	return sc
}

// WithConnectionParams updates connection params for sending to server through GQL_CONNECTION_INIT event
// It's usually used for authentication handshake
func (sc *SubscriptionClient) WithConnectionParams(params map[string]interface{}) *SubscriptionClient {
	sc.connectionParams = params
	return sc
}

// WithTimeout updates write timeout of websocket client
func (sc *SubscriptionClient) WithTimeout(timeout time.Duration) *SubscriptionClient {
	sc.timeout = timeout
	return sc
}

// WithRetryTimeout updates reconnecting timeout. When the websocket server was stopped, the client will retry connecting every second until timeout
func (sc *SubscriptionClient) WithRetryTimeout(timeout time.Duration) *SubscriptionClient {
	sc.retryTimeout = timeout
	return sc
}

// WithLog sets loging function to print out received messages. By default, nothing is printed
func (sc *SubscriptionClient) WithLog(logger func(args ...interface{})) *SubscriptionClient {
	sc.log = logger
	return sc
}

// WithoutLogTypes these operation types won't be printed
func (sc *SubscriptionClient) WithoutLogTypes(types ...OperationMessageType) *SubscriptionClient {
	sc.disabledLogTypes = types
	return sc
}

// WithReadLimit set max size of response message
func (sc *SubscriptionClient) WithReadLimit(limit int64) *SubscriptionClient {
	sc.readLimit = limit
	return sc
}

// OnConnected event is triggered when there is any connection error. This is bottom exception handler level
// If this function is empty, or returns nil, the error is ignored
// If returns error, the websocket connection will be terminated
func (sc *SubscriptionClient) OnError(onError func(sc *SubscriptionClient, err error) error) *SubscriptionClient {
	sc.onError = onError
	return sc
}

// OnConnected event is triggered when the websocket connected to GraphQL server successfully
func (sc *SubscriptionClient) OnConnected(fn func()) *SubscriptionClient {
	sc.onConnected = fn
	return sc
}

// OnDisconnected event is triggered when the websocket client was disconnected
func (sc *SubscriptionClient) OnDisconnected(fn func()) *SubscriptionClient {
	sc.onDisconnected = fn
	return sc
}

func (sc *SubscriptionClient) setIsRunning(value Boolean) {
	if value {
		atomic.StoreInt64(&sc.isRunning, 1)
	} else {
		atomic.StoreInt64(&sc.isRunning, 0)
	}
}

func (sc *SubscriptionClient) init() error {

	now := time.Now()
	ctx, cancel := context.WithCancel(context.Background())
	sc.context = ctx
	sc.cancel = cancel

	for {
		var err error
		var conn WebsocketConn
		// allow custom websocket client
		if sc.conn == nil {
			conn, err = sc.createConn(sc)
			if err == nil {
				sc.conn = conn
			}
		}

		if err == nil {
			sc.conn.SetReadLimit(sc.readLimit)
			// send connection init event to the server
			err = sc.sendConnectionInit()
		}

		if err == nil {
			return nil
		}

		if now.Add(sc.retryTimeout).Before(time.Now()) {
			if sc.onDisconnected != nil {
				sc.onDisconnected()
			}
			return err
		}
		sc.printLog(fmt.Sprintf("%s. retry in second...", err.Error()), "client", GQL_INTERNAL)
		time.Sleep(time.Second)
	}
}

func (sc *SubscriptionClient) writeJSON(v interface{}) error {
	if sc.conn != nil {
		return sc.conn.WriteJSON(v)
	}
	return nil
}

func (sc *SubscriptionClient) printLog(message interface{}, source string, opType OperationMessageType) {
	if sc.log == nil {
		return
	}
	for _, ty := range sc.disabledLogTypes {
		if ty == opType {
			return
		}
	}

	sc.log(message, source)
}

func (sc *SubscriptionClient) sendConnectionInit() (err error) {
	var bParams []byte = nil
	if sc.connectionParams != nil {

		bParams, err = json.Marshal(sc.connectionParams)
		if err != nil {
			return
		}
	}

	// send connection_init event to the server
	msg := OperationMessage{
		Type:    GQL_CONNECTION_INIT,
		Payload: bParams,
	}

	sc.printLog(msg, "client", GQL_CONNECTION_INIT)
	return sc.writeJSON(msg)
}

// Subscribe sends start message to server and open a channel to receive data.
// The handler callback function will receive raw message data or error. If the call return error, onError event will be triggered
// The function returns subscription ID and error. You can use subscription ID to unsubscribe the subscription
func (sc *SubscriptionClient) Subscribe(v interface{}, variables map[string]interface{}, handler func(message []byte, err error) error, options ...Option) (string, error) {
	return sc.do(v, variables, handler, options...)
}

// NamedSubscribe sends start message to server and open a channel to receive data, with operation name
//
// Deprecated: this is the shortcut of Subscribe method, with NewOperationName option
func (sc *SubscriptionClient) NamedSubscribe(name string, v interface{}, variables map[string]interface{}, handler func(message []byte, err error) error, options ...Option) (string, error) {
	return sc.do(v, variables, handler, append(options, OperationName(name))...)
}

// SubscribeRaw sends start message to server and open a channel to receive data, with raw query
// Deprecated: use Exec instead
func (sc *SubscriptionClient) SubscribeRaw(query string, variables map[string]interface{}, handler func(message []byte, err error) error) (string, error) {
	return sc.doRaw(query, variables, handler)
}

// Exec sends start message to server and open a channel to receive data, with raw query
func (sc *SubscriptionClient) Exec(query string, variables map[string]interface{}, handler func(message []byte, err error) error) (string, error) {
	return sc.doRaw(query, variables, handler)
}

func (sc *SubscriptionClient) do(v interface{}, variables map[string]interface{}, handler func(message []byte, err error) error, options ...Option) (string, error) {
	query, err := ConstructSubscription(v, variables, options...)
	if err != nil {
		return "", err
	}

	return sc.doRaw(query, variables, handler)
}

func (sc *SubscriptionClient) doRaw(query string, variables map[string]interface{}, handler func(message []byte, err error) error) (string, error) {
	id := uuid.New().String()

	sub := subscription{
		query:     query,
		variables: variables,
		handler:   sc.wrapHandler(handler),
	}

	// if the websocket client is running, start subscription immediately
	if atomic.LoadInt64(&sc.isRunning) > 0 {
		if err := sc.startSubscription(id, &sub); err != nil {
			return "", err
		}
	}

	sc.subscribersMu.Lock()
	sc.subscriptions[id] = &sub
	sc.subscribersMu.Unlock()

	return id, nil
}

// Subscribe sends start message to server and open a channel to receive data
func (sc *SubscriptionClient) startSubscription(id string, sub *subscription) error {
	if sub == nil || sub.started {
		return nil
	}

	in := struct {
		Query     string                 `json:"query"`
		Variables map[string]interface{} `json:"variables,omitempty"`
	}{
		Query:     sub.query,
		Variables: sub.variables,
	}

	payload, err := json.Marshal(in)
	if err != nil {
		return err
	}

	// send stop message to the server
	msg := OperationMessage{
		ID:      id,
		Type:    GQL_START,
		Payload: payload,
	}

	sc.printLog(msg, "client", GQL_START)
	if err := sc.writeJSON(msg); err != nil {
		return err
	}

	sub.started = true
	return nil
}

func (sc *SubscriptionClient) wrapHandler(fn handlerFunc) func(data []byte, err error) {
	return func(data []byte, err error) {
		if errValue := fn(data, err); errValue != nil {
			sc.errorChan <- errValue
		}
	}
}

// Run start websocket client and subscriptions. If this function is run with goroutine, it can be stopped after closed
func (sc *SubscriptionClient) Run() error {
	if err := sc.init(); err != nil {
		return fmt.Errorf("retry timeout. exiting...")
	}

	// lazily start subscriptions
	sc.subscribersMu.Lock()
	for k, v := range sc.subscriptions {
		if err := sc.startSubscription(k, v); err != nil {
			sc.Unsubscribe(k)
			return err
		}
	}
	sc.subscribersMu.Unlock()

	sc.setIsRunning(true)
	go func() {
		for atomic.LoadInt64(&sc.isRunning) > 0 {
			select {
			case <-sc.context.Done():
				return
			default:
				if sc.conn == nil {
					return
				}

				var message OperationMessage
				if err := sc.conn.ReadJSON(&message); err != nil {
					// manual EOF check
					if err == io.EOF || strings.Contains(err.Error(), "EOF") {
						if err = sc.Reset(); err != nil {
							sc.errorChan <- err
							return
						}
					}
					closeStatus := websocket.CloseStatus(err)
					if closeStatus == websocket.StatusNormalClosure {
						// close event from websocket client, exiting...
						return
					}
					if closeStatus != -1 {
						sc.printLog(fmt.Sprintf("%s. Retry connecting...", err), "client", GQL_INTERNAL)
						if err = sc.Reset(); err != nil {
							sc.errorChan <- err
							return
						}
					}

					if sc.onError != nil {
						if err = sc.onError(sc, err); err != nil {
							return
						}
					}
					continue
				}

				switch message.Type {
				case GQL_ERROR:
					sc.printLog(message, "server", GQL_ERROR)
					fallthrough
				case GQL_DATA:
					sc.printLog(message, "server", GQL_DATA)
					id, err := uuid.Parse(message.ID)
					if err != nil {
						continue
					}

					sc.subscribersMu.Lock()
					sub, ok := sc.subscriptions[id.String()]
					sc.subscribersMu.Unlock()

					if !ok {
						continue
					}
					var out struct {
						Data   *json.RawMessage
						Errors Errors
					}

					err = json.Unmarshal(message.Payload, &out)
					if err != nil {
						go sub.handler(nil, err)
						continue
					}
					if len(out.Errors) > 0 {
						go sub.handler(nil, out.Errors)
						continue
					}

					var outData []byte
					if out.Data != nil && len(*out.Data) > 0 {
						outData = *out.Data
					}

					go sub.handler(outData, nil)
				case GQL_CONNECTION_ERROR:
					sc.printLog(message, "server", GQL_CONNECTION_ERROR)
				case GQL_COMPLETE:
					sc.printLog(message, "server", GQL_COMPLETE)
					sc.Unsubscribe(message.ID)
				case GQL_CONNECTION_KEEP_ALIVE:
					sc.printLog(message, "server", GQL_CONNECTION_KEEP_ALIVE)
				case GQL_CONNECTION_ACK:
					sc.printLog(message, "server", GQL_CONNECTION_ACK)
					if sc.onConnected != nil {
						sc.onConnected()
					}
				default:
					sc.printLog(message, "server", GQL_UNKNOWN)
				}
			}
		}
	}()

	for atomic.LoadInt64(&sc.isRunning) > 0 {
		select {
		case <-sc.context.Done():
			return nil
		case e := <-sc.errorChan:
			// stop the subscription if the error has stop message
			if e == ErrSubscriptionStopped {
				return nil
			}

			if sc.onError != nil {
				if err := sc.onError(sc, e); err != nil {
					return err
				}
			}
		}
	}
	// if the running status is false, stop retrying
	if atomic.LoadInt64(&sc.isRunning) == 0 {
		return nil
	}

	return sc.Reset()
}

// Unsubscribe sends stop message to server and close subscription channel
// The input parameter is subscription ID that is returned from Subscribe function
func (sc *SubscriptionClient) Unsubscribe(id string) error {
	sc.subscribersMu.Lock()
	defer sc.subscribersMu.Unlock()

	_, ok := sc.subscriptions[id]
	if !ok {
		return fmt.Errorf("subscription id %s doesn't not exist", id)
	}

	delete(sc.subscriptions, id)
	err := sc.stopSubscription(id)
	if err != nil {
		return err
	}

	// close the client if there is no running subscription
	if len(sc.subscriptions) == 0 {
		sc.printLog("no running subscription. exiting...", "client", GQL_INTERNAL)
		return sc.Close()
	}
	return nil
}

func (sc *SubscriptionClient) stopSubscription(id string) error {
	if sc.conn != nil {
		// send stop message to the server
		msg := OperationMessage{
			ID:   id,
			Type: GQL_STOP,
		}

		sc.printLog(msg, "server", GQL_STOP)
		if err := sc.writeJSON(msg); err != nil {
			return err
		}

	}

	return nil
}

func (sc *SubscriptionClient) terminate() error {
	// send terminate message to the server
	msg := OperationMessage{
		Type: GQL_CONNECTION_TERMINATE,
	}

	if sc.conn != nil {
		sc.printLog(msg, "client", GQL_CONNECTION_TERMINATE)
		return sc.writeJSON(msg)
	}

	return nil
}

// Reset restart websocket connection and subscriptions
func (sc *SubscriptionClient) Reset() error {
	if atomic.LoadInt64(&sc.isRunning) == 0 {
		return nil
	}

	sc.subscribersMu.Lock()
	for id, sub := range sc.subscriptions {
		_ = sc.stopSubscription(id)
		sub.started = false
	}
	sc.subscribersMu.Unlock()

	if sc.conn != nil {
		_ = sc.terminate()
		_ = sc.conn.Close()
		sc.conn = nil
	}
	sc.cancel()

	return sc.Run()
}

// Close closes all subscription channel and websocket as well
func (sc *SubscriptionClient) Close() (err error) {
	sc.setIsRunning(false)
	for id := range sc.subscriptions {
		if err = sc.Unsubscribe(id); err != nil {
			sc.cancel()
			return
		}
	}

	_ = sc.terminate()
	if sc.conn != nil {
		err = sc.conn.Close()
		sc.conn = nil
		if sc.onDisconnected != nil {
			sc.onDisconnected()
		}
	}
	sc.cancel()

	return
}

// default websocket handler implementation using https://github.com/nhooyr/websocket
type WebsocketHandler struct {
	ctx     context.Context
	timeout time.Duration
	*websocket.Conn
}

func (wh *WebsocketHandler) WriteJSON(v interface{}) error {
	ctx, cancel := context.WithTimeout(wh.ctx, wh.timeout)
	defer cancel()

	return wsjson.Write(ctx, wh.Conn, v)
}

func (wh *WebsocketHandler) ReadJSON(v interface{}) error {
	ctx, cancel := context.WithTimeout(wh.ctx, wh.timeout)
	defer cancel()
	return wsjson.Read(ctx, wh.Conn, v)
}

func (wh *WebsocketHandler) Close() error {
	return wh.Conn.Close(websocket.StatusNormalClosure, "close websocket")
}

func newWebsocketConn(sc *SubscriptionClient) (WebsocketConn, error) {

	options := &websocket.DialOptions{
		Subprotocols: []string{"graphql-ws"},
		HTTPClient:   sc.websocketOptions.HTTPClient,
	}

	c, _, err := websocket.Dial(sc.GetContext(), sc.GetURL(), options)
	if err != nil {
		return nil, err
	}

	return &WebsocketHandler{
		ctx:     sc.GetContext(),
		Conn:    c,
		timeout: sc.GetTimeout(),
	}, nil
}

// WebsocketOptions allows implementation agnostic configuration of the websocket client
type WebsocketOptions struct {
	// HTTPClient is used for the connection.
	HTTPClient *http.Client
}
