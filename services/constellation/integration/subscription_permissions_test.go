package integration_test

import (
	"encoding/json/jsontext"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestSubscriptionPublicRole verifies that the public role only receives news
// entries where is_public = true (4 out of 5 seed entries).
func TestSubscriptionPublicRole(t *testing.T) { //nolint:paralleltest,dupl
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

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
			news(order_by: { created_at: desc }, limit: 10) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		// Public role should only see 4 entries (is_public=true).
		// "Career Ladder Program Expansion" (is_public=false) is filtered out.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}

// TestSubscriptionPublicRoleColumnRestriction verifies that the public role
// cannot query columns outside its select permissions (e.g. is_public).
func TestSubscriptionPublicRoleColumnRestriction(t *testing.T) { //nolint:paralleltest
	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

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
			news(order_by: { created_at: desc }) {
				title
				is_public
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		// is_public is not in the public role's select permissions,
		// so the query should fail validation.
		expectError(t, msg, "1", "")
	}).Close()
}

// TestSubscriptionUserRole verifies that the user role can see all news entries
// (filter is empty) including the non-public one.
func TestSubscriptionUserRole(t *testing.T) { //nolint:paralleltest,dupl
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithRole("user", nil),
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
		// User role has an empty filter, so all 5 entries are visible.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("unexpected message: %s", diff)
		}
	}).Close()
}

// TestSubscriptionXHasuraLiteralFilterNotSubstituted is the end-to-end
// regression guard for the session-variable misclassification bug
// (BUG_MEDIUM_10 / BUG_MEDIUM_13). A subscription filter value that merely
// begins with "x-hasura-" is user-supplied data and must be treated as a
// literal — never as a permission session-variable reference. The exists_test
// role has a row-level filter that references X-Hasura-User-Id, so the
// permission layer runs its session-variable substitution; before the fix that
// pass scanned the whole parameter slice and hit the user's "x-hasura-…" filter
// value, hard-failing the subscription with "session variable not found". After
// the fix only the permission clause's own parameters are substituted, so the
// subscription succeeds and returns rows matching the literal (none here),
// matching Hasura.
func TestSubscriptionXHasuraLiteralFilterNotSubstituted(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		Type: subtest.ConnectionInit,
		// x-hasura-user-id is the genuine session variable the exists_test
		// row-level filter references; the title filter value below is a
		// look-alike literal that is NOT a session variable.
		Payload: initWithRole("exists_test", map[string]string{
			"x-hasura-user-id": "00000000-0000-0000-0000-000000000000",
		}),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
			news(where: { title: { _eq: "x-hasura-not-a-session-var" } }) {
				title
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		// Must be data (empty: no news titled "x-hasura-not-a-session-var"),
		// NOT an error. A "session variable not found" error here is the bug.
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: jsontext.Value(`{"data":{"news":[]}}`),
		}); diff != "" {
			t.Fatalf("unexpected message (a session-variable error indicates regression): %s", diff)
		}
	}).Close()
}
