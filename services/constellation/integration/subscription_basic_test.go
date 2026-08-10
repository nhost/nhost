package integration_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

func TestSubscription(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
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
			news(order_by: { created_at: desc }, limit: 10) {
				title
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
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "TEST_SUBSCRIPTION_NEWS_1"
				content: "Test content for subscription"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
				title
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"TEST_SUBSCRIPTION_NEWS_1"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}

// TestSubscriptionWithVariables verifies that subscriptions with GraphQL
// variables work correctly through the multiplexed query pipeline.
func TestSubscriptionWithVariables(t *testing.T) { //nolint:paralleltest
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
		Payload: subscribePayloadWithVars(
			`subscription ($where: news_bool_exp!) {
				news(where: $where, order_by: { created_at: asc }) {
					id
					created_at
				}
			}`,
			map[string]any{
				"where": map[string]any{
					"created_at": map[string]any{
						"_gt": "2025-11-08T00:00:00+00:00",
					},
				},
			},
		),
	}).Expect(func(msg subtest.Message) {
		// Should return the 3 news entries after Nov 8 midnight (Nov 8, 9, 12)
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234","created_at":"2025-11-08T09:15:00+00:00"},{"id":"d4e5f6a7-b8c9-0123-defa-456789012345","created_at":"2025-11-09T16:45:00+00:00"},{"id":"e5f6a7b8-c9d0-1234-efab-567890123456","created_at":"2025-11-12T11:00:00+00:00"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}

func TestSubscriptionMultiple(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
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
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`,
	})

	subPayload2, _ := json.Marshal(map[string]string{
		"query": `subscription {
			users(order_by: { createdAt: asc }) {
				id
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
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Send(subtest.Message{
		ID:      "2",
		Type:    subtest.Subscribe,
		Payload: subPayload2,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "2",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"users":[{"id":"550e8400-e29b-41d4-a716-446655440001"},{"id":"550e8400-e29b-41d4-a716-446655440002"},{"id":"550e8400-e29b-41d4-a716-446655440003"},{"id":"550e8400-e29b-41d4-a716-446655440004"},{"id":"550e8400-e29b-41d4-a716-446655440011"},{"id":"550e8400-e29b-41d4-a716-446655440012"},{"id":"550e8400-e29b-41d4-a716-446655440013"},{"id":"550e8400-e29b-41d4-a716-446655440014"},{"id":"550e8400-e29b-41d4-a716-446655440021"},{"id":"550e8400-e29b-41d4-a716-446655440022"},{"id":"550e8400-e29b-41d4-a716-446655440023"},{"id":"550e8400-e29b-41d4-a716-446655440024"},{"id":"550e8400-e29b-41d4-a716-446655440031"},{"id":"550e8400-e29b-41d4-a716-446655440032"},{"id":"550e8400-e29b-41d4-a716-446655440033"},{"id":"550e8400-e29b-41d4-a716-446655440034"},{"id":"550e8400-e29b-41d4-a716-446655440041"},{"id":"550e8400-e29b-41d4-a716-446655440042"},{"id":"550e8400-e29b-41d4-a716-446655440043"},{"id":"550e8400-e29b-41d4-a716-446655440044"},{"id":"550e8400-e29b-41d4-a716-446655440051"},{"id":"550e8400-e29b-41d4-a716-446655440052"},{"id":"550e8400-e29b-41d4-a716-446655440053"},{"id":"550e8400-e29b-41d4-a716-446655440054"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Do(
		sendMutation(`mutation {
			insert_news_one(object: {
				title: "TEST_SUBSCRIPTION_NEWS_1"
				content: "Test content for subscription"
				is_public: true
				author_id: "550e8400-e29b-41d4-a716-446655440001"
				department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
			}) {
				id
				title
			}
		}`),
	).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"TEST_SUBSCRIPTION_NEWS_1"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}
