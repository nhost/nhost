package subscription

import (
	"context"
	"log/slog"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	sub "github.com/nhost/nhost/services/constellation/subscription"
)

func TestCohortKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		q1, q2    string
		r1, r2    string
		op1, op2  string
		v1, v2    map[string]any
		wantEqual bool
	}{
		{
			name:      "same inputs produce same key",
			q1:        "subscription { users { id name } }",
			q2:        "subscription { users { id name } }",
			r1:        "user",
			r2:        "user",
			op1:       "MyOp",
			op2:       "MyOp",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 10},
			wantEqual: true,
		},
		{
			name:      "different query produces different key",
			q1:        "subscription { users { id } }",
			q2:        "subscription { posts { id } }",
			r1:        "user",
			r2:        "user",
			op1:       "MyOp",
			op2:       "MyOp",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 10},
			wantEqual: false,
		},
		{
			name:      "different role produces different key",
			q1:        "subscription { users { id } }",
			q2:        "subscription { users { id } }",
			r1:        "admin",
			r2:        "user",
			op1:       "MyOp",
			op2:       "MyOp",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 10},
			wantEqual: false,
		},
		{
			name:      "different variables produces different key",
			q1:        "subscription { users { id } }",
			q2:        "subscription { users { id } }",
			r1:        "user",
			r2:        "user",
			op1:       "MyOp",
			op2:       "MyOp",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 20},
			wantEqual: false,
		},
		{
			name:      "different operation name produces different key",
			q1:        "subscription { users { id } }",
			q2:        "subscription { users { id } }",
			r1:        "user",
			r2:        "user",
			op1:       "OpA",
			op2:       "OpB",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 10},
			wantEqual: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			key1 := newCohortKey(tt.q1, tt.r1, tt.op1, tt.v1)
			key2 := newCohortKey(tt.q2, tt.r2, tt.op2, tt.v2)

			if got := (key1 == key2); got != tt.wantEqual {
				t.Errorf("key equality = %v, want %v", got, tt.wantEqual)
			}
		})
	}
}

func TestCohortKey_NilVsEmptyVars(t *testing.T) {
	t.Parallel()

	query := "subscription { users { id } }"
	role := "user"
	opName := "MyOp"

	key1 := newCohortKey(query, role, opName, nil)
	key2 := newCohortKey(query, role, opName, map[string]any{})

	if key1 != key2 {
		t.Errorf("nil and empty vars should produce the same key, got %v and %v", key1, key2)
	}
}

func TestCohortKey_StringStability(t *testing.T) {
	t.Parallel()

	query := "subscription { users { id } }"
	role := "user"
	opName := "MyOp"
	vars := map[string]any{"limit": 10}

	key := newCohortKey(query, role, opName, vars)
	s1 := key.String()
	s2 := key.String()

	if s1 != s2 {
		t.Errorf("String() should be stable, got %q and %q", s1, s2)
	}

	if s1 == "" {
		t.Error("String() should not be empty")
	}
}

func TestCohort_NewCohort(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	op := &ast.OperationDefinition{
		Operation: ast.Subscription,
	}
	c := newCohort(key, op, nil, "op")

	if c == nil {
		t.Fatal("newCohort returned nil")
	}

	if c.key != key {
		t.Errorf("expected key %v, got %v", key, c.key)
	}

	if c.operation != op {
		t.Error("operation not stored correctly")
	}

	if c.operationName != "op" {
		t.Errorf("expected operationName %q, got %q", "op", c.operationName)
	}

	if !c.isEmpty() {
		t.Error("new cohort should be empty")
	}

	if c.size() != 0 {
		t.Errorf("new cohort should have size 0, got %d", c.size())
	}
}

func TestCohort_AddSubscription(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	s := newCohortSubscription("sub-1", map[string]any{"x-hasura-user-id": "1"}, nil)
	c.addSubscription(s)

	if c.isEmpty() {
		t.Error("cohort should not be empty after adding subscription")
	}

	if c.size() != 1 {
		t.Errorf("expected size 1, got %d", c.size())
	}
}

func TestCohort_RemoveSubscription(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	s := newCohortSubscription("sub-1", nil, nil)
	c.addSubscription(s)

	isEmpty := c.removeSubscription("sub-1")

	if !isEmpty {
		t.Error("removeSubscription should return true when cohort becomes empty")
	}

	if !c.isEmpty() {
		t.Error("cohort should be empty after removing last subscription")
	}
}

func TestCohort_RemoveSubscription_NonExistent(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	s := newCohortSubscription("sub-1", nil, nil)
	c.addSubscription(s)

	isEmpty := c.removeSubscription("nonexistent")

	if isEmpty {
		t.Error("removeSubscription of nonexistent ID should not make cohort empty")
	}

	if c.size() != 1 {
		t.Errorf("expected size 1, got %d", c.size())
	}
}

func TestCohort_IsEmpty(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	if !c.isEmpty() {
		t.Error("new cohort should be empty")
	}

	s := newCohortSubscription("sub-1", nil, nil)
	c.addSubscription(s)

	if c.isEmpty() {
		t.Error("cohort with subscription should not be empty")
	}
}

func TestCohort_Size(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	for i := range 5 {
		s := newCohortSubscription("sub-"+string(rune('0'+i)), nil, nil)
		c.addSubscription(s)
	}

	if c.size() != 5 {
		t.Errorf("expected size 5, got %d", c.size())
	}
}

func TestCohort_Stop(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	s := newCohortSubscription("sub-1", nil, nil)
	c.addSubscription(s)

	c.stop()

	// Verify stop channel is closed
	select {
	case <-c.stopChannel():
		// expected
	default:
		t.Error("stop channel should be closed after stop()")
	}
}

func TestCohort_StopIsIdempotent(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	c.stop()
	c.stop() // Should not panic
}

func TestCohort_GetSubscriptionsCopy(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	s1 := newCohortSubscription("sub-1", nil, nil)
	s2 := newCohortSubscription("sub-2", nil, nil)

	c.addSubscription(s1)
	c.addSubscription(s2)

	cpy := c.getSubscriptionsCopy()

	if len(cpy) != 2 {
		t.Errorf("expected copy to have 2 entries, got %d", len(cpy))
	}

	// Mutating the copy should not affect the cohort
	delete(cpy, "sub-1")

	if c.size() != 2 {
		t.Error("deleting from copy should not affect the cohort")
	}
}

func TestCohortSubscription_New(t *testing.T) {
	t.Parallel()

	sessionVars := map[string]any{"x-hasura-user-id": "1"}
	graphqlVars := map[string]any{"limit": 10}
	s := newCohortSubscription("sub-1", sessionVars, graphqlVars)

	if s.id != "sub-1" {
		t.Errorf("expected id %q, got %q", "sub-1", s.id)
	}

	if s.sessionVariables["x-hasura-user-id"] != "1" {
		t.Error("session variables not stored correctly")
	}

	if s.graphQLVariables["limit"] != 10 {
		t.Error("graphQL variables not stored correctly")
	}

	if s.lastHash != "" {
		t.Errorf("expected empty lastHash, got %q", s.lastHash)
	}
}

func TestCohortSubscription_SendUpdate(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)

	update := sub.Update{
		SubscriptionID: "sub-1",
		Data:           []byte(`{"users":[]}`),
		Error:          nil,
	}

	sent := s.sendUpdate(update)
	if !sent {
		t.Error("sendUpdate should return true")
	}

	received := <-s.updateChannel()
	if received.SubscriptionID != "sub-1" {
		t.Errorf("expected subscription ID %q, got %q", "sub-1", received.SubscriptionID)
	}
}

func TestCohortSubscription_SendUpdateReplacesStale(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)

	// Fill the buffered channel (capacity 1)
	staleUpdate := sub.Update{
		SubscriptionID: "sub-1",
		Data:           []byte(`{"stale":true}`),
		Error:          nil,
	}
	s.sendUpdate(staleUpdate)

	// Send a new update that should replace the stale one
	freshUpdate := sub.Update{
		SubscriptionID: "sub-1",
		Data:           []byte(`{"fresh":true}`),
		Error:          nil,
	}
	sent := s.sendUpdate(freshUpdate)

	if !sent {
		t.Error("sendUpdate should replace stale and succeed")
	}

	received := <-s.updateChannel()
	if string(received.Data) != `{"fresh":true}` {
		t.Errorf("expected fresh data, got %s", string(received.Data))
	}
}

func TestCohortSubscription_SendUpdateReturnsFalseAfterStop(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)
	s.stop()

	update := sub.Update{
		SubscriptionID: "sub-1",
		Data:           []byte(`{}`),
		Error:          nil,
	}

	sent := s.sendUpdate(update)
	if sent {
		t.Error("sendUpdate should return false after stop")
	}
}

func TestCohortSubscription_Stop(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)
	s.stop()

	// The update channel should be closed
	select {
	case _, ok := <-s.updateCh:
		if ok {
			t.Error("update channel should be closed after stop")
		}
	default:
		t.Error("reading from closed channel should not block")
	}
}

func TestCohortSubscription_StopIsIdempotent(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)
	s.stop()
	s.stop() // Should not panic
}

func TestCohortSubscription_UpdateChannel(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)
	ch := s.updateChannel()

	if ch == nil {
		t.Error("updateChannel should not return nil")
	}
}

func TestStreamCohortKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		c1, c2    map[string]any
		wantEqual bool
	}{
		{
			name:      "same cursor produces same key",
			c1:        map[string]any{"id": 5},
			c2:        map[string]any{"id": 5},
			wantEqual: true,
		},
		{
			name:      "different cursor produces different key",
			c1:        map[string]any{"id": 5},
			c2:        map[string]any{"id": 10},
			wantEqual: false,
		},
		{
			name:      "nil cursors produce same key",
			c1:        nil,
			c2:        nil,
			wantEqual: true,
		},
	}

	query := "subscription { events_stream { id } }"
	role := "user"
	opName := "StreamOp"
	vars := map[string]any{"batch_size": 10}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			key1 := newStreamCohortKey(query, role, opName, vars, tt.c1)
			key2 := newStreamCohortKey(query, role, opName, vars, tt.c2)

			if got := (key1 == key2); got != tt.wantEqual {
				t.Errorf("key equality = %v, want %v", got, tt.wantEqual)
			}
		})
	}

	t.Run("string stability", func(t *testing.T) {
		t.Parallel()

		key := newStreamCohortKey("q", "role", "op", nil, map[string]any{"id": 1})
		s1 := key.String()
		s2 := key.String()

		if s1 != s2 {
			t.Errorf("String() should be stable, got %q and %q", s1, s2)
		}

		if s1 == "" {
			t.Error("String() should not be empty")
		}
	})
}

func TestComputeDataHash_SameData(t *testing.T) {
	t.Parallel()

	h1 := computeDataHash([]byte(`{"users":[{"id":1}]}`))
	h2 := computeDataHash([]byte(`{"users":[{"id":1}]}`))

	if h1 != h2 {
		t.Errorf("same data should produce same hash, got %q and %q", h1, h2)
	}
}

func TestComputeDataHash_DifferentData(t *testing.T) {
	t.Parallel()

	h1 := computeDataHash([]byte(`{"users":[{"id":1}]}`))
	h2 := computeDataHash([]byte(`{"users":[{"id":2}]}`))

	if h1 == h2 {
		t.Error("different data should produce different hashes")
	}
}

func TestComputeDataHash_Empty(t *testing.T) {
	t.Parallel()

	h := computeDataHash([]byte{})
	if h == "" {
		t.Error("hash of empty data should not be empty string")
	}
}

func TestComputeDataHash_Nil(t *testing.T) {
	t.Parallel()

	h := computeDataHash(nil)
	if h == "" {
		t.Error("hash of nil data should not be empty string")
	}
}

func TestHashVariables(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		v1, v2    map[string]any
		wantEqual bool
	}{
		{
			name:      "deterministic",
			v1:        map[string]any{"limit": 10, "offset": 0},
			v2:        map[string]any{"limit": 10, "offset": 0},
			wantEqual: true,
		},
		{
			name:      "different values produce different hashes",
			v1:        map[string]any{"limit": 10},
			v2:        map[string]any{"limit": 20},
			wantEqual: false,
		},
		{
			name:      "nil and empty produce same hash",
			v1:        nil,
			v2:        map[string]any{},
			wantEqual: true,
		},
		{
			name:      "order independent",
			v1:        map[string]any{"a": 1, "b": 2, "c": 3},
			v2:        map[string]any{"c": 3, "a": 1, "b": 2},
			wantEqual: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h1 := hashVariables(tt.v1)
			h2 := hashVariables(tt.v2)

			if got := (h1 == h2); got != tt.wantEqual {
				t.Errorf("hash equality = %v, want %v (h1=%q, h2=%q)", got, tt.wantEqual, h1, h2)
			}
		})
	}

	t.Run("nil returns empty string", func(t *testing.T) {
		t.Parallel()

		if h := hashVariables(nil); h != "" {
			t.Errorf("nil should return empty string, got %q", h)
		}
	})
}

func TestStreamCohort_NewStreamCohort(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, map[string]any{"id": 1})
	op := &ast.OperationDefinition{
		Operation: ast.Subscription,
	}
	cursor := map[string]any{"id": 1}

	c := newStreamCohort(key, "q", op, nil, "op", cursor)

	if c == nil {
		t.Fatal("newStreamCohort returned nil")
	}

	if c.key != key {
		t.Errorf("expected key %v, got %v", key, c.key)
	}

	if c.queryString != "q" {
		t.Errorf("expected queryString %q, got %q", "q", c.queryString)
	}

	if !c.isEmpty() {
		t.Error("new stream cohort should be empty")
	}

	if c.size() != 0 {
		t.Errorf("new stream cohort should have size 0, got %d", c.size())
	}
}

func TestStreamCohort_AddSubscription_NotPolling(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s := newStreamCohortSubscription("sub-1", nil, nil, map[string]any{"id": 1})
	c.addSubscription(s)

	if c.size() != 1 {
		t.Errorf("expected size 1, got %d", c.size())
	}

	// Should be in main subscriptions, not new
	got := c.getSubscription("sub-1")
	if got == nil {
		t.Error("subscription not found after addSubscription")
	}
}

func TestStreamCohort_AddSubscription_WhilePolling(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	c.startPolling()

	s := newStreamCohortSubscription("sub-1", nil, nil, map[string]any{"id": 1})
	c.addSubscription(s)

	c.endPolling()

	// Should still be findable
	got := c.getSubscription("sub-1")
	if got == nil {
		t.Error("subscription added during polling should be findable")
	}

	// Should be in newSubscriptions
	newSubs := c.getNewSubscriptionsCopy()
	if len(newSubs) != 1 {
		t.Errorf("expected 1 new subscription, got %d", len(newSubs))
	}
}

func TestStreamCohort_RemoveSubscription(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s := newStreamCohortSubscription("sub-1", nil, nil, nil)
	c.addSubscription(s)

	isEmpty := c.removeSubscription("sub-1")

	if !isEmpty {
		t.Error("removeSubscription should return true when cohort is empty")
	}

	if !c.isEmpty() {
		t.Error("cohort should be empty after removing last subscription")
	}
}

func TestStreamCohort_RemoveAll(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s1 := newStreamCohortSubscription("sub-1", nil, nil, nil)
	s2 := newStreamCohortSubscription("sub-2", nil, nil, nil)

	c.addSubscription(s1)
	c.addSubscription(s2)

	c.removeSubscription("sub-1")
	isEmpty := c.removeSubscription("sub-2")

	if !isEmpty {
		t.Error("cohort should be empty after removing all subscriptions")
	}
}

func TestStreamCohort_GetSubscription(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s := newStreamCohortSubscription("sub-1", nil, nil, nil)
	c.addSubscription(s)

	got := c.getSubscription("sub-1")
	if got == nil {
		t.Fatal("getSubscription should return the subscription")
	}

	if got.id != "sub-1" {
		t.Errorf("expected id %q, got %q", "sub-1", got.id)
	}

	// Nonexistent
	got = c.getSubscription("nonexistent")
	if got != nil {
		t.Error("getSubscription should return nil for nonexistent ID")
	}
}

func TestStreamCohort_Stop(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s := newStreamCohortSubscription("sub-1", nil, nil, nil)
	c.addSubscription(s)

	c.stop()

	select {
	case <-c.stopChannel():
		// expected
	default:
		t.Error("stop channel should be closed after stop()")
	}
}

func TestStreamCohort_StopIsIdempotent(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	c.stop()
	c.stop() // Should not panic
}

func TestStreamCohort_UpdateCursor(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, map[string]any{"id": 1})
	c := newStreamCohort(key, "q", nil, nil, "op", map[string]any{"id": 1})

	c.updateCursor(map[string]any{"id": 5})

	cursor := c.getCursorValues()
	if cursor["id"] != 5 {
		t.Errorf("expected cursor id 5, got %v", cursor["id"])
	}
}

func TestStreamCohort_GetCursorValues_Copy(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, map[string]any{"id": 1})
	c := newStreamCohort(key, "q", nil, nil, "op", map[string]any{"id": 1})

	cursor := c.getCursorValues()
	cursor["id"] = 999

	// Original should be unchanged
	original := c.getCursorValues()
	if original["id"] == 999 {
		t.Error("getCursorValues should return a copy, not a reference")
	}
}

func TestStreamCohort_ExtractNewSubscribers(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	c.startPolling()

	s1 := newStreamCohortSubscription("new-1", nil, nil, nil)
	s2 := newStreamCohortSubscription("new-2", nil, nil, nil)

	c.addSubscription(s1)
	c.addSubscription(s2)

	c.endPolling()

	extracted := c.extractNewSubscribers()

	if len(extracted) != 2 {
		t.Errorf("expected 2 extracted new subscribers, got %d", len(extracted))
	}

	// After extraction, new subscribers should be empty
	extracted2 := c.extractNewSubscribers()
	if len(extracted2) != 0 {
		t.Errorf("expected 0 new subscribers after extraction, got %d", len(extracted2))
	}
}

func TestStreamCohort_ClearSubscriptions(t *testing.T) {
	t.Parallel()

	key := newStreamCohortKey("q", "role", "op", nil, nil)
	c := newStreamCohort(key, "q", nil, nil, "op", nil)

	s := newStreamCohortSubscription("sub-1", nil, nil, nil)
	c.addSubscription(s)

	c.startPolling()

	sNew := newStreamCohortSubscription("new-1", nil, nil, nil)
	c.addSubscription(sNew)
	c.endPolling()

	c.clearSubscriptions()

	if !c.isEmpty() {
		t.Error("cohort should be empty after clearSubscriptions")
	}
}

func TestStreamCohortSubscription_New(t *testing.T) {
	t.Parallel()

	cursor := map[string]any{"id": 5}
	s := newStreamCohortSubscription("sub-1", map[string]any{"x-hasura-user-id": "1"}, nil, cursor)

	if s.id != "sub-1" {
		t.Errorf("expected id %q, got %q", "sub-1", s.id)
	}

	if !s.isNew {
		t.Error("new stream subscription should have isNew=true")
	}

	if s.initialCursorValues["id"] != 5 {
		t.Errorf("expected initial cursor id 5, got %v", s.initialCursorValues["id"])
	}
}

func TestStreamCohortSubscription_MarkProcessed(t *testing.T) {
	t.Parallel()

	s := newStreamCohortSubscription("sub-1", nil, nil, nil)

	if !s.isNew {
		t.Error("should be new initially")
	}

	s.markProcessed()

	if s.isNew {
		t.Error("should not be new after markProcessed")
	}
}

func TestStreamCohortSubscription_CursorValuesCopied(t *testing.T) {
	t.Parallel()

	cursor := map[string]any{"id": 5}
	s := newStreamCohortSubscription("sub-1", nil, nil, cursor)

	// Mutate the original
	cursor["id"] = 999

	if s.initialCursorValues["id"] == 999 {
		t.Error("initial cursor values should be a copy, not a reference")
	}
}

func TestCopyCursorValues_Nil(t *testing.T) {
	t.Parallel()

	result := copyCursorValues(nil)
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestCopyCursorValues_Empty(t *testing.T) {
	t.Parallel()

	result := copyCursorValues(map[string]any{})

	if result == nil {
		t.Error("expected non-nil for empty input")
	}

	if len(result) != 0 {
		t.Errorf("expected empty map, got %v", result)
	}
}

func TestCopyCursorValues_Copy(t *testing.T) {
	t.Parallel()

	src := map[string]any{"id": 5, "ts": "2024-01-01"}
	dst := copyCursorValues(src)

	if dst["id"] != 5 {
		t.Errorf("expected id 5, got %v", dst["id"])
	}

	// Mutating source should not affect copy
	src["id"] = 999

	if dst["id"] == 999 {
		t.Error("copy should be independent of source")
	}
}

func TestHashCursorValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		v1, v2    map[string]any
		wantEqual bool
	}{
		{
			name:      "same values produce same hash",
			v1:        map[string]any{"id": 5},
			v2:        map[string]any{"id": 5},
			wantEqual: true,
		},
		{
			name:      "different values produce different hashes",
			v1:        map[string]any{"id": 5},
			v2:        map[string]any{"id": 10},
			wantEqual: false,
		},
		{
			name:      "nil and empty produce same hash",
			v1:        nil,
			v2:        map[string]any{},
			wantEqual: true,
		},
		{
			name:      "order independent",
			v1:        map[string]any{"a": 1, "b": 2, "c": 3},
			v2:        map[string]any{"c": 3, "a": 1, "b": 2},
			wantEqual: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h1 := hashCursorValues(tt.v1)
			h2 := hashCursorValues(tt.v2)

			if got := (h1 == h2); got != tt.wantEqual {
				t.Errorf("hash equality = %v, want %v (h1=%q, h2=%q)", got, tt.wantEqual, h1, h2)
			}
		})
	}

	t.Run("nil returns empty string", func(t *testing.T) {
		t.Parallel()

		if h := hashCursorValues(nil); h != "" {
			t.Errorf("nil should return empty string, got %q", h)
		}
	})
}

func TestParseStreamResults(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		data      string
		wantEmpty bool
		wantLen   int
		wantErr   bool
	}{
		{"wrapped empty array", `{"users":[]}`, true, 0, false},
		{"non-empty array", `{"users":[{"id":1}]}`, false, 1, false},
		{"two rows", `{"events":[{"id":1},{"id":2}]}`, false, 2, false},
		{"invalid JSON", `not json`, true, 0, true},
		{"empty object", `{}`, true, 0, false},
		{"empty bytes", ``, true, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			parsed := parseStreamResults(
				[]MultiplexedResult{{SubscriptionID: "s1", Data: []byte(tt.data)}},
			)

			if len(parsed) != 1 {
				t.Fatalf("expected one parsed result, got %d", len(parsed))
			}

			if got := len(parsed[0].rows) == 0; got != tt.wantEmpty {
				t.Errorf("emptiness = %v, want %v (rows=%v)", got, tt.wantEmpty, parsed[0].rows)
			}

			if len(parsed[0].rows) != tt.wantLen {
				t.Errorf("rows length = %d, want %d", len(parsed[0].rows), tt.wantLen)
			}

			if (parsed[0].parseErr != nil) != tt.wantErr {
				t.Errorf("parseErr = %v, want non-nil = %v", parsed[0].parseErr, tt.wantErr)
			}
		})
	}
}

func TestPickCursorFromResults(t *testing.T) {
	t.Parallel()

	makeResult := func(data string) parsedStreamResult {
		parsed := parseStreamResults(
			[]MultiplexedResult{{SubscriptionID: "s", Data: []byte(data)}},
		)

		return parsed[0]
	}

	tests := []struct {
		name      string
		results   []parsedStreamResult
		cols      []string
		current   map[string]any
		wantNil   bool
		wantPicks map[string]any
	}{
		{
			name:    "no cursor columns short-circuits",
			results: []parsedStreamResult{makeResult(`{"events":[{"id":5}]}`)},
			cols:    nil,
			current: map[string]any{"id": 0},
			wantNil: true,
		},
		{
			name:    "all results empty returns nil",
			results: []parsedStreamResult{makeResult(`{"events":[]}`), makeResult(`{"events":[]}`)},
			cols:    []string{"id"},
			current: map[string]any{"id": 0},
			wantNil: true,
		},
		{
			name: "picks last row of first non-empty result",
			results: []parsedStreamResult{
				makeResult(`{"events":[]}`),
				makeResult(`{"events":[{"id":1},{"id":7}]}`),
			},
			cols:      []string{"id"},
			current:   map[string]any{"id": 0},
			wantPicks: map[string]any{"id": float64(7)},
		},
		{
			name:      "falls back to current cursor when row missing column",
			results:   []parsedStreamResult{makeResult(`{"events":[{"title":"hi"}]}`)},
			cols:      []string{"id"},
			current:   map[string]any{"id": "previous"},
			wantPicks: map[string]any{"id": "previous"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := pickCursorFromResults(tt.results, tt.cols, tt.current)
			if tt.wantNil {
				if got != nil {
					t.Errorf("expected nil, got %v", got)
				}

				return
			}

			if diff := cmp.Diff(tt.wantPicks, got); diff != "" {
				t.Errorf("cursor mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCohort_ConcurrentAddRemove(t *testing.T) {
	t.Parallel()

	key := newCohortKey("q", "role", "op", nil)
	c := newCohort(key, nil, nil, "op")

	const goroutines = 50

	var wg sync.WaitGroup

	wg.Add(goroutines)

	for i := range goroutines {
		go func(idx int) {
			defer wg.Done()

			id := "sub-" + string(rune('A'+idx))
			s := newCohortSubscription(id, nil, nil)
			c.addSubscription(s)
			c.removeSubscription(id)
		}(i)
	}

	wg.Wait()
}

func TestCohortSubscription_ConcurrentSendUpdate(t *testing.T) {
	t.Parallel()

	s := newCohortSubscription("sub-1", nil, nil)

	const goroutines = 50

	var wg sync.WaitGroup

	wg.Add(goroutines)

	for i := range goroutines {
		go func(idx int) {
			defer wg.Done()

			s.sendUpdate(sub.Update{
				SubscriptionID: "sub-1",
				Data:           []byte(`{"i":` + string(rune('0'+idx)) + `}`),
				Error:          nil,
			})
		}(i)
	}

	wg.Wait()

	s.stop()
}

func TestMaxCohortSize(t *testing.T) {
	t.Parallel()

	if maxCohortSize != 100 {
		t.Errorf("expected maxCohortSize to be 100, got %d", maxCohortSize)
	}
}

// streamRebuildHarness builds a streamCohortManager populated with arbitrary
// cohorts/subscriptions for white-box tests of rebuildCohortMap and
// processNewSubscribers. executor/roots are nil because the exercised code
// paths never call them.
func streamRebuildHarness() *streamCohortManager {
	return newStreamCohortManager(nil, nil, 0, slog.Default())
}

func newStreamCohortForTest(
	cursor map[string]any,
) (streamCohortKey, *streamCohort) {
	key := newStreamCohortKey("q", "user", "op", nil, cursor)

	c := newStreamCohort(key, "q", nil, nil, "op", cursor)
	c.cursorColumns = []string{"id"}

	return key, c
}

func TestStreamCohortManager_RebuildCohortMap_KeyRenameOnly(t *testing.T) {
	t.Parallel()

	m := streamRebuildHarness()

	oldKey, c := newStreamCohortForTest(map[string]any{"id": 5})
	oldKeyStr := oldKey.String()
	m.cohorts[oldKeyStr] = c

	s := newStreamCohortSubscription("sub-1", nil, nil, map[string]any{"id": 5})
	c.subscriptions[s.id] = s
	m.subscriptionIndex[s.id] = oldKeyStr

	newCursor := map[string]any{"id": 10}
	m.rebuildCohortMap(context.Background(), c, newCursor, slog.Default())

	if _, exists := m.cohorts[oldKeyStr]; exists {
		t.Error("old cohort key should be removed after cursor advances")
	}

	newKey := streamCohortKey{
		queryHash:     oldKey.queryHash,
		role:          oldKey.role,
		operationName: oldKey.operationName,
		variablesHash: oldKey.variablesHash,
		cursorHash:    hashCursorValues(newCursor),
	}

	if _, exists := m.cohorts[newKey.String()]; !exists {
		t.Fatal("cohort should be re-keyed under the new cursor")
	}

	if got := m.subscriptionIndex[s.id]; got != newKey.String() {
		t.Errorf("subscription index not updated: got %q, want %q", got, newKey.String())
	}

	if c.getCursorValues()["id"] != 10 {
		t.Errorf("cohort cursor not advanced, got %v", c.getCursorValues())
	}
}

func TestStreamCohortManager_RebuildCohortMap_Merge(t *testing.T) {
	t.Parallel()

	m := streamRebuildHarness()

	// Source cohort at cursor 5 — will advance to cursor 100.
	srcKey, src := newStreamCohortForTest(map[string]any{"id": 5})
	m.cohorts[srcKey.String()] = src

	srcSub := newStreamCohortSubscription("sub-src", nil, nil, map[string]any{"id": 5})
	src.subscriptions[srcSub.id] = srcSub
	m.subscriptionIndex[srcSub.id] = srcKey.String()

	// Target cohort already at cursor 100 — src should merge into it.
	dstKey, dst := newStreamCohortForTest(map[string]any{"id": 100})
	m.cohorts[dstKey.String()] = dst

	dstSub := newStreamCohortSubscription("sub-dst", nil, nil, map[string]any{"id": 100})
	dst.subscriptions[dstSub.id] = dstSub
	m.subscriptionIndex[dstSub.id] = dstKey.String()

	m.rebuildCohortMap(context.Background(), src, map[string]any{"id": 100}, slog.Default())

	if _, exists := m.cohorts[srcKey.String()]; exists {
		t.Error("source cohort key should be removed after merge")
	}

	merged, exists := m.cohorts[dstKey.String()]
	if !exists {
		t.Fatal("destination cohort should still exist after merge")
	}

	if merged != dst {
		t.Error("destination cohort identity changed unexpectedly")
	}

	if merged.size() != 2 {
		t.Errorf("merged cohort should hold 2 subscribers, got %d", merged.size())
	}

	if got := m.subscriptionIndex["sub-src"]; got != dstKey.String() {
		t.Errorf("source subscription not re-indexed to merged cohort: got %q", got)
	}

	if got := m.subscriptionIndex["sub-dst"]; got != dstKey.String() {
		t.Errorf("destination subscription index changed unexpectedly: got %q", got)
	}

	// The source cohort should have been stopped but not have leaked its
	// subscriber's channels — merged subscribers must keep their original
	// channels alive (clearSubscriptions is the relevant safeguard).
	select {
	case _, ok := <-srcSub.updateCh:
		if !ok {
			t.Error("merged subscriber channel was closed; should remain open")
		}
	default:
	}
}

func TestStreamCohortManager_ProcessNewSubscribers_JoinsExistingCohort(t *testing.T) {
	t.Parallel()

	m := streamRebuildHarness()

	// Source cohort: had a poll in progress; a new subscriber arrived during it
	// with the same cursor as another existing cohort (the target).
	srcKey, src := newStreamCohortForTest(map[string]any{"id": 5})
	m.cohorts[srcKey.String()] = src

	dstKey, dst := newStreamCohortForTest(map[string]any{"id": 7})
	m.cohorts[dstKey.String()] = dst

	src.startPolling()

	newSub := newStreamCohortSubscription("sub-new", nil, nil, map[string]any{"id": 7})
	src.addSubscription(newSub)

	src.endPolling()

	m.processNewSubscribers(context.Background(), src, slog.Default())

	if dst.getSubscription("sub-new") == nil {
		t.Fatal("new subscriber should have been moved into the existing matching cohort")
	}

	if src.getSubscription("sub-new") != nil {
		t.Error("new subscriber should no longer be in the source cohort's newSubscriptions")
	}

	if got := m.subscriptionIndex["sub-new"]; got != dstKey.String() {
		t.Errorf("new subscriber index not pointing at target cohort: got %q, want %q",
			got, dstKey.String())
	}

	if newSub.isNew {
		t.Error("new subscriber should be marked processed after being placed in a cohort")
	}
}
