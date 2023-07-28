package graphql

import (
	"encoding/json"
	"fmt"
)

// This package implements GraphQL over WebSocket Protocol (graphql-ws)
// https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md

const (
	// Indicates that the client wants to establish a connection within the existing socket.
	// This connection is not the actual WebSocket communication channel, but is rather a frame within it asking the server to allow future operation requests.
	GQLConnectionInit OperationMessageType = "connection_init"
	// Expected response to the ConnectionInit message from the client acknowledging a successful connection with the server.
	GQLConnectionAck OperationMessageType = "connection_ack"
	// The Ping message can be sent at any time within the established socket.
	GQLPing OperationMessageType = "ping"
	// The response to the Ping message. Must be sent as soon as the Ping message is received.
	GQLPong OperationMessageType = "pong"
	// Requests an operation specified in the message payload. This message provides a unique ID field to connect published messages to the operation requested by this message.
	GQLSubscribe OperationMessageType = "subscribe"
	// Operation execution result(s) from the source stream created by the binding Subscribe message. After all results have been emitted, the Complete message will follow indicating stream completion.
	GQLNext OperationMessageType = "next"
	// Operation execution error(s) in response to the Subscribe message.
	// This can occur before execution starts, usually due to validation errors, or during the execution of the request.
	GQLError OperationMessageType = "error"
	// indicates that the requested operation execution has completed. If the server dispatched the Error message relative to the original Subscribe message, no Complete message will be emitted.
	GQLComplete OperationMessageType = "complete"
)

type graphqlWS struct {
}

// GetSubprotocols returns subprotocol names of the subscription transport
func (gws graphqlWS) GetSubprotocols() []string {
	return []string{"graphql-transport-ws"}
}

// ConnectionInit sends a initial request to establish a connection within the existing socket
func (gws *graphqlWS) ConnectionInit(ctx *SubscriptionContext, connectionParams map[string]interface{}) error {
	return connectionInit(ctx, connectionParams)
}

// Subscribe requests an graphql operation specified in the payload message
func (gws *graphqlWS) Subscribe(ctx *SubscriptionContext, sub Subscription) error {
	if sub.GetStatus() == SubscriptionRunning {
		return nil
	}
	payload, err := json.Marshal(sub.GetPayload())
	if err != nil {
		return err
	}
	// send start message to the server
	msg := OperationMessage{
		ID:      sub.id,
		Type:    GQLSubscribe,
		Payload: payload,
	}

	if err := ctx.Send(msg, GQLSubscribe); err != nil {
		return err
	}

	sub.SetStatus(SubscriptionRunning)
	ctx.SetSubscription(sub.GetKey(), &sub)

	return nil
}

// Unsubscribe sends stop message to server and close subscription channel
// The input parameter is subscription ID that is returned from Subscribe function
func (gws *graphqlWS) Unsubscribe(ctx *SubscriptionContext, sub Subscription) error {
	// send stop message to the server
	msg := OperationMessage{
		ID:   sub.id,
		Type: GQLComplete,
	}

	return ctx.Send(msg, GQLComplete)
}

// OnMessage listens ongoing messages from server
func (gws *graphqlWS) OnMessage(ctx *SubscriptionContext, subscription Subscription, message OperationMessage) error {

	switch message.Type {
	case GQLError:
		ctx.Log(message, "server", message.Type)
		var errs Errors
		jsonErr := json.Unmarshal(message.Payload, &errs)
		if jsonErr != nil {
			subscription.handler(nil, fmt.Errorf("%s", string(message.Payload)))
			return nil
		}
		if len(errs) > 0 {
			subscription.handler(nil, errs)
			return nil
		}
	case GQLNext:
		ctx.Log(message, "server", message.Type)
		var out struct {
			Data   *json.RawMessage
			Errors Errors
		}
		if subscription.handler == nil {
			return nil
		}

		err := json.Unmarshal(message.Payload, &out)
		if err != nil {
			subscription.handler(nil, err)
			return nil
		}
		if len(out.Errors) > 0 {
			subscription.handler(nil, out.Errors)
			return nil
		}

		var outData []byte
		if out.Data != nil && len(*out.Data) > 0 {
			outData = *out.Data
		}

		subscription.handler(outData, nil)
	case GQLComplete:
		ctx.Log(message, "server", message.Type)
		sub := ctx.GetSubscription(message.ID)
		if ctx.OnSubscriptionComplete != nil {
			if sub == nil {
				ctx.OnSubscriptionComplete(Subscription{
					id: message.ID,
				})
			} else {
				ctx.OnSubscriptionComplete(*sub)
			}
		}
		if sub != nil {
			ctx.SetSubscription(sub.GetKey(), nil)
		}
	case GQLPing:
		ctx.Log(message, "server", GQLPing)
		if ctx.OnConnectionAlive != nil {
			ctx.OnConnectionAlive()
		}
		// send pong response message back to the server
		msg := OperationMessage{
			Type:    GQLPong,
			Payload: message.Payload,
		}

		if err := ctx.Send(msg, GQLPong); err != nil {
			ctx.Log(err, "client", GQLInternal)
		}
	case GQLConnectionAck:
		// Expected response to the ConnectionInit message from the client acknowledging a successful connection with the server.
		// The client is now ready to request subscription operations.
		ctx.Log(message, "server", GQLConnectionAck)
		ctx.SetAcknowledge(true)
		for id, sub := range ctx.GetSubscriptions() {
			if err := gws.Subscribe(ctx, sub); err != nil {
				ctx.Log(fmt.Sprintf("failed to subscribe: %s; id: %s; query: %s", err, id, sub.payload.Query), "client", GQLInternal)
				return nil
			}
		}
		if ctx.OnConnected != nil {
			ctx.OnConnected()
		}
	default:
		ctx.Log(message, "server", GQLUnknown)
	}

	return nil
}

// Close terminates all subscriptions of the current websocket
func (gws *graphqlWS) Close(conn *SubscriptionContext) error {
	return nil
}
