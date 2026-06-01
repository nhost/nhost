package integration_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestSubscriptionBadAdminSecret verifies that connecting with a wrong admin
// secret does not grant admin access. The server accepts the connection (falls
// back to the public role) so the subscription only sees public news.
func TestSubscriptionBadAdminSecret(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	badInitPayload, _ := json.Marshal(map[string]any{
		"headers": map[string]string{
			"x-hasura-admin-secret": "wrong-secret",
		},
	})

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: badInitPayload,
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
		// Wrong credentials should NOT grant admin access.
		// Only public news (is_public=true) should be visible — 4 of 5 entries.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("wrong credentials should give public-only access: %s", diff)
		}
	}).Close()
}

// TestSubscriptionSubscribeBeforeInit verifies that subscribing before sending
// connection_init returns an error but keeps the connection open.
func TestSubscriptionSubscribeBeforeInit(t *testing.T) { //nolint:paralleltest
	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		expectError(t, msg, "1", "connection not initialized")
	}).Close()
}

// TestSubscriptionDuplicateID verifies that subscribing with an already-active
// subscription ID returns an error.
func TestSubscriptionDuplicateID(t *testing.T) { //nolint:paralleltest
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
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		expectError(t, msg, "1", "subscription with ID already exists")
	}).Close()
}

// TestSubscriptionInvalidQuery verifies that subscribing with an invalid
// GraphQL query returns an error.
func TestSubscriptionInvalidQuery(t *testing.T) { //nolint:paralleltest
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
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subscribePayload(`subscription { this is not valid }`),
	}).Expect(func(msg subtest.Message) {
		expectError(t, msg, "1", "")
	}).Close()
}

// TestSubscriptionNonExistentField verifies that subscribing with a query that
// references a field not in the schema returns an error.
func TestSubscriptionNonExistentField(t *testing.T) { //nolint:paralleltest
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
			nonexistent_table {
				id
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		expectError(t, msg, "1", "")
	}).Close()
}
