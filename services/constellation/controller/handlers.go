package controller

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"mime"
	"net/http"

	"github.com/gin-gonic/gin"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

const bytesPerMiB int64 = 1024 * 1024

// DefaultMaxGraphQLRequestBodyBytes is the default JSON body cap for POST
// GraphQL requests. Operators can override it on the serve command; direct
// HandlerPost users get this safe default.
const DefaultMaxGraphQLRequestBodyBytes int64 = 10 * bytesPerMiB

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
	c.handlePost(g, DefaultMaxGraphQLRequestBodyBytes)
}

// HandlerPostWithMaxBodyBytes returns a Gin handler for POST /graphql that
// rejects JSON request bodies larger than maxBodyBytes. Non-positive values use
// DefaultMaxGraphQLRequestBodyBytes so direct callers cannot accidentally create
// an unbounded handler.
func (c *Controller) HandlerPostWithMaxBodyBytes(maxBodyBytes int64) gin.HandlerFunc {
	return func(g *gin.Context) {
		c.handlePost(g, maxBodyBytes)
	}
}

func (c *Controller) handlePost(g *gin.Context, maxBodyBytes int64) {
	maxBodyBytes = normalizeMaxGraphQLRequestBodyBytes(maxBodyBytes)
	if g.Request.ContentLength > maxBodyBytes {
		err := fmt.Errorf("%w: limit is %d bytes", errRequestBodyTooLarge, maxBodyBytes)
		_ = g.Error(err)
		g.JSON(http.StatusRequestEntityTooLarge, errorResponse(errRequestBodyTooLarge.Error()))

		return
	}

	g.Request.Body = http.MaxBytesReader(g.Writer, g.Request.Body, maxBodyBytes)
	// A missing Content-Type is treated as application/json. Otherwise the
	// media type is parsed so that parameters such as "; charset=utf-8" and
	// differing case are tolerated, matching what most GraphQL clients send.
	if ct := g.Request.Header.Get("Content-Type"); ct != "" {
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			_ = g.Error(errContentTypeNotJSON)
			g.JSON(http.StatusBadRequest, errorResponse(errContentTypeNotJSON.Error()))

			return
		}
	}

	var reqBody GraphQLRequest
	if err := json.UnmarshalRead(g.Request.Body, &reqBody); err != nil {
		if requestBodyExceedsLimit(err) {
			err = fmt.Errorf("%w: limit is %d bytes", errRequestBodyTooLarge, maxBodyBytes)
			_ = g.Error(err)
			g.JSON(http.StatusRequestEntityTooLarge, errorResponse(errRequestBodyTooLarge.Error()))

			return
		}

		err = fmt.Errorf("%w: %w", errInvalidRequestBody, err)
		_ = g.Error(err)
		g.JSON(http.StatusBadRequest, errorResponse(err.Error()))

		return
	}

	// Install a sink so action webhooks can forward Set-Cookie headers to the
	// client (Hasura's mkSetCookieHeaders behaviour).
	cookies := &requestcontext.ResponseHeaderCollector{}
	ctx := requestcontext.ResponseHeaderCollectorToContext(g.Request.Context(), cookies)

	resp, err := c.Resolve(ctx, reqBody)
	if err != nil {
		_ = g.Error(fmt.Errorf("resolving request: %w", err))
		g.JSON(http.StatusInternalServerError, errorResponse(errInternalServerError.Error()))

		return
	}

	// Relay any forwarded Set-Cookie headers before the body is written.
	for _, cookie := range cookies.SetCookies() {
		g.Writer.Header().Add("Set-Cookie", cookie)
	}

	// Fast path: write pre-built response bytes directly, skipping json.Marshal.
	if resp.rawResponse != nil {
		g.Data(http.StatusOK, "application/json; charset=utf-8", resp.rawResponse)

		return
	}

	g.JSON(http.StatusOK, resp)
}

func normalizeMaxGraphQLRequestBodyBytes(maxBodyBytes int64) int64 {
	if maxBodyBytes <= 0 {
		return DefaultMaxGraphQLRequestBodyBytes
	}

	return maxBodyBytes
}

func requestBodyExceedsLimit(err error) bool {
	var maxBytesErr *http.MaxBytesError

	return errors.As(err, &maxBytesErr)
}

// HandlerGet is the Gin handler for GET /graphql. It upgrades the connection
// to a WebSocket when the client requests it (graphql-transport-ws) and
// otherwise replies with Method Not Allowed. Each accepted WebSocket
// connection snapshots the current controller state for its lifetime so a
// concurrent metadata reload cannot disturb in-flight subscriptions.
func (c *Controller) HandlerGet(g *gin.Context) {
	logger := oapimw.LoggerFromContext(g.Request.Context())

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
