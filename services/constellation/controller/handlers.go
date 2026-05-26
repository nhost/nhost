package controller

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

// defaultSendBufferSize bounds the per-connection WebSocket outbound queue.
// Frames are dropped when the buffer is full (see sendNext/sendError); the
// sender goroutine is therefore decoupled from slow consumers without ever
// blocking on the protocol layer.
const defaultSendBufferSize = 50

var errMetadataReloaded = errors.New("metadata reloaded")

// HandlerPost is the Gin handler for POST /graphql. It expects a JSON-encoded
// GraphQLRequest, dispatches it through Resolve, and writes the response —
// taking the raw-bytes fast path when the connector returned pre-built JSON.
func (c *Controller) HandlerPost(g *gin.Context) {
	if g.Request.Header.Get("Content-Type") != "application/json" {
		_ = g.Error(errContentTypeNotJSON)
		g.JSON(http.StatusBadRequest, errorResponse(errContentTypeNotJSON.Error()))

		return
	}

	var reqBody GraphQLRequest
	if err := json.UnmarshalRead(g.Request.Body, &reqBody); err != nil {
		err = fmt.Errorf("%w: %w", errInvalidRequestBody, err)
		_ = g.Error(err)
		g.JSON(http.StatusBadRequest, errorResponse(err.Error()))

		return
	}

	resp, err := c.Resolve(
		g.Request.Context(),
		reqBody,
	)
	if err != nil {
		_ = g.Error(fmt.Errorf("resolving request: %w", err))
		g.JSON(http.StatusInternalServerError, errorResponse(errInternalServerError.Error()))

		return
	}

	// Fast path: write pre-built response bytes directly, skipping json.Marshal.
	if resp.rawResponse != nil {
		g.Data(http.StatusOK, "application/json; charset=utf-8", resp.rawResponse)

		return
	}

	g.JSON(http.StatusOK, resp)
}

// HandlerGet is the Gin handler for GET /graphql. It upgrades the connection
// to a WebSocket when the client requests it (graphql-transport-ws) and
// otherwise replies with Method Not Allowed. Each accepted WebSocket
// connection snapshots the current controller state for its lifetime so a
// concurrent metadata reload cannot disturb in-flight subscriptions.
func (c *Controller) HandlerGet(g *gin.Context) {
	logger := requestcontext.LoggerFromContext(g.Request.Context())

	if g.GetHeader("Upgrade") == "websocket" {
		sendCh := make(chan *websocket.Message, defaultSendBufferSize)

		// Snapshot the current state for this connection. The done channel is
		// closed if the state is shut down (metadata reload), which cancels
		// the connection context and closes the WebSocket.
		state := c.state.Load()

		wsHandler := newWebSocketHandler(
			state,
			c.adminSecret,
			c.jwtAuth,
			c.pollingInterval,
			c.devMode,
			sendCh,
			logger,
		)

		conn, err := websocket.NewConnection(g.Writer, g.Request, wsHandler, sendCh)
		if err != nil {
			return
		}

		ctx, cancel := context.WithCancelCause(g.Request.Context())
		go func() {
			select {
			case <-state.done:
				cancel(errMetadataReloaded)
			case <-ctx.Done():
			}
		}()

		if err := conn.Loop(ctx, logger); err != nil {
			_ = g.Error(fmt.Errorf("websocket connection loop error: %w", err))
		}

		cancel(nil)

		return
	}

	g.JSON(http.StatusMethodNotAllowed, errorResponse("method not allowed"))
}
