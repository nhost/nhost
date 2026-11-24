package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/mark3labs/mcp-go/mcp"
)

// replayWriteTimeout bounds how long a resume replay may block writing to a
// slow client while the stream's lock is held.
const replayWriteTimeout = 30 * time.Second

// resumableStream tracks one SSE stream whose events are recorded in the
// configured EventStore. A stream outlives any single HTTP connection: while
// no connection is attached, deliveries are recorded only, and a later GET
// carrying Last-Event-ID replays the missed events and takes the stream over.
//
// Recording is serialized through mu, and a connection attaching under mu
// first replays from the store and then installs itself, so an event reaches
// the attaching connection either through the replay or live afterwards,
// never both and never neither. Writes to an attached connection happen
// outside mu so that a stalled client can never block stream takeover or
// session cleanup; they cannot reorder because each stream has a single
// producer (the session's listening pump, or the originating POST handler
// under its own mutex).
type resumableStream struct {
	server    *StreamableHTTPServer
	sessionID string
	id        string

	mu sync.Mutex
	// conn is the currently attached connection, nil while detached.
	conn *resumableConn
	// postW is the originating POST response writer for request streams,
	// written to directly (under the POST handler's own serialization) until
	// it fails, the request context ends, or a resumed connection takes over.
	postW HTTPResponseWriter
	// closed is set once the stream's final message (a request stream's
	// response) has been recorded; a stream resumed after that point is
	// replayed and closed.
	closed bool
}

// resumableConn is one attached connection's write side. Events are handed to
// sink and written by the owning handler goroutine; gone is closed (exactly
// once) when the connection detaches, dies, or is superseded.
type resumableConn struct {
	sink      chan resumableEvent
	gone      chan struct{}
	closeGone func()
}

type resumableEvent struct {
	eventID string
	message json.RawMessage
	// last closes the connection after the event is written.
	last bool
}

func newResumableConn() *resumableConn {
	gone := make(chan struct{})
	return &resumableConn{
		sink:      make(chan resumableEvent, 16),
		gone:      gone,
		closeGone: sync.OnceFunc(func() { close(gone) }),
	}
}

func (s *StreamableHTTPServer) newResumableStream(sessionID string, postW HTTPResponseWriter) *resumableStream {
	st := &resumableStream{
		server:    s,
		sessionID: sessionID,
		id:        uuid.NewString(),
		postW:     postW,
	}
	s.resumableStreams.Store(st.id, st)
	return st
}

// deliver records message on the stream and forwards it to whatever is
// currently attached, if anything. Delivery failures detach the writer; the
// message stays recorded and is redelivered on resume.
func (st *resumableStream) deliver(ctx context.Context, message any, last bool) {
	data, err := json.Marshal(message)
	if err != nil {
		st.server.logger.Error("Failed to marshal SSE event for recording", "err", err)
		return
	}

	st.mu.Lock()
	eventID, err := st.server.eventStore.StoreEvent(ctx, st.sessionID, st.id, data)
	if err != nil {
		// Recording failed; deliver live without an ID rather than dropping.
		st.server.logger.Error("Failed to store SSE event", "err", err, "stream", st.id)
		eventID = ""
	}
	if last {
		st.closed = true
	}
	conn, postW := st.conn, st.postW
	st.mu.Unlock()

	switch {
	case conn != nil:
		select {
		case conn.sink <- resumableEvent{eventID: eventID, message: data, last: last}:
		case <-conn.gone:
			// The connection died or was superseded while we were blocked; the
			// event is recorded and reaches the client on resume (or already
			// reached the successor through its replay).
		}
	case postW != nil:
		if err := writeSSEEventRaw(postW, eventID, data); err != nil {
			st.server.logger.Error("Failed to write SSE event", "err", err)
			st.clearPostWriterIf(postW)
			return
		}
		postW.Flush()
	}
}

// deliverTransient writes message to the attached connection without
// recording it. Keepalive pings use this: they check connection liveness
// rather than carry session history, so they get no event ID (the client's
// Last-Event-ID does not advance) and are dropped while nothing is attached.
func (st *resumableStream) deliverTransient(message any) {
	data, err := json.Marshal(message)
	if err != nil {
		st.server.logger.Error("Failed to marshal SSE event", "err", err)
		return
	}
	st.mu.Lock()
	conn := st.conn
	st.mu.Unlock()
	if conn == nil {
		return
	}
	select {
	case conn.sink <- resumableEvent{message: data}:
	case <-conn.gone:
	}
}

// clearPostWriter stops direct writes to the originating POST response, e.g.
// once its request context has ended.
func (st *resumableStream) clearPostWriter() {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.postW = nil
}

// clearPostWriterIf stops direct writes to w if it is still the stream's
// originating POST writer.
func (st *resumableStream) clearPostWriterIf(w HTTPResponseWriter) {
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.postW == w {
		st.postW = nil
	}
}

// detachLocked supersedes whatever is currently attached. Callers must hold mu.
func (st *resumableStream) detachLocked() {
	if st.conn != nil {
		st.conn.closeGone()
		st.conn = nil
	}
	st.postW = nil
}

// detachIf detaches conn if it is still the attached connection.
func (st *resumableStream) detachIf(conn *resumableConn) {
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.conn == conn {
		st.conn = nil
	}
}

// attach installs a fresh connection as the stream's live writer, superseding
// whatever was attached before. Events delivered from this point on queue on
// the connection's sink until serve starts writing them.
func (st *resumableStream) attach() *resumableConn {
	conn := newResumableConn()
	st.mu.Lock()
	st.detachLocked()
	st.conn = conn
	st.mu.Unlock()
	return conn
}

// replayAndAttach replays events after lastEventID to w and attaches the
// connection as the stream's live writer. Replay happens under mu, so no
// event can be recorded while the store is scanned: an event is either part
// of the replay or delivered live afterwards, never both and never neither.
// A write deadline (where the transport supports one) bounds how long a slow
// client can hold the lock during replay. It returns nil if the stream is
// complete (or replay failed) and there is nothing further to serve. SSE
// response headers must already be written.
func (st *resumableStream) replayAndAttach(w HTTPResponseWriter, r *HTTPRequest, lastEventID string) *resumableConn {
	conn := newResumableConn()

	st.mu.Lock()
	st.detachLocked()
	restoreDeadline := setWriteDeadline(w, replayWriteTimeout)
	_, err := st.server.eventStore.ReplayEventsAfter(r.ctx(), st.sessionID, lastEventID, func(eventID string, message json.RawMessage) error {
		if err := writeSSEEventRaw(w, eventID, message); err != nil {
			return err
		}
		w.Flush()
		return nil
	})
	restoreDeadline()
	if err != nil {
		st.mu.Unlock()
		st.server.logger.Error("Failed to replay SSE events", "err", err, "stream", st.id)
		return nil
	}
	if st.closed {
		// The stream's final message was part of the replay; nothing further
		// will be delivered.
		st.mu.Unlock()
		return nil
	}
	st.conn = conn
	st.mu.Unlock()
	return conn
}

// serve writes the attached connection's events to w until the client
// disconnects, the stream completes, or another connection takes over.
func (st *resumableStream) serve(w HTTPResponseWriter, r *HTTPRequest, conn *resumableConn) {
	ctx := r.ctx()
	for {
		select {
		case ev := <-conn.sink:
			if err := writeSSEEventRaw(w, ev.eventID, ev.message); err != nil {
				st.server.logger.Error("Failed to write SSE event", "err", err)
				conn.closeGone()
				st.detachIf(conn)
				return
			}
			w.Flush()
			st.server.touchSession(st.sessionID)
			if ev.last {
				conn.closeGone()
				st.detachIf(conn)
				return
			}
		case <-conn.gone:
			// Superseded by a newer connection for this stream.
			return
		case <-ctx.Done():
			conn.closeGone()
			st.detachIf(conn)
			return
		}
	}
}

// ensureListeningStream returns the session's standalone listening stream,
// creating it, along with the pump that feeds it, on first use.
func (s *StreamableHTTPServer) ensureListeningStream(sessionID string, session *streamableHttpSession) *resumableStream {
	if v, ok := s.listeningStreams.Load(sessionID); ok {
		return v.(*resumableStream)
	}
	st := &resumableStream{
		server:    s,
		sessionID: sessionID,
		id:        uuid.NewString(),
	}
	actual, loaded := s.listeningStreams.LoadOrStore(sessionID, st)
	if loaded {
		return actual.(*resumableStream)
	}
	s.resumableStreams.Store(st.id, st)
	stop := make(chan struct{})
	s.listeningPumpStops.Store(sessionID, stop)
	s.startListeningPump(session, st, stop)
	return st
}

// startListeningPump moves messages bound for the session's listening stream
// into it for recording and delivery. Unlike the connection-scoped forwarding
// used without an event store, the pump is session-scoped: it keeps running
// while no client is connected, so messages produced in the meantime are
// recorded and can be replayed.
func (s *StreamableHTTPServer) startListeningPump(session *streamableHttpSession, st *resumableStream, stop <-chan struct{}) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("panic in listening stream pump", "panic", r)
			}
		}()
		ctx := context.Background()
		for {
			select {
			case nt := <-session.notificationChannel:
				st.deliver(ctx, nt, false)
			case samplingReq := <-session.samplingRequestChan:
				st.deliver(ctx, mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(samplingReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodSamplingCreateMessage),
					},
					Params: samplingReq.request.CreateMessageParams,
				}, false)
			case elicitationReq := <-session.elicitationRequestChan:
				st.deliver(ctx, mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(elicitationReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodElicitationCreate),
					},
					Params: elicitationReq.request.Params,
				}, false)
			case rootsReq := <-session.rootsRequestChan:
				st.deliver(ctx, mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(rootsReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodListRoots),
					},
				}, false)
			case <-stop:
				return
			}
		}
	}()
}

// serveListeningStream handles a GET without Last-Event-ID when an event
// store is configured: it attaches the connection to the session's listening
// stream, superseding any previous one.
func (s *StreamableHTTPServer) serveListeningStream(w HTTPResponseWriter, r *HTTPRequest, sessionID string, session *streamableHttpSession) {
	st := s.ensureListeningStream(sessionID, session)

	// Attach before writing headers: anything delivered from now on queues on
	// the connection and is written once serve starts, so a message can't
	// slip through unseen between the response starting and the attach.
	conn := st.attach()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	w.Flush()

	if s.listenHeartbeatInterval > 0 {
		s.startConnHeartbeat(r.ctx(), st, sessionID)
	}

	st.serve(w, r, conn)
}

// handleResumeGet handles a GET carrying Last-Event-ID: it replays the
// events recorded after that ID on the stream that produced it and, if the
// stream is still live, continues delivering from there.
func (s *StreamableHTTPServer) handleResumeGet(w HTTPResponseWriter, r *HTTPRequest, lastEventID string) {
	sessionID := r.header().Get(HeaderKeySessionID)

	// Probe the store to locate the stream (and reject IDs this session does
	// not own) before writing any response bytes. The events themselves are
	// replayed by a second, authoritative scan once the stream is locked, so
	// stores pay two reads per resume.
	streamID, err := s.eventStore.ReplayEventsAfter(r.ctx(), sessionID, lastEventID, func(string, json.RawMessage) error { return nil })
	if err != nil {
		if errors.Is(err, ErrUnknownEventID) {
			writeHTTPError(w, "Unknown Last-Event-ID", http.StatusBadRequest)
		} else {
			s.logger.Error("Failed to resume stream", "err", err, "session", sessionID)
			writeHTTPError(w, "Failed to resume stream", http.StatusInternalServerError)
		}
		return
	}
	s.touchSession(sessionID)

	var st *resumableStream
	if v, ok := s.resumableStreams.Load(streamID); ok {
		st = v.(*resumableStream)
		if st.sessionID != sessionID {
			st = nil
		}
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	w.Flush()

	if st == nil {
		// The stream is no longer tracked (e.g. its session state was cleaned
		// up); replay what the store has and finish.
		restoreDeadline := setWriteDeadline(w, replayWriteTimeout)
		_, err := s.eventStore.ReplayEventsAfter(r.ctx(), sessionID, lastEventID, func(eventID string, message json.RawMessage) error {
			if err := writeSSEEventRaw(w, eventID, message); err != nil {
				return err
			}
			w.Flush()
			return nil
		})
		restoreDeadline()
		if err != nil {
			s.logger.Error("Failed to replay SSE events", "err", err, "stream", streamID)
		}
		return
	}

	if s.listenHeartbeatInterval > 0 {
		s.startConnHeartbeat(r.ctx(), st, sessionID)
	}

	if conn := st.replayAndAttach(w, r, lastEventID); conn != nil {
		st.serve(w, r, conn)
	}
}

// startConnHeartbeat delivers periodic ping requests to the stream for as
// long as ctx (the attached connection's context) lasts. Pings are transient:
// they are never recorded for replay.
func (s *StreamableHTTPServer) startConnHeartbeat(ctx context.Context, st *resumableStream, sessionID string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("panic in heartbeat goroutine", "panic", r)
			}
		}()
		ticker := time.NewTicker(s.listenHeartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				st.deliverTransient(mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(s.nextRequestID(sessionID)),
					Request: mcp.Request{
						Method: string(mcp.MethodPing),
					},
				})
			case <-ctx.Done():
				return
			}
		}
	}()
}

// cleanupResumableState tears down the session's streams and pump and purges
// the session's events from the store, so none of its event IDs can be
// resumed from. Any connection still attached to one of its streams is closed.
func (s *StreamableHTTPServer) cleanupResumableState(ctx context.Context, sessionID string) {
	if stop, ok := s.listeningPumpStops.LoadAndDelete(sessionID); ok {
		close(stop.(chan struct{}))
	}
	s.listeningStreams.Delete(sessionID)
	s.resumableStreams.Range(func(key, value any) bool {
		st := value.(*resumableStream)
		if st.sessionID == sessionID {
			st.mu.Lock()
			st.detachLocked()
			st.mu.Unlock()
			s.resumableStreams.Delete(key)
		}
		return true
	})
	if err := s.eventStore.PurgeSession(ctx, sessionID); err != nil {
		s.logger.Error("Failed to purge session events", "err", err, "session", sessionID)
	}
}

// setWriteDeadline applies a write deadline to w when the underlying
// transport supports one (net/http does, via http.ResponseController) and
// returns a func that clears it again. Writers without deadline support,
// e.g. adapters for other frameworks, are left untouched.
func setWriteDeadline(w HTTPResponseWriter, d time.Duration) (restore func()) {
	dw, ok := w.(interface{ SetWriteDeadline(time.Time) error })
	if !ok {
		return func() {}
	}
	if err := dw.SetWriteDeadline(time.Now().Add(d)); err != nil {
		return func() {}
	}
	return func() {
		_ = dw.SetWriteDeadline(time.Time{})
	}
}

// writeSSEEventRaw writes an already-marshaled message as an SSE event,
// prefixed with an id field when eventID is non-empty. IDs containing line
// breaks are rejected: interpolating one into the id field would corrupt the
// SSE framing.
func writeSSEEventRaw(w io.Writer, eventID string, data json.RawMessage) error {
	if eventID != "" {
		if strings.ContainsAny(eventID, "\r\n") {
			return fmt.Errorf("invalid SSE event id %q: contains line breaks", eventID)
		}
		if _, err := fmt.Fprintf(w, "id: %s\n", eventID); err != nil {
			return fmt.Errorf("failed to write SSE event id: %w", err)
		}
	}
	if _, err := fmt.Fprintf(w, "event: message\ndata: %s\n\n", data); err != nil {
		return fmt.Errorf("failed to write SSE event: %w", err)
	}
	return nil
}
