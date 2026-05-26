package integration_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

func TestSubscriptionStream(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	initPayload, _ := json.Marshal(map[string]any{
		"headers": map[string]string{
			"x-hasura-admin-secret": adminSecret,
		},
	})

	subPayload, _ := json.Marshal(map[string]string{
		"query": `subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2025-11-01T10:00:00+00:00" }, ordering: ASC }
			batch_size: 2
		  ) {
			id
			created_at
		  }
		}`,
	})

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initPayload,
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"b2c3d4e5-f6a7-8901-bcde-f23456789012","created_at":"2025-11-05T14:30:00+00:00"},{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234","created_at":"2025-11-08T09:15:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"},{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Do(
		sendMutation(`mutation {
			insert_news(objects: [
				{
					id: "f0000000-0000-0000-0000-000000000001"
					created_at: "2025-12-01T10:00:00+00:00"
					title: "December Update"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				},
				{
					id: "f0000000-0000-0000-0000-000000000002"
					created_at: "2026-01-10T10:00:00+00:00"
					title: "January News 1"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				},
				{
					id: "f0000000-0000-0000-0000-000000000003"
					created_at: "2026-01-15T10:00:00+00:00"
					title: "January News 2"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				},
				{
					id: "f0000000-0000-0000-0000-000000000004"
					created_at: "2026-01-20T10:00:00+00:00"
					title: "January News 3"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				}
			]) {
				affected_rows
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"f0000000-0000-0000-0000-000000000001","created_at":"2025-12-01T10:00:00+00:00"},{"id":"f0000000-0000-0000-0000-000000000002","created_at":"2026-01-10T10:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"f0000000-0000-0000-0000-000000000003","created_at":"2026-01-15T10:00:00+00:00"},{"id":"f0000000-0000-0000-0000-000000000004","created_at":"2026-01-20T10:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}

func TestSubscriptionStreamBatchSizeOne(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2025-11-08T09:15:00+00:00" }, ordering: ASC }
			batch_size: 1
		  ) {
			id
			created_at
		  }
		}`),
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message (batch 1): %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message (batch 2): %s", diff)
		}
	}).Close()
}

// TestSubscriptionStreamPublicRole verifies that stream subscriptions respect
// role-based row filtering. The public role should only see is_public=true entries.
func TestSubscriptionStreamPublicRole(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	// Cursor before all data, batch_size=2. Public role should skip
	// "Career Ladder Program Expansion" (is_public=false, 2025-11-12).
	// Public entries by created_at ASC:
	//   1. Q3 Financial Results        2025-11-01
	//   2. New Partnership              2025-11-05
	//   3. Employee Recognition         2025-11-08
	//   4. Sustainability Initiative    2025-11-09
	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithRole("public", nil),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2025-10-01T00:00:00+00:00" }, ordering: ASC }
			batch_size: 2
		  ) {
			title
			created_at
		  }
		}`),
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"title":"Company Announces Q3 Financial Results","created_at":"2025-11-01T10:00:00+00:00"},{"title":"New Partnership with Industry Leader Announced","created_at":"2025-11-05T14:30:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("batch 1: %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"title":"Employee Recognition Program Launch","created_at":"2025-11-08T09:15:00+00:00"},{"title":"Sustainability Initiative Milestone Reached","created_at":"2025-11-09T16:45:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("batch 2: %s", diff)
		}
	}).Close()
}

// TestSubscriptionStreamNoInitialData verifies that when the cursor is set
// beyond all existing data the first message is an empty batch, and new data
// inserted after the cursor is streamed correctly.
func TestSubscriptionStreamNoInitialData(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{ //nolint:dupl
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2030-01-01T00:00:00+00:00" }, ordering: ASC }
			batch_size: 2
		  ) {
			id
			created_at
		  }
		}`),
	}).Expect(func(msg subtest.Message) {
		// The server sends an empty batch when no data exists at the cursor.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: jsontext.Value(`{"data":{"news_stream":[]}}`),
		}); diff != "" {
			t.Fatalf("expected empty initial batch: %s", diff)
		}
	}).Do(
		// Insert 2 entries after the cursor date.
		sendMutation(`mutation {
			insert_news(objects: [
				{
					id: "f0000000-0000-0000-0000-000000000010"
					created_at: "2030-02-01T10:00:00+00:00"
					title: "Future News 1"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				},
				{
					id: "f0000000-0000-0000-0000-000000000011"
					created_at: "2030-03-01T10:00:00+00:00"
					title: "Future News 2"
					content: "Test content"
					is_public: true
					author_id: "550e8400-e29b-41d4-a716-446655440001"
					department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
				}
			]) {
				affected_rows
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"f0000000-0000-0000-0000-000000000010","created_at":"2030-02-01T10:00:00+00:00"},{"id":"f0000000-0000-0000-0000-000000000011","created_at":"2030-03-01T10:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("expected streamed batch with new entries: %s", diff)
		}
	}).Close()
}

// TestSubscriptionStreamSameCursor verifies that two connections with an
// identical stream query and cursor share the same stream cohort and both
// receive the same batches.
//
// Both clients subscribe before consuming data so they are registered in
// the same poll cycle.
func TestSubscriptionStreamSameCursor(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	c2, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
	  news_stream(
		cursor: { initial_value: { created_at: "2025-11-01T00:00:00+00:00" }, ordering: ASC }
		batch_size: 2
	  ) {
		id
		created_at
	  }
	}`)

	// Seed data after 2025-11-01 by created_at ASC:
	//   T1: 2025-11-01T10:00:00 (Q3 Financial)        — a1b2c3d4...
	//   T2: 2025-11-05T14:30:00 (New Partnership)      — b2c3d4e5...
	//   T3: 2025-11-08T09:15:00 (Employee Recognition) — c3d4e5f6...
	//   T4: 2025-11-09T16:45:00 (Sustainability)       — d4e5f6a7...
	//   T5: 2025-11-12T11:00:00 (Career Ladder)        — e5f6a7b8...

	batch1 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","created_at":"2025-11-01T10:00:00+00:00"},{"id":"b2c3d4e5-f6a7-8901-bcde-f23456789012","created_at":"2025-11-05T14:30:00+00:00"}]}}`,
	)

	batch2 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234","created_at":"2025-11-08T09:15:00+00:00"},{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"}]}}`,
	)

	batch3 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
	)

	// Subscribe both before consuming data.
	c1.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c1: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	})

	// NOTE: c2 uses a different subscription ID ("2") because the server
	// does not scope IDs per-connection — two connections in the same cohort
	// sharing ID "1" would overwrite each other in the subscription map.
	c2.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c2: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "2",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	})

	// Both should receive the same batches.
	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch1,
		}); diff != "" {
			t.Fatalf("c1 batch 1: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch1,
		}); diff != "" {
			t.Fatalf("c2 batch 1: %s", diff)
		}
	})

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch2,
		}); diff != "" {
			t.Fatalf("c1 batch 2: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch2,
		}); diff != "" {
			t.Fatalf("c2 batch 2: %s", diff)
		}
	})

	// Consume the final batch [T5] from both to leave channels clean.
	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch3,
		}); diff != "" {
			t.Fatalf("c1 batch 3: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch3,
		}); diff != "" {
			t.Fatalf("c2 batch 3: %s", diff)
		}
	})

	c1.Close()
	c2.Close()
}

// TestSubscriptionStreamCohortMerging verifies that two stream subscribers
// starting at different cursors merge into the same cohort once their cursors
// align, and both receive new data from a single poll after merging.
func TestSubscriptionStreamCohortMerging(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	// c1 starts at cursor T0 (before all data), batch_size=2.
	// Seed data ASC: T1(11-01), T2(11-05), T3(11-08), T4(11-09), T5(11-12)
	// Batches: [T1,T2], [T3,T4], [T5] → cursor advances to T5.
	c1.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c1: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2025-10-01T00:00:00+00:00" }, ordering: ASC }
			batch_size: 2
		  ) {
			id
			created_at
		  }
		}`),
	}).Expect(func(msg subtest.Message) {
		// Batch [T1, T2]
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","created_at":"2025-11-01T10:00:00+00:00"},{"id":"b2c3d4e5-f6a7-8901-bcde-f23456789012","created_at":"2025-11-05T14:30:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c1 batch [T1,T2]: %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		// Batch [T3, T4]
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234","created_at":"2025-11-08T09:15:00+00:00"},{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c1 batch [T3,T4]: %s", diff)
		}
	}).Expect(func(msg subtest.Message) {
		// Batch [T5]
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c1 batch [T5]: %s", diff)
		}
	})

	// c2 starts at cursor T4 (2025-11-09T16:45:00) — different initial cursor.
	// Should receive [T5] → cursor advances to T5 (same as c1 → cohorts merge).
	c2, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	c2.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c2: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "2",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
		  news_stream(
			cursor: { initial_value: { created_at: "2025-11-09T16:45:00+00:00" }, ordering: ASC }
			batch_size: 2
		  ) {
			id
			created_at
		  }
		}`),
	}).Expect(func(msg subtest.Message) {
		// c2 receives [T5]
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "2",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news_stream":[{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c2 batch [T5]: %s", diff)
		}
	})

	// Insert new data at T6 — both c1 and c2 should receive it.
	c1.Do(sendMutation(`mutation {
		insert_news_one(object: {
			id: "f0000000-0000-0000-0000-000000000020"
			created_at: "2025-12-01T10:00:00+00:00"
			title: "COHORT_MERGE_TEST"
			content: "Test content"
			is_public: true
			author_id: "550e8400-e29b-41d4-a716-446655440001"
			department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
		}) {
			id
		}
	}`))

	wantT6 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"f0000000-0000-0000-0000-000000000020","created_at":"2025-12-01T10:00:00+00:00"}]}}`,
	)

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantT6,
		}); diff != "" {
			t.Fatalf("c1 batch [T6]: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "2",
			Type:    subtest.Next,
			Payload: wantT6,
		}); diff != "" {
			t.Fatalf("c2 batch [T6]: %s", diff)
		}
	})

	c1.Close()
	c2.Close()
}

// TestSubscriptionStreamLateJoiner verifies that two stream subscribers
// both receive all historical batches and continue receiving new data
// when it is inserted.
func TestSubscriptionStreamLateJoiner(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	c2, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
	  news_stream(
		cursor: { initial_value: { created_at: "2025-11-01T00:00:00+00:00" }, ordering: ASC }
		batch_size: 2
	  ) {
		id
		created_at
	  }
	}`)

	batch1 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","created_at":"2025-11-01T10:00:00+00:00"},{"id":"b2c3d4e5-f6a7-8901-bcde-f23456789012","created_at":"2025-11-05T14:30:00+00:00"}]}}`,
	)

	batch2 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234","created_at":"2025-11-08T09:15:00+00:00"},{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"}]}}`,
	)

	batch3 := jsontext.Value(
		`{"data":{"news_stream":[{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
	)

	// Subscribe both before consuming data.
	c1.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c1: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	})

	c2.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("c2: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "2",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	})

	// Consume all existing batches from both.
	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch1,
		}); diff != "" {
			t.Fatalf("c1 batch 1: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch1,
		}); diff != "" {
			t.Fatalf("c2 batch 1: %s", diff)
		}
	})

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch2,
		}); diff != "" {
			t.Fatalf("c1 batch 2: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch2,
		}); diff != "" {
			t.Fatalf("c2 batch 2: %s", diff)
		}
	})

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: batch3,
		}); diff != "" {
			t.Fatalf("c1 batch 3: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: batch3,
		}); diff != "" {
			t.Fatalf("c2 batch 3: %s", diff)
		}
	})

	// Insert new data — both should receive it as a new streamed batch.
	c1.Do(sendMutation(`mutation {
		insert_news_one(object: {
			id: "f0000000-0000-0000-0000-000000000030"
			created_at: "2025-12-01T10:00:00+00:00"
			title: "LATE_JOINER_TEST"
			content: "Test content"
			is_public: true
			author_id: "550e8400-e29b-41d4-a716-446655440001"
			department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
		}) {
			id
		}
	}`))

	wantNew := jsontext.Value(
		`{"data":{"news_stream":[{"id":"f0000000-0000-0000-0000-000000000030","created_at":"2025-12-01T10:00:00+00:00"}]}}`,
	)

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "1", Type: subtest.Next, Payload: wantNew,
		}); diff != "" {
			t.Fatalf("c1 new data: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID: "2", Type: subtest.Next, Payload: wantNew,
		}); diff != "" {
			t.Fatalf("c2 new data: %s", diff)
		}
	})

	c1.Close()
	c2.Close()
}
