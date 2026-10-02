package queries_test

import (
	"encoding/json"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

func TestComputedScalarSubscriptionCohort(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture returns roots, pool, objects, metadata and grouped ops; each test selects its needed values.
	roots, pool, _, _, _ := computedTestFixture(t, true)

	cases := []struct {
		name, query string
		cursor      map[string]any
	}{
		{"live", `subscription { cf_select_items(where:{id:{_eq:1}}) { session_label } }`, nil},
		{
			"stream",
			`subscription { cf_select_items_stream(batch_size:1,cursor:[{initial_value:{id:0}}],where:{id:{_eq:1}}) { session_label } }`,
			map[string]any{"id": 0},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			op := computedOperation(
				t,
				roots,
				tt.query,
				map[string]any{"x-hasura-role": "cf_reader", "x-hasura-user-id": "template"},
			)
			params := multiplexed.PrepareParams(
				[]string{"sub-a", "sub-b"},
				map[string][]any{
					"x-hasura-role":    {"cf_reader", "cf_reader"},
					"x-hasura-user-id": {"user-a", "user-b"},
				},
				tt.cursor,
			)
			params = append(params, op.Parameters...)

			rows, err := pool.Query(t.Context(), op.SQL, params...)
			if err != nil {
				t.Fatalf("multiplex query: %v\n%s", err, op.SQL)
			}
			defer rows.Close()

			results := make(map[string]string)
			for rows.Next() {
				var (
					id   string
					data []byte
				)
				if err := rows.Scan(&id, &data); err != nil {
					t.Fatal(err)
				}

				var payload map[string][]struct {
					Label string `json:"session_label"`
				}
				if err := json.Unmarshal(data, &payload); err != nil {
					t.Fatal(err)
				}

				if len(payload["cf_select_items"+streamSuffix(tt.name)]) != 1 {
					t.Fatalf("%s: %s", id, data)
				}

				results[id] = payload["cf_select_items"+streamSuffix(tt.name)][0].Label
			}

			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}

			if results["sub-a"] != "first:user-a" || results["sub-b"] != "first:user-b" {
				t.Fatalf("cohort: %#v", results)
			}
		})
	}
}

func streamSuffix(name string) string {
	if name == "stream" {
		return "_stream"
	}

	return ""
}
