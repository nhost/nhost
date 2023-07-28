package graphql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// SubscriptionProtocolType represents the protocol specification enum of the subscription
type SubscriptionProtocolType string

// internal subscription status
type SubscriptionStatus int32

const (
	// internal state machine status
	scStatusInitializing int32 = 0
	scStatusRunning      int32 = 1
	scStatusClosing      int32 = 2

	// SubscriptionWaiting the subscription hasn't been registered to the server
	SubscriptionWaiting SubscriptionStatus = 0
	// SubscriptionRunning the subscription is up and running
	SubscriptionRunning SubscriptionStatus = 1
	// SubscriptionUnsubscribed the subscription was manually unsubscribed by the user
	SubscriptionUnsubscribed SubscriptionStatus = 2

	// SubscriptionsTransportWS the enum implements the subscription transport that follows Apollo's subscriptions-transport-ws protocol specification
	// https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md
	SubscriptionsTransportWS SubscriptionProtocolType = "subscriptions-transport-ws"

	// GraphQLWS enum implements GraphQL over WebSocket Protocol (graphql-ws)
	// https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
	GraphQLWS SubscriptionProtocolType = "graphql-ws"

	// Receiving a message of a type or format which is not specified in this document
	// The <error-message> can be vaguely descriptive on why the received message is invalid.
	StatusInvalidMessage websocket.StatusCode = 4400
	// if the connection is not acknowledged, the socket will be closed immediately with the event 4401: Unauthorized
	StatusUnauthorized websocket.StatusCode = 4401
	// Connection initialisation timeout
	StatusConnectionInitialisationTimeout websocket.StatusCode = 4408
	// Subscriber for <generated-id> already exists
	StatusSubscriberAlreadyExists websocket.StatusCode = 4409
	// Too many initialisation requests
	StatusTooManyInitialisationRequests websocket.StatusCode = 4429
)

// OperationMessageType represents a subscription message enum type
type OperationMessageType string

const (
	// Unknown operation type, for logging only
	GQLUnknown OperationMessageType = "unknown"
	// Internal status, for logging only
	GQLInternal OperationMessageType = "internal"

	// @deprecated: use GQLUnknown instead
	GQL_UNKNOWN = GQLUnknown
	// @deprecated: use GQLInternal instead
	GQL_INTERNAL = GQLInternal
)

var (
	// ErrSubscriptionStopped a special error which forces the subscription stop
	ErrSubscriptionStopped = errors.New("subscription stopped")
	// ErrSubscriptionNotExists an error denoting that subscription does not exist
	ErrSubscriptionNotExists = errors.New("subscription does not exist")

	errRetry = errors.New("retry subscription client")
)

// OperationMessage represents a subscription operation message
type OperationMessage struct {
	ID      string               `json:"id,omitempty"`
	Type    OperationMessageType `json:"type"`
	Payload json.RawMessage      `json:"payload,omitempty"`
}

// String overrides the default Stringer to return json string for debugging
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
	// GetCloseStatus tries to get WebSocket close status from error
	// return -1 if the error is unknown
	// https://www.iana.org/assignments/websocket/websocket.xhtml
	GetCloseStatus(error) int32
}

// SubscriptionProtocol abstracts the life-cycle of subscription protocol implementation for a specific transport protocol
type SubscriptionProtocol interface {
	// GetSubprotocols returns subprotocol names of the subscription transport
	// The graphql server depends on the Sec-WebSocket-Protocol header to return the correct message specification
	GetSubprotocols() []string
	// ConnectionInit sends a initial request to establish a connection within the existing socket
	ConnectionInit(ctx *SubscriptionContext, connectionParams map[string]interface{}) error
	// Subscribe requests an graphql operation specified in the payload message
	Subscribe(ctx *SubscriptionContext, sub Subscription) error
	// Unsubscribe sends a request to stop listening and complete the subscription
	Unsubscribe(ctx *SubscriptionContext, sub Subscription) error
	// OnMessage listens ongoing messages from server
	OnMessage(ctx *SubscriptionContext, subscription Subscription, message OperationMessage) error
	// Close terminates all subscriptions of the current websocket
	Close(ctx *SubscriptionContext) error
}

// SubscriptionContext represents a shared context for protocol implementations with the websocket connection inside
type SubscriptionContext struct {
	context.Context
	websocketConn WebsocketConn

	OnConnected            func()
	OnDisconnected         func()
	OnConnectionAlive      func()
	OnSubscriptionComplete func(sub Subscription)

	cancel           context.CancelFunc
	subscriptions    map[string]Subscription
	disabledLogTypes []OperationMessageType
	log              func(args ...interface{})
	acknowledged     int32
	retryStatusCodes [][]int32
	mutex            sync.Mutex
}

// Log prints condition logging with message type filters
func (sc *SubscriptionContext) Log(message interface{}, source string, opType OperationMessageType) {
	if sc == nil || sc.log == nil {
		return
	}
	for _, ty := range sc.disabledLogTypes {
		if ty == opType {
			return
		}
	}

	sc.log(message, source)
}

// GetContext get the inner context
func (sc *SubscriptionContext) GetContext() context.Context {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	return sc.Context
}

// GetContext set the inner context
func (sc *SubscriptionContext) NewContext() {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	ctx, cancel := context.WithCancel(context.Background())
	sc.Context = ctx
	sc.cancel = cancel
}

// SetCancel set the cancel function of the inner context
func (sc *SubscriptionContext) Cancel() {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	if sc.cancel != nil {
		sc.cancel()
		sc.cancel = nil
	}
}

// GetWebsocketConn get the current websocket connection
func (sc *SubscriptionContext) GetWebsocketConn() WebsocketConn {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	return sc.websocketConn
}

// SetWebsocketConn set the current websocket connection
func (sc *SubscriptionContext) SetWebsocketConn(conn WebsocketConn) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	sc.websocketConn = conn
}

// GetSubscription get the subscription state by id
func (sc *SubscriptionContext) GetSubscription(id string) *Subscription {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	if sc.subscriptions == nil {
		return nil
	}
	sub, found := sc.subscriptions[id]
	if found {
		return &sub
	}

	for _, s := range sc.subscriptions {
		if id == s.id {
			return &s
		}
	}
	return nil
}

// GetSubscriptionsLength returns the length of subscriptions by status
func (sc *SubscriptionContext) GetSubscriptionsLength(status []SubscriptionStatus) int {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	if len(status) == 0 {
		return len(sc.subscriptions)
	}
	count := 0
	for _, sub := range sc.subscriptions {
		for _, s := range status {
			if sub.status == s {
				count++
				break
			}
		}
	}
	return count
}

// GetSubscription get all available subscriptions in the context
func (sc *SubscriptionContext) GetSubscriptions() map[string]Subscription {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	newMap := make(map[string]Subscription)
	for k, v := range sc.subscriptions {
		newMap[k] = v
	}
	return newMap
}

// SetSubscription set the input subscription state into the context
// if subscription is nil, removes the subscription from the map
func (sc *SubscriptionContext) SetSubscription(key string, sub *Subscription) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	if sub == nil {
		delete(sc.subscriptions, key)
	} else {
		sc.subscriptions[key] = *sub
	}
}

// GetAcknowledge get the acknowledge status
func (sc *SubscriptionContext) GetAcknowledge() bool {
	return atomic.LoadInt32(&sc.acknowledged) > 0
}

// SetAcknowledge set the acknowledge status
func (sc *SubscriptionContext) SetAcknowledge(value bool) {
	if value {
		atomic.StoreInt32(&sc.acknowledged, 1)
	} else {
		atomic.StoreInt32(&sc.acknowledged, 0)
	}
}

// Close closes the context and the inner websocket connection if exists
func (sc *SubscriptionContext) Close() error {
	var err error
	if conn := sc.GetWebsocketConn(); conn != nil {
		sc.SetWebsocketConn(nil)
		if sc.OnDisconnected != nil {
			sc.OnDisconnected()
		}
		err = conn.Close()
	}

	sc.Cancel()

	return err
}

// Send emits a message to the graphql server
func (sc *SubscriptionContext) Send(message interface{}, opType OperationMessageType) error {
	if conn := sc.GetWebsocketConn(); conn != nil {
		sc.Log(message, "client", opType)
		return conn.WriteJSON(message)
	}
	return nil
}

type handlerFunc func(data []byte, err error) error

// Subscription stores the subscription declaration and its state
type Subscription struct {
	id      string
	key     string
	payload GraphQLRequestPayload
	handler func(data []byte, err error)
	status  SubscriptionStatus
}

// GetID returns the subscription ID
func (s Subscription) GetID() string {
	return s.id
}

// GetKey returns the unique key of the subscription map
// Key is the immutable id of the subscription that is generated the first time
// It is used for searching because the subscription id is refreshed whenever the client reset
func (s Subscription) GetKey() string {
	return s.key
}

// GetPayload returns the graphql request payload
func (s Subscription) GetPayload() GraphQLRequestPayload {
	return s.payload
}

// GetHandler a public getter for the subscription handler
func (s Subscription) GetHandler() func(data []byte, err error) {
	return s.handler
}

// GetStatus a public getter for the subscription status
func (s Subscription) GetStatus() SubscriptionStatus {
	return s.status
}

// SetStatus a public getter for the subscription status
func (s *Subscription) SetStatus(status SubscriptionStatus) {
	s.status = status
}

// SubscriptionClient is a GraphQL subscription client.
type SubscriptionClient struct {
	url                    string
	context                *SubscriptionContext
	connectionParams       map[string]interface{}
	connectionParamsFn     func() map[string]interface{}
	protocol               SubscriptionProtocol
	websocketOptions       WebsocketOptions
	timeout                time.Duration
	clientStatus           int32
	readLimit              int64 // max size of response message. Default 10 MB
	createConn             func(sc *SubscriptionClient) (WebsocketConn, error)
	retryTimeout           time.Duration
	onError                func(sc *SubscriptionClient, err error) error
	errorChan              chan error
	exitWhenNoSubscription bool
	mutex                  sync.Mutex
}

// NewSubscriptionClient constructs new subscription client
func NewSubscriptionClient(url string) *SubscriptionClient {
	return &SubscriptionClient{
		url:                    url,
		timeout:                time.Minute,
		readLimit:              10 * 1024 * 1024, // set default limit 10MB
		createConn:             newWebsocketConn,
		retryTimeout:           time.Minute,
		errorChan:              make(chan error),
		protocol:               &subscriptionsTransportWS{},
		exitWhenNoSubscription: true,
		context: &SubscriptionContext{
			subscriptions: make(map[string]Subscription),
		},
	}
}

// GetURL returns GraphQL server's URL
func (sc *SubscriptionClient) GetURL() string {
	return sc.url
}

// GetTimeout returns write timeout of websocket client
func (sc *SubscriptionClient) GetTimeout() time.Duration {
	return sc.timeout
}

// GetContext returns current context of subscription client
func (sc *SubscriptionClient) GetContext() context.Context {
	return sc.getContext().GetContext()
}

// WithWebSocket replaces customized websocket client constructor
// In default, subscription client uses https://github.com/nhooyr/websocket
func (sc *SubscriptionClient) WithWebSocket(fn func(sc *SubscriptionClient) (WebsocketConn, error)) *SubscriptionClient {
	sc.createConn = fn
	return sc
}

// WithProtocol changes the subscription protocol implementation
// By default the subscription client uses the subscriptions-transport-ws protocol
func (sc *SubscriptionClient) WithProtocol(protocol SubscriptionProtocolType) *SubscriptionClient {

	switch protocol {
	case GraphQLWS:
		sc.protocol = &graphqlWS{}
	case SubscriptionsTransportWS:
		sc.protocol = &subscriptionsTransportWS{}
	default:
		panic(fmt.Sprintf("unknown subscription protocol %s", protocol))
	}
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

// WithConnectionParamsFn set a function that returns connection params for sending to server through GQL_CONNECTION_INIT event
// It's suitable for short-lived access tokens that need to be refreshed frequently
func (sc *SubscriptionClient) WithConnectionParamsFn(fn func() map[string]interface{}) *SubscriptionClient {
	sc.connectionParamsFn = fn
	return sc
}

// WithTimeout updates read and write timeout of websocket client
func (sc *SubscriptionClient) WithTimeout(timeout time.Duration) *SubscriptionClient {
	sc.timeout = timeout
	return sc
}

// WithRetryTimeout updates reconnecting timeout. When the websocket server was stopped, the client will retry connecting every second until timeout
// The zero value means unlimited timeout
func (sc *SubscriptionClient) WithRetryTimeout(timeout time.Duration) *SubscriptionClient {
	sc.retryTimeout = timeout
	return sc
}

// WithExitWhenNoSubscription the client should exit when all subscriptions were closed
func (sc *SubscriptionClient) WithExitWhenNoSubscription(value bool) *SubscriptionClient {
	sc.exitWhenNoSubscription = value
	return sc
}

// WithLog sets logging function to print out received messages. By default, nothing is printed
func (sc *SubscriptionClient) WithLog(logger func(args ...interface{})) *SubscriptionClient {
	sc.context.log = logger
	return sc
}

// WithoutLogTypes these operation types won't be printed
func (sc *SubscriptionClient) WithoutLogTypes(types ...OperationMessageType) *SubscriptionClient {
	sc.context.disabledLogTypes = types
	return sc
}

// WithReadLimit set max size of response message
func (sc *SubscriptionClient) WithReadLimit(limit int64) *SubscriptionClient {
	sc.readLimit = limit
	return sc
}

// WithRetryStatusCodes allow retry the subscription connection when receiving one of these codes
// the input parameter can be number string or range, e.g 4000-5000
func (sc *SubscriptionClient) WithRetryStatusCodes(codes ...string) *SubscriptionClient {

	statusCodes, err := parseInt32Ranges(codes)
	if err != nil {
		panic(err)
	}
	sc.context.retryStatusCodes = statusCodes
	return sc
}

// OnError event is triggered when there is any connection error. This is bottom exception handler level
// If this function is empty, or returns nil, the client restarts the connection
// If returns error, the websocket connection will be terminated
func (sc *SubscriptionClient) OnError(onError func(sc *SubscriptionClient, err error) error) *SubscriptionClient {
	sc.onError = onError
	return sc
}

// OnConnected event is triggered when the websocket connected to GraphQL server successfully
func (sc *SubscriptionClient) OnConnected(fn func()) *SubscriptionClient {
	sc.context.OnConnected = fn
	return sc
}

// OnDisconnected event is triggered when the websocket client was disconnected
func (sc *SubscriptionClient) OnDisconnected(fn func()) *SubscriptionClient {
	sc.context.OnDisconnected = fn
	return sc
}

// OnConnectionAlive event is triggered when the websocket receive a connection alive message (differs per protocol)
func (sc *SubscriptionClient) OnConnectionAlive(fn func()) *SubscriptionClient {
	sc.context.OnConnectionAlive = fn
	return sc
}

// OnSubscriptionComplete event is triggered when the subscription receives a terminated message from the server
func (sc *SubscriptionClient) OnSubscriptionComplete(fn func(sub Subscription)) *SubscriptionClient {
	sc.context.OnSubscriptionComplete = fn
	return sc
}

func (sc *SubscriptionClient) getContext() *SubscriptionContext {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	return sc.context
}

func (sc *SubscriptionClient) setContext(value *SubscriptionContext) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	sc.context = value
}

// get internal client status
func (sc *SubscriptionClient) getClientStatus() int32 {
	return atomic.LoadInt32(&sc.clientStatus)
}

// set the running atomic lock status
func (sc *SubscriptionClient) setClientStatus(value int32) {
	atomic.StoreInt32(&sc.clientStatus, value)
}

// initializes the websocket connection
func (sc *SubscriptionClient) init() error {

	now := time.Now()
	ctx := sc.getContext()
	for {
		var err error
		var conn WebsocketConn
		// allow custom websocket client
		if ctx.GetWebsocketConn() == nil {
			ctx.NewContext()
			conn, err = sc.createConn(sc)
			if err == nil {
				ctx.SetWebsocketConn(conn)
			}
		}

		if err == nil {
			ctx.GetWebsocketConn().SetReadLimit(sc.readLimit)
			// send connection init event to the server
			connectionParams := sc.connectionParams
			if sc.connectionParamsFn != nil {
				connectionParams = sc.connectionParamsFn()
			}
			err = sc.protocol.ConnectionInit(ctx, connectionParams)
		}

		if err == nil {
			return nil
		}

		if sc.retryTimeout > 0 && now.Add(sc.retryTimeout).Before(time.Now()) {
			if ctx.OnDisconnected != nil {
				ctx.OnDisconnected()
			}
			return err
		}
		ctx.Log(fmt.Sprintf("%s. retry in second...", err.Error()), "client", GQLInternal)
		time.Sleep(time.Second)
	}
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
	return sc.doRaw(query, variables, "", handler)
}

// Exec sends start message to server and open a channel to receive data, with raw query
func (sc *SubscriptionClient) Exec(query string, variables map[string]interface{}, handler func(message []byte, err error) error) (string, error) {
	return sc.doRaw(query, variables, "", handler)
}

func (sc *SubscriptionClient) do(v interface{}, variables map[string]interface{}, handler func(message []byte, err error) error, options ...Option) (string, error) {
	query, operationName, err := ConstructSubscription(v, variables, options...)
	if err != nil {
		return "", err
	}

	return sc.doRaw(query, variables, operationName, handler)
}

func (sc *SubscriptionClient) doRaw(query string, variables map[string]interface{}, operationName string, handler func(message []byte, err error) error) (string, error) {
	id := uuid.New().String()

	sub := Subscription{
		id:  id,
		key: id,
		payload: GraphQLRequestPayload{
			Query:         query,
			Variables:     variables,
			OperationName: operationName,
		},
		handler: sc.wrapHandler(handler),
	}

	// if the websocket client is running and acknowledged by the server
	// start subscription immediately
	ctx := sc.getContext()
	if ctx != nil && sc.getClientStatus() == scStatusRunning && ctx.GetAcknowledge() {
		if err := sc.protocol.Subscribe(ctx, sub); err != nil {
			return "", err
		}
	} else {
		ctx.SetSubscription(id, &sub)
	}

	return id, nil
}

func (sc *SubscriptionClient) wrapHandler(fn handlerFunc) func(data []byte, err error) {
	return func(data []byte, err error) {
		if errValue := fn(data, err); errValue != nil {
			sc.errorChan <- errValue
		}
	}
}

// Unsubscribe sends stop message to server and close subscription channel
// The input parameter is subscription ID that is returned from Subscribe function
func (sc *SubscriptionClient) Unsubscribe(id string) error {
	ctx := sc.getContext()
	if ctx == nil || ctx.GetWebsocketConn() == nil {
		return nil
	}
	sub := ctx.GetSubscription(id)

	if sub == nil {
		return fmt.Errorf("%s, %w", id, ErrSubscriptionNotExists)
	}

	if sub.status == SubscriptionUnsubscribed {
		return nil
	}
	var err error
	if sub.status == SubscriptionRunning {
		err = sc.protocol.Unsubscribe(ctx, *sub)
	}
	sub.status = SubscriptionUnsubscribed
	ctx.SetSubscription(sub.key, sub)

	sc.checkSubscriptionStatuses(ctx)

	return err
}

// Run start the WebSocket client and subscriptions.
// If the client is running, recalling this function will restart all registered subscriptions
// If this function is run with goroutine, it can be stopped after closed
func (sc *SubscriptionClient) Run() error {

	if sc.getClientStatus() != scStatusInitializing {
		sc.reset()
	}

	if err := sc.init(); err != nil {
		return fmt.Errorf("retry timeout. exiting...")
	}

	subContext := sc.getContext()
	if subContext == nil {
		return fmt.Errorf("the subscription context is nil")
	}

	conn := subContext.GetWebsocketConn()
	if conn == nil {
		return fmt.Errorf("the websocket connection hasn't been created")
	}

	sc.setClientStatus(scStatusRunning)
	ctx := subContext.GetContext()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				var message OperationMessage
				if err := conn.ReadJSON(&message); err != nil {
					// manual EOF check
					if err == io.EOF || strings.Contains(err.Error(), "EOF") || strings.Contains(err.Error(), "connection reset by peer") {
						sc.errorChan <- errRetry
						return
					}
					if errors.Is(err, context.Canceled) {
						return
					}

					closeStatus := conn.GetCloseStatus(err)

					for _, retryCode := range subContext.retryStatusCodes {
						if (len(retryCode) == 1 && retryCode[0] == closeStatus) ||
							(len(retryCode) >= 2 && retryCode[0] <= closeStatus && closeStatus <= retryCode[1]) {
							sc.errorChan <- errRetry
							return
						}
					}

					switch websocket.StatusCode(closeStatus) {
					case websocket.StatusBadGateway, websocket.StatusNoStatusRcvd:
						sc.errorChan <- errRetry
						return
					case websocket.StatusNormalClosure, websocket.StatusAbnormalClosure:
						// close event from websocket client, exiting...
						subContext.Cancel()
						return
					case StatusInvalidMessage, StatusConnectionInitialisationTimeout, StatusTooManyInitialisationRequests, StatusSubscriberAlreadyExists, StatusUnauthorized:
						subContext.Log(err, "server", GQL_CONNECTION_ERROR)
						sc.errorChan <- err
						return
					}

					if sc.onError != nil {
						if err = sc.onError(sc, err); err != nil {
							// end the subscription if the callback return error
							subContext.Cancel()
							return
						}
					}
					continue
				}

				sub := subContext.GetSubscription(message.ID)
				if sub == nil {
					sub = &Subscription{}
				}
				go func() {
					if err := sc.protocol.OnMessage(subContext, *sub, message); err != nil {
						sc.errorChan <- err
					}

					sc.checkSubscriptionStatuses(subContext)
				}()
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return sc.close(subContext)
		case e := <-sc.errorChan:
			if sc.getClientStatus() == scStatusClosing {
				return nil
			}

			// stop the subscription if the error has stop message
			if e == ErrSubscriptionStopped {
				return sc.close(subContext)
			}
			if e == errRetry {
				return sc.Run()
			}

			if sc.onError != nil {
				if err := sc.onError(sc, e); err != nil {
					sc.close(subContext)
					return err
				} else {
					return sc.Run()
				}
			}
		}
	}
}

// close the running websocket connection and reset all subscription states
func (sc *SubscriptionClient) reset() {
	subContext := sc.getContext()
	// fork a new subscription context to start a new session
	// avoid conflicting with the last running session what is shutting down
	newContext := &SubscriptionContext{
		OnConnected:            subContext.OnConnected,
		OnDisconnected:         subContext.OnDisconnected,
		OnSubscriptionComplete: subContext.OnSubscriptionComplete,
		disabledLogTypes:       subContext.disabledLogTypes,
		log:                    subContext.log,
		retryStatusCodes:       subContext.retryStatusCodes,
		subscriptions:          make(map[string]Subscription),
	}

	for key, sub := range subContext.GetSubscriptions() {
		// remove subscriptions that are manually unsubscribed by the user
		if sub.status == SubscriptionUnsubscribed {
			continue
		}
		if sub.status == SubscriptionRunning {
			sc.protocol.Unsubscribe(subContext, sub)
		}

		// should restart subscriptions with new id
		// to avoid subscription id conflict errors from the server
		sub.id = uuid.NewString()
		sub.status = SubscriptionWaiting
		newContext.SetSubscription(key, &sub)
	}

	sc.protocol.Close(subContext)
	subContext.Close()

	sc.setClientStatus(scStatusInitializing)
	sc.setContext(newContext)
}

// Close closes all subscription channel and websocket as well
func (sc *SubscriptionClient) Close() (err error) {
	return sc.close(sc.getContext())
}

func (sc *SubscriptionClient) close(ctx *SubscriptionContext) (err error) {
	if sc.getClientStatus() == scStatusClosing {
		return nil
	}

	sc.setClientStatus(scStatusClosing)
	if ctx == nil {
		return
	}
	unsubscribeErrors := make(map[string]error)

	conn := ctx.GetWebsocketConn()

	for key, sub := range ctx.GetSubscriptions() {
		ctx.SetSubscription(key, nil)
		if conn == nil {
			continue
		}
		if sub.status == SubscriptionRunning {
			if err := sc.protocol.Unsubscribe(ctx, sub); err != nil {
				unsubscribeErrors[key] = err
			}
		}
	}

	var protocolCloseError error
	if conn != nil {
		protocolCloseError = sc.protocol.Close(ctx)
	}

	closeError := ctx.Close()

	if len(unsubscribeErrors) > 0 {
		return Error{
			Message: "failed to close the subscription client",
			Extensions: map[string]interface{}{
				"unsubscribe": unsubscribeErrors,
				"protocol":    protocolCloseError,
				"close":       closeError,
			},
		}
	}
	return nil
}

func (sc *SubscriptionClient) checkSubscriptionStatuses(ctx *SubscriptionContext) {
	// close the client if there is no running subscription
	if sc.exitWhenNoSubscription && ctx.GetSubscriptionsLength([]SubscriptionStatus{
		SubscriptionRunning,
		SubscriptionWaiting,
	}) == 0 {
		ctx.Log("no running subscription. exiting...", "client", GQLInternal)
		ctx.Cancel()
	}
}

// the reusable function for sending connection init message.
// The payload format of both subscriptions-transport-ws and graphql-ws are the same
func connectionInit(conn *SubscriptionContext, connectionParams map[string]interface{}) error {
	var bParams []byte = nil
	var err error
	if connectionParams != nil {
		bParams, err = json.Marshal(connectionParams)
		if err != nil {
			return err
		}
	}

	// send connection_init event to the server
	msg := OperationMessage{
		Type:    GQLConnectionInit,
		Payload: bParams,
	}

	return conn.Send(msg, GQLConnectionInit)
}

func parseInt32Ranges(codes []string) ([][]int32, error) {
	statusCodes := make([][]int32, 0, len(codes))
	for _, c := range codes {
		sRange := strings.Split(c, "-")
		iRange := make([]int32, len(sRange))
		for j, sCode := range sRange {
			i, err := strconv.ParseInt(sCode, 10, 32)
			if err != nil {
				return nil, fmt.Errorf("invalid status code; input: %s", sCode)
			}
			iRange[j] = int32(i)
		}
		if len(iRange) > 0 {
			statusCodes = append(statusCodes, iRange)
		}
	}

	return statusCodes, nil
}

// default websocket handler implementation using https://github.com/nhooyr/websocket
type WebsocketHandler struct {
	ctx     context.Context
	timeout time.Duration
	*websocket.Conn
}

// WriteJSON implements the function to encode and send message in json format to the server
func (wh *WebsocketHandler) WriteJSON(v interface{}) error {
	ctx, cancel := context.WithTimeout(wh.ctx, wh.timeout)
	defer cancel()

	return wsjson.Write(ctx, wh.Conn, v)
}

// ReadJSON implements the function to decode the json message from the server
func (wh *WebsocketHandler) ReadJSON(v interface{}) error {
	ctx, cancel := context.WithTimeout(wh.ctx, wh.timeout)
	defer cancel()
	return wsjson.Read(ctx, wh.Conn, v)
}

// Close implements the function to close the websocket connection
func (wh *WebsocketHandler) Close() error {
	return wh.Conn.Close(websocket.StatusNormalClosure, "close websocket")
}

// GetCloseStatus tries to get WebSocket close status from error
// https://www.iana.org/assignments/websocket/websocket.xhtml
func (wh *WebsocketHandler) GetCloseStatus(err error) int32 {
	// context timeout error returned from ReadJSON or WriteJSON
	// try to ping the server, if failed return abnormal closeure error
	if errors.Is(err, context.DeadlineExceeded) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if pingErr := wh.Ping(ctx); pingErr != nil {
			return int32(websocket.StatusNoStatusRcvd)
		}
		return -1
	}

	code := websocket.CloseStatus(err)
	if code == -1 && strings.Contains(err.Error(), "received header with unexpected rsv bits") {
		return int32(websocket.StatusNormalClosure)
	}

	return int32(code)
}

// the default constructor function to create a websocket client
// which uses https://github.com/nhooyr/websocket library
func newWebsocketConn(sc *SubscriptionClient) (WebsocketConn, error) {

	options := &websocket.DialOptions{
		Subprotocols: sc.protocol.GetSubprotocols(),
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
