package integration_test

import (
	"context"
	"encoding/json/jsontext"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestSubscriptionChangeDetectionNoDuplicates verifies that no duplicate
// messages are sent when the underlying data does not change between poll
// cycles. This confirms xxhash-based deduplication works correctly.
func TestSubscriptionChangeDetectionNoDuplicates(t *testing.T) { //nolint:paralleltest
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
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected initial data: %s", diff)
		}
	}).ExpectNone(
		3 * time.Second, // ~3 poll cycles with no data change
	).Close()
}

// TestSubscriptionRapidSubscribeUnsubscribe verifies that after subscribing
// and receiving initial data, sending a complete immediately stops updates.
// The same subscription ID can then be reused for a new subscription.
func TestSubscriptionRapidSubscribeUnsubscribe(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
		news(order_by: { created_at: desc }, limit: 10) {
			title
		}
	}`)

	wantInitial := jsontext.Value(
		`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
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
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("unexpected initial data: %s", diff)
		}
	}).Send(subtest.Message{
		// Immediately unsubscribe after initial data.
		ID:   "1",
		Type: subtest.Complete,
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "RAPID_UNSUB_NEWS"
				content: "Should not appear"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
			}
		}`),
	).ExpectNone(
		3 * time.Second, // no update because subscription was completed
	).Send(subtest.Message{
		// Re-subscribe with same ID — must work normally.
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		// Should see the mutation result (6 items).
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"RAPID_UNSUB_NEWS"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected data after re-subscribe: %s", diff)
		}
	}).Close()
}

// TestSubscriptionReconnectAfterDisconnect verifies that closing one
// connection and opening a new one still works correctly for the same query.
func TestSubscriptionReconnectAfterDisconnect(t *testing.T) { //nolint:paralleltest,dupl
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
		news(order_by: { created_at: desc }, limit: 10) {
			title
		}
	}`)

	wantInitial := jsontext.Value(
		`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	// c1 subscribes, gets initial data.
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
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c1 initial data: %s", diff)
		}
	}).Close()

	// c2 connects after c1 is closed.
	c2, err := subtest.NewClient(t, wsURL)
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
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c2 initial data: %s", diff)
		}
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "RECONNECT_TEST_NEWS"
				content: "Reconnect test"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"RECONNECT_TEST_NEWS"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c2 after mutation: %s", diff)
		}
	}).Close()
}

// TestSubscriptionConnectionCloseWithoutComplete verifies that closing a
// WebSocket without sending a graphql-transport-ws complete message for
// active subscriptions does not break the server. A new connection can
// subscribe to the same query and receive updates normally.
func TestSubscriptionConnectionCloseWithoutComplete(t *testing.T) { //nolint:paralleltest,dupl
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
		news(order_by: { created_at: desc }, limit: 10) {
			title
		}
	}`)

	wantInitial := jsontext.Value(
		`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	// c1 subscribes, gets initial data, then closes without sending complete.
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
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c1 initial data: %s", diff)
		}
	}).Close() // closes WebSocket — no complete sent for subscription "1"

	// c2 subscribes to same query — server must have cleaned up c1.
	c2, err := subtest.NewClient(t, wsURL)
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
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c2 initial data: %s", diff)
		}
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "CLOSE_WITHOUT_COMPLETE_TEST"
				content: "Test content"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"CLOSE_WITHOUT_COMPLETE_TEST"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("c2 after mutation: %s", diff)
		}
	}).Close()
}

// TestSubscriptionErrorDuringPoll verifies that a SQL error during a poll
// cycle propagates as an error message to subscribers. The cached
// subscription SQL references `news.title`; renaming that column out from
// under the server forces the next poll to fail, and the failure should
// surface to the subscriber as a graphql-transport-ws error frame.
func TestSubscriptionErrorDuringPoll(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultDBURL
	}

	conn, err := pgx.Connect(t.Context(), dbURL)
	if err != nil {
		t.Fatalf("failed to connect to database: %v", err)
	}

	t.Cleanup(func() { conn.Close(t.Context()) })

	// Restore the schema unconditionally — runs even on panic. We use a
	// fresh context because t.Context() is already cancelled by the time
	// Cleanup fires. The conditional RENAME no-ops if the column was never
	// renamed (test failed early), so the cleanup is safe to retry.
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		cleanupConn, err := pgx.Connect(ctx, dbURL)
		if err != nil {
			t.Logf("cleanup: reconnect failed: %v", err)
			return
		}
		defer cleanupConn.Close(ctx)

		_, _ = cleanupConn.Exec(
			ctx,
			`DO $$ BEGIN
				IF EXISTS (SELECT 1 FROM information_schema.columns
					WHERE table_schema='public' AND table_name='news' AND column_name='title_old') THEN
					ALTER TABLE public.news RENAME COLUMN title_old TO title;
				END IF;
			END $$`,
		)
	})

	c, err := subtest.NewClient(
		t, wsURL, subtest.WithTimeout(15*time.Second),
	)
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
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected initial data: %s", diff)
		}
	}).Do(func() error {
		// Break the cached SQL by renaming the column the subscription selects.
		// The cached prepared statement / generated SQL still references
		// "title", so the next poll fails.
		_, err := conn.Exec(
			t.Context(),
			"ALTER TABLE public.news RENAME COLUMN title TO title_old",
		)
		if err != nil {
			return fmt.Errorf("rename column: %w", err)
		}

		return nil
	}).Expect(func(msg subtest.Message) {
		// The next poll should fail and deliver an error to the subscriber.
		expectError(t, msg, "1", "title")
	})
}
