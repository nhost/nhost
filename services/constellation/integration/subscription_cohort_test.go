package integration_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestSubscriptionSameCohortBatching verifies that two WebSocket connections
// with an identical query and role land in the same cohort. Both must receive
// initial data and subsequent mutation-triggered updates.
//
// Both clients subscribe before consuming data so they are registered in the
// same poll cycle, ensuring the hash-based dedup sends the initial result to
// both.
func TestSubscriptionSameCohortBatching(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(t, wsURL, subtest.WithTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}

	c2, err := subtest.NewClient(t, wsURL, subtest.WithTimeout(5*time.Second))
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

	wantAfterInsert := jsontext.Value(
		`{"data":{"news":[{"title":"COHORT_TEST_NEWS"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	// Init + subscribe both before consuming any data so they land in the
	// same cohort and both receive the first poll result.
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

	// Both should receive the same initial data.
	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c1 initial data: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "2",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c2 initial data: %s", diff)
		}
	})

	// Trigger a mutation — both connections must see the update.
	c1.Do(sendMutation(`mutation {
		insert_news_one(object: {
			title: "COHORT_TEST_NEWS"
			content: "Cohort batching test"
			is_public: true
			author_id: "550e8400-e29b-41d4-a716-446655440001"
			department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
		}) {
			id
		}
	}`))

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantAfterInsert,
		}); diff != "" {
			t.Fatalf("c1 after insert: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "2",
			Type:    subtest.Next,
			Payload: wantAfterInsert,
		}); diff != "" {
			t.Fatalf("c2 after insert: %s", diff)
		}
	})

	c1.Close()
	c2.Close()
}

// TestSubscriptionSameCohortWithVariables verifies that two connections using
// the same query template with identical variables land in the same cohort.
func TestSubscriptionSameCohortWithVariables(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c1, err := subtest.NewClient(t, wsURL, subtest.WithTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}

	c2, err := subtest.NewClient(t, wsURL, subtest.WithTimeout(5*time.Second))
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayloadWithVars(
		`subscription ($where: news_bool_exp!) {
			news(where: $where, order_by: { created_at: asc }) {
				id
			}
		}`,
		map[string]any{
			"where": map[string]any{
				"created_at": map[string]any{
					"_gt": "2025-11-08T00:00:00+00:00",
				},
			},
		},
	)

	// 3 news entries after Nov 8 midnight: Nov 8, 9, 12
	wantInitial := jsontext.Value(
		`{"data":{"news":[{"id":"c3d4e5f6-a7b8-9012-cdef-345678901234"},{"id":"d4e5f6a7-b8c9-0123-defa-456789012345"},{"id":"e5f6a7b8-c9d0-1234-efab-567890123456"}]}}`,
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

	c1.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c1 initial data: %s", diff)
		}
	})

	c2.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "2",
			Type:    subtest.Next,
			Payload: wantInitial,
		}); diff != "" {
			t.Fatalf("c2 initial data: %s", diff)
		}
	})

	// Mutate — insert a news entry after the filter date.
	c1.Do(sendMutation(`mutation {
		insert_news_one(object: {
			title: "COHORT_VARS_TEST"
			content: "Cohort variables test"
			created_at: "2025-12-01T00:00:00+00:00"
			is_public: true
			author_id: "550e8400-e29b-41d4-a716-446655440001"
			department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
		}) {
			id
		}
	}`))

	// Both must see 4 items (the 3 originals + the new one).
	assertUpdate := func(name string, msg subtest.Message, wantID string) {
		t.Helper()

		if msg.Type != subtest.Next || msg.ID != wantID {
			t.Fatalf("%s: expected next id=%s, got type=%s id=%s", name, wantID, msg.Type, msg.ID)
		}

		var payload map[string]map[string][]map[string]any
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			t.Fatalf("%s: unmarshal payload: %v", name, err)
		}

		if got := len(payload["data"]["news"]); got != 4 {
			t.Fatalf("%s: expected 4 items, got %d: %s", name, got, string(msg.Payload))
		}
	}

	c1.Expect(func(msg subtest.Message) { assertUpdate("c1", msg, "1") })
	c2.Expect(func(msg subtest.Message) { assertUpdate("c2", msg, "2") })

	c1.Close()
	c2.Close()
}

// TestSubscriptionDifferentRolesDifferentCohorts verifies that the same query
// sent by different roles produces different cohorts with role-appropriate data.
func TestSubscriptionDifferentRolesDifferentCohorts(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	cAdmin, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	cPublic, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
		news(order_by: { created_at: desc }, limit: 10) {
			title
		}
	}`)

	// Admin sees all 5 entries.
	wantAdmin5 := jsontext.Value(
		`{"data":{"news":[{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	// Public role sees only 4 (is_public=true), no "Career Ladder Program Expansion".
	wantPublic4 := jsontext.Value(
		`{"data":{"news":[{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
	)

	// Init + subscribe admin
	cAdmin.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("admin: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantAdmin5,
		}); diff != "" {
			t.Fatalf("admin initial: %s", diff)
		}
	})

	// Init + subscribe public
	cPublic.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithRole("public", nil),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("public: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantPublic4,
		}); diff != "" {
			t.Fatalf("public initial: %s", diff)
		}
	})

	// Insert a public news entry — both should see it.
	cAdmin.Do(sendMutation(`mutation {
		insert_news_one(object: {
			title: "ROLE_COHORT_PUBLIC_NEWS"
			content: "Public news for role cohort test"
			is_public: true
			author_id: "550e8400-e29b-41d4-a716-446655440001"
			department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
		}) {
			id
		}
	}`))

	// Admin sees 6 items.
	cAdmin.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"ROLE_COHORT_PUBLIC_NEWS"},{"title":"Career Ladder Program Expansion"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("admin after insert: %s", diff)
		}
	})

	// Public sees 5 items (the new public one + original 4 public).
	cPublic.Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"news":[{"title":"ROLE_COHORT_PUBLIC_NEWS"},{"title":"Sustainability Initiative Milestone Reached"},{"title":"Employee Recognition Program Launch"},{"title":"New Partnership with Industry Leader Announced"},{"title":"Company Announces Q3 Financial Results"}]}}`,
			),
		}); diff != "" {
			t.Fatalf("public after insert: %s", diff)
		}
	})

	cAdmin.Close()
	cPublic.Close()
}

// TestSubscriptionSessionVariableMultiplexing verifies that two user-role
// connections with different X-Hasura-departments session variables receive
// different data despite potentially sharing a cohort (session variables are
// packed per-subscriber).
func TestSubscriptionSessionVariableMultiplexing(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	cHR, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	cEng, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	subPayload := subscribePayload(`subscription {
		kb_entries(order_by: { title: asc }) {
			id
			title
		}
	}`)

	// HR department: 2db9de0a-b9ba-416e-8619-783a399ae2b3
	// KB entries: Employee Onboarding, Performance Review, Company Benefits
	wantHR := jsontext.Value(
		`{"data":{"kb_entries":[{"id":"33333333-3333-3333-3333-333333333333","title":"Company Benefits Overview"},{"id":"11111111-1111-1111-1111-111111111111","title":"Employee Onboarding Process"},{"id":"22222222-2222-2222-2222-222222222222","title":"Performance Review Guidelines"}]}}`,
	)

	// Engineering department: 023d4410-715e-4675-96a5-a58fd50ef33c
	// KB entries: Code Review, Development Environment, Deployment Procedures
	wantEng := jsontext.Value(
		`{"data":{"kb_entries":[{"id":"44444444-4444-4444-4444-444444444444","title":"Code Review Best Practices"},{"id":"66666666-6666-6666-6666-666666666666","title":"Deployment Procedures"},{"id":"55555555-5555-5555-5555-555555555555","title":"Development Environment Setup"}]}}`,
	)

	// Init + subscribe HR user
	cHR.Send(subtest.Message{
		Type: subtest.ConnectionInit,
		Payload: initWithRole("user", map[string]string{
			"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3}",
		}),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("HR: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantHR,
		}); diff != "" {
			t.Fatalf("HR initial data: %s", diff)
		}
	})

	// Init + subscribe Engineering user
	cEng.Send(subtest.Message{
		Type: subtest.ConnectionInit,
		Payload: initWithRole("user", map[string]string{
			"x-hasura-departments": "{023d4410-715e-4675-96a5-a58fd50ef33c}",
		}),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("Eng: expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:      "1",
		Type:    subtest.Subscribe,
		Payload: subPayload,
	}).Expect(func(msg subtest.Message) {
		if diff := cmp.Diff(msg, subtest.Message{
			ID:      "1",
			Type:    subtest.Next,
			Payload: wantEng,
		}); diff != "" {
			t.Fatalf("Eng initial data: %s", diff)
		}
	})

	cHR.Close()
	cEng.Close()
}
