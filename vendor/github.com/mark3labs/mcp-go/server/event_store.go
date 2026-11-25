package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"sync"
)

// ErrUnknownEventID indicates that a lastEventID passed to
// EventStore.ReplayEventsAfter is not known for the given session.
var ErrUnknownEventID = errors.New("unknown event ID")

// EventStore records the JSON-RPC messages delivered on a session's SSE
// streams so that a client can resume a broken stream and be redelivered the
// messages it missed, per the "Resumability and Redelivery" section of the
// MCP Streamable HTTP transport specification.
//
// The transport treats event IDs as opaque strings: any non-empty value that
// contains no carriage returns or newlines is acceptable, as long as IDs are
// unique within a session across all of its streams. Implementations must be
// safe for concurrent use.
type EventStore interface {
	// StoreEvent records message as the next event on the given stream and
	// returns the event ID assigned to it. The returned ID is attached to the
	// SSE event delivered to the client.
	StoreEvent(ctx context.Context, sessionID, streamID string, message json.RawMessage) (string, error)

	// ReplayEventsAfter invokes send, in insertion order, for every event
	// stored after lastEventID on the same stream as lastEventID, and returns
	// the ID of that stream. It returns an error wrapping ErrUnknownEventID if
	// lastEventID is not known for the given session, or the error returned by
	// send if send fails.
	ReplayEventsAfter(ctx context.Context, sessionID, lastEventID string, send func(eventID string, message json.RawMessage) error) (string, error)

	// PurgeSession removes every event recorded for the given session. It is
	// called when the session terminates (an explicit DELETE or an idle
	// sweep), after which none of the session's event IDs can be resumed from.
	PurgeSession(ctx context.Context, sessionID string) error
}

// InMemoryEventStore is an EventStore that keeps events in process memory.
// It is suitable for single-process deployments; multi-node deployments
// should implement EventStore on top of shared storage instead.
//
// A session's events are retained until PurgeSession is called for it, which
// the streamable HTTP server does when the session terminates.
type InMemoryEventStore struct {
	mu       sync.RWMutex
	seq      int64
	sessions map[string]*sessionEventLog
}

// sessionEventLog holds the events recorded for one session, grouped by
// stream, plus an index from event ID to its position for replay lookups.
type sessionEventLog struct {
	streams map[string][]storedEvent
	index   map[string]storedEventRef
}

type storedEvent struct {
	id      string
	message json.RawMessage
}

type storedEventRef struct {
	streamID string
	pos      int
}

// NewInMemoryEventStore creates an empty in-memory event store.
func NewInMemoryEventStore() *InMemoryEventStore {
	return &InMemoryEventStore{sessions: make(map[string]*sessionEventLog)}
}

// StoreEvent records message as the next event on the given stream and
// returns the store-wide sequence number assigned to it as the event ID.
func (s *InMemoryEventStore) StoreEvent(_ context.Context, sessionID, streamID string, message json.RawMessage) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	log := s.sessions[sessionID]
	if log == nil {
		log = &sessionEventLog{
			streams: make(map[string][]storedEvent),
			index:   make(map[string]storedEventRef),
		}
		s.sessions[sessionID] = log
	}

	// IDs only need to be unique within a session, but a store-wide sequence
	// costs nothing extra and keeps IDs from one session meaningless in
	// another.
	s.seq++
	id := strconv.FormatInt(s.seq, 10)

	// Copy the message: callers may reuse the backing buffer after we return.
	msg := make(json.RawMessage, len(message))
	copy(msg, message)

	log.index[id] = storedEventRef{streamID: streamID, pos: len(log.streams[streamID])}
	log.streams[streamID] = append(log.streams[streamID], storedEvent{id: id, message: msg})
	return id, nil
}

// ReplayEventsAfter invokes send for every event stored after lastEventID on
// the stream that produced it, in insertion order, and returns that stream's
// ID. It returns an error wrapping ErrUnknownEventID if lastEventID was never
// issued for the given session or the session's events have been purged.
//
// send receives its own copy of each message, so it may modify or keep the
// slice without affecting later replays.
func (s *InMemoryEventStore) ReplayEventsAfter(_ context.Context, sessionID, lastEventID string, send func(eventID string, message json.RawMessage) error) (string, error) {
	s.mu.RLock()
	log := s.sessions[sessionID]
	if log == nil {
		s.mu.RUnlock()
		return "", fmt.Errorf("%w: %s", ErrUnknownEventID, lastEventID)
	}
	ref, ok := log.index[lastEventID]
	if !ok {
		s.mu.RUnlock()
		return "", fmt.Errorf("%w: %s", ErrUnknownEventID, lastEventID)
	}
	events := log.streams[ref.streamID][ref.pos+1:]
	tail := make([]storedEvent, len(events))
	copy(tail, events)
	s.mu.RUnlock()

	for _, ev := range tail {
		if err := send(ev.id, slices.Clone(ev.message)); err != nil {
			return "", err
		}
	}
	return ref.streamID, nil
}

// PurgeSession removes every event recorded for the given session.
func (s *InMemoryEventStore) PurgeSession(_ context.Context, sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
	return nil
}
