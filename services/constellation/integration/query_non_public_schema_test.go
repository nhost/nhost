package integration_test

import "testing"

func TestQueryNonPublicSchemaTableDefaultRootNames(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "admin: collection root uses schema-qualified default name",
			query: query{
				Role: "admin",
				Query: `{
				  identity_artists(order_by: {stage_name: asc}) {
				    id
				    stage_name
				    created_by
				  }
				}`,
			},
		},
		{
			name: "user: select by primary key root uses schema-qualified default name",
			query: query{
				Role: "user",
				Query: `{
				  identity_artists_by_pk(id: "660e8400-e29b-41d4-a716-446655440001") {
				    id
				    stage_name
				  }
				}`,
			},
		},
		{
			name: "user: aggregate root uses schema-qualified default name",
			query: query{
				Role: "user",
				Query: `{
				  identity_artists_aggregate {
				    aggregate {
				      count
				    }
				  }
				}`,
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false, ReinitBetweenQueries: false})
}
