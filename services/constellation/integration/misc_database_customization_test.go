package integration_test

import (
	"encoding/json/jsontext"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

// TestDatabaseCustomization exercises the `customized` database source, whose
// metadata wraps every root field under `catalog` and prefixes every type
// `Catalog`. Each case is run against both Hasura and Constellation and the
// responses compared, so it validates the customization decorator's operation
// reversal and response re-wrapping on the database execution path.
func TestDatabaseCustomization(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "admin query namespaced departments",
			query: query{
				Query: `query {
					catalog {
						departments(order_by: { name: asc }) {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user query namespaced departments",
			query: query{
				Query: `query {
					catalog {
						departments(order_by: { name: asc }) {
							name
						}
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "admin namespaced aggregate",
			query: query{
				Query: `query {
					catalog {
						departments_aggregate {
							aggregate {
								count
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "admin namespaced with __typename and alias",
			query: query{
				Query: `query {
					cat: catalog {
						departments(order_by: { name: asc }, limit: 1) {
							name
							__typename
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

// TestDatabaseCustomizationSubscription validates that a subscription on the
// namespaced `customized` source flows through the customization decorator's
// subscription handler: the `catalog`-wrapped operation is reversed to the
// native `departments` subscription, polled, and the streamed update is
// re-wrapped under `catalog` before reaching the client.
func TestDatabaseCustomizationSubscription(t *testing.T) { //nolint:paralleltest
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
			catalog {
				departments(order_by: { name: asc }) {
					name
				}
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		want := subtest.Message{
			ID:   "1",
			Type: subtest.Next,
			Payload: jsontext.Value(
				`{"data":{"catalog":{"departments":[{"name":"Engineering"},{"name":"Finance"},{"name":"Human Resources"},{"name":"Marketing"},{"name":"Operations"},{"name":"Sales"}]}}}`,
			),
		}
		if diff := cmp.Diff(want, msg); diff != "" {
			t.Fatalf("unexpected subscription message (-want +got):\n%s", diff)
		}
	}).Close()
}
