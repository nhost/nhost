package integration_test

import (
	"encoding/json/jsontext"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestSubscriptionUnsubscribe verifies that after sending a complete message
// for a subscription, no further updates are delivered for it.
func TestSubscriptionUnsubscribe(t *testing.T) { //nolint:paralleltest
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
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Complete,
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "AFTER_UNSUBSCRIBE"
				content: "Should not appear"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
			}
		}`),
	).ExpectNone(
		3 * time.Second,
	).Close()
}

// TestSubscriptionUnsubscribeOne verifies that completing one subscription does
// not affect other active subscriptions on the same connection.
func TestSubscriptionUnsubscribeOne(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	newsQuery := subscribePayload(`subscription {
		news(order_by: { created_at: desc }, limit: 10) {
			title
		}
	}`)

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
		Payload: newsQuery,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected initial data for sub 1: %s", diff)
		}
	}).Send(subtest.Message{
		ID:      "2",
		Type:    subtest.Subscribe,
		Payload: newsQuery,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "2",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected initial data for sub 2: %s", diff)
		}
	}).Send(subtest.Message{
		// Unsubscribe sub 1 only
		ID:   "1",
		Type: subtest.Complete,
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "AFTER_UNSUB_ONE"
				content: "Only sub 2 should see this"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
			}
		}`),
	).Expect(func(msg subtest.Message) {
		// Only sub 2 should receive the update.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "2",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"AFTER_UNSUB_ONE"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message for sub 2: %s", diff)
		}
	}).Close()
}
