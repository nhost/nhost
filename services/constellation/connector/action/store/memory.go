package store

import (
	"context"
	json "encoding/json/v2"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/constellation/connector/action"
)

// MemoryStore is an in-memory ActionLogStore implementation for tests and
// embedded deployments that deliberately do not need durable async logs.
type MemoryStore struct {
	mu      sync.Mutex
	entries map[uuid.UUID]action.ActionLogEntry
	now     func() time.Time
}

// NewMemory creates an empty in-memory action log store.
func NewMemory() *MemoryStore {
	return &MemoryStore{
		mu:      sync.Mutex{},
		entries: make(map[uuid.UUID]action.ActionLogEntry),
		now:     time.Now,
	}
}

// Insert appends a created action-log entry.
func (s *MemoryStore) Insert(
	_ context.Context,
	entry action.ActionLogInsert,
) (action.ActionLogEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	stored := action.ActionLogEntry{
		ID:                 uuid.New(),
		ActionName:         entry.ActionName,
		InputPayload:       cloneAnyMap(entry.InputPayload),
		RequestHeaders:     cloneHeader(entry.RequestHeaders),
		SessionVariables:   cloneAnyMap(entry.SessionVariables),
		ResponsePayload:    nil,
		Errors:             nil,
		CreatedAt:          s.now().UTC(),
		ResponseReceivedAt: nil,
		Status:             action.LogStatusCreated,
	}

	s.entries[stored.ID] = cloneEntry(stored)

	return cloneEntry(stored), nil
}

// ClaimPending atomically marks created entries as processing and returns them.
func (s *MemoryStore) ClaimPending(
	_ context.Context,
	limit int,
) ([]action.ActionLogEntry, error) {
	if limit <= 0 {
		return nil, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	ids := make([]uuid.UUID, 0, len(s.entries))
	for id, entry := range s.entries {
		if entry.Status == action.LogStatusCreated {
			ids = append(ids, id)
		}
	}

	sort.Slice(ids, func(i, j int) bool {
		return s.entries[ids[i]].CreatedAt.Before(s.entries[ids[j]].CreatedAt)
	})

	if len(ids) > limit {
		ids = ids[:limit]
	}

	claimed := make([]action.ActionLogEntry, 0, len(ids))
	for _, id := range ids {
		entry := s.entries[id]
		entry.Status = action.LogStatusProcessing
		s.entries[id] = entry
		claimed = append(claimed, cloneEntry(entry))
	}

	return claimed, nil
}

// Complete stores a successful webhook payload for a processing entry.
func (s *MemoryStore) Complete(
	_ context.Context,
	id uuid.UUID,
	responsePayload []byte,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, ok := s.entries[id]
	if !ok || entry.Status != action.LogStatusProcessing {
		return action.ErrActionLogStaleClaim
	}

	entry.Status = action.LogStatusCompleted

	// Normalize so the in-memory store agrees with the Postgres store on what
	// an empty/non-JSON body becomes (see normalizeResponsePayload).
	entry.ResponsePayload = append([]byte(nil), normalizeResponsePayload(responsePayload)...)
	entry.Errors = nil
	now := s.now().UTC()
	entry.ResponseReceivedAt = &now
	s.entries[id] = entry

	return nil
}

// Fail stores a GraphQL errors JSON payload for a processing entry.
func (s *MemoryStore) Fail(
	_ context.Context,
	id uuid.UUID,
	errorsPayload []byte,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, ok := s.entries[id]
	if !ok || entry.Status != action.LogStatusProcessing {
		return action.ErrActionLogStaleClaim
	}

	entry.Status = action.LogStatusError
	entry.ResponsePayload = nil

	entry.Errors = append([]byte(nil), errorsPayload...)
	now := s.now().UTC()
	entry.ResponseReceivedAt = &now
	s.entries[id] = entry

	return nil
}

// Get returns one action-log entry by UUID.
func (s *MemoryStore) Get(
	_ context.Context,
	id uuid.UUID,
) (action.ActionLogEntry, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, ok := s.entries[id]
	if !ok {
		return emptyActionLogEntry(), false, nil
	}

	return cloneEntry(entry), true, nil
}

// RequeueProcessing moves processing entries back to created.
func (s *MemoryStore) RequeueProcessing(_ context.Context, ids []uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, id := range ids {
		entry, ok := s.entries[id]
		if !ok || entry.Status != action.LogStatusProcessing {
			continue
		}

		entry.Status = action.LogStatusCreated
		s.entries[id] = entry
	}

	return nil
}

// Close releases resources held by the memory store.
func (s *MemoryStore) Close() {}

func emptyActionLogEntry() action.ActionLogEntry {
	return action.ActionLogEntry{
		ID:                 uuid.Nil,
		ActionName:         "",
		InputPayload:       nil,
		RequestHeaders:     nil,
		SessionVariables:   nil,
		ResponsePayload:    nil,
		Errors:             nil,
		CreatedAt:          time.Time{},
		ResponseReceivedAt: nil,
		Status:             "",
	}
}

func cloneEntry(entry action.ActionLogEntry) action.ActionLogEntry {
	clone := action.ActionLogEntry{
		ID:                 entry.ID,
		ActionName:         entry.ActionName,
		InputPayload:       cloneAnyMap(entry.InputPayload),
		RequestHeaders:     cloneHeader(entry.RequestHeaders),
		SessionVariables:   cloneAnyMap(entry.SessionVariables),
		ResponsePayload:    append([]byte(nil), entry.ResponsePayload...),
		Errors:             append([]byte(nil), entry.Errors...),
		CreatedAt:          entry.CreatedAt,
		ResponseReceivedAt: nil,
		Status:             entry.Status,
	}

	if entry.ResponseReceivedAt != nil {
		at := *entry.ResponseReceivedAt
		clone.ResponseReceivedAt = &at
	}

	return clone
}

func cloneAnyMap(in map[string]any) map[string]any {
	if in == nil {
		return nil
	}

	out := make(map[string]any, len(in))
	for key, value := range in {
		out[key] = cloneJSONValue(value)
	}

	return out
}

func cloneHeader(headers http.Header) http.Header {
	if headers == nil {
		return nil
	}

	return headers.Clone()
}

func cloneJSONValue(value any) any {
	data, err := json.Marshal(value)
	if err != nil {
		return value
	}

	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		return value
	}

	return out
}
