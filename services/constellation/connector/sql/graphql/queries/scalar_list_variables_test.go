package queries_test

import (
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

type scalarListCoercionCase struct {
	name              string
	query             string
	variables         string
	explicitVariables string
	want              string
}

func scalarListCoercionCases() []scalarListCoercionCase {
	return []scalarListCoercionCase{
		{
			name:      "read integer singleton",
			query:     `query($xs:[Int!]!){users(where:{age:{_in:$xs}}){id}}`,
			variables: `{"xs":1}`, explicitVariables: `{"xs":[1]}`,
			want: `{"users":[{"id":"u1"}]}`,
		},
		{
			name:      "read float singleton",
			query:     `query($xs:[float8!]!){users(where:{score:{_in:$xs}}){id}}`,
			variables: `{"xs":1.5}`, explicitVariables: `{"xs":[1.5]}`,
			want: `{"users":[{"id":"u1"}]}`,
		},
		{
			name:      "read boolean singleton",
			query:     `query($xs:[Boolean!]!){users(where:{active:{_in:$xs}}){id}}`,
			variables: `{"xs":true}`, explicitVariables: `{"xs":[true]}`,
			want: `{"users":[{"id":"u1"}]}`,
		},
		{
			name:      "read integer scalar default",
			query:     `query($xs:[Int!]=1){users(where:{age:{_in:$xs}}){id}}`,
			variables: `{}`, explicitVariables: `{"xs":[1]}`,
			want: `{"users":[{"id":"u1"}]}`,
		},
		{
			name:      "read float scalar default",
			query:     `query($xs:[float8!]=1.5){users(where:{score:{_in:$xs}}){id}}`,
			variables: `{}`, explicitVariables: `{"xs":[1.5]}`,
			want: `{"users":[{"id":"u1"}]}`,
		},
		{
			name:              "read nested input list",
			query:             `query($where:users_bool_exp!){users(where:$where){id}}`,
			variables:         `{"where":{"age":{"_in":1},"active":{"_in":true}}}`,
			explicitVariables: `{"where":{"age":{"_in":[1]},"active":{"_in":[true]}}}`,
			want:              `{"users":[{"id":"u1"}]}`,
		},
		{
			name:              "insert conflict filter integer singleton",
			query:             `mutation($xs:[Int!]!){insert_users_one(object:{id:"u1",name:"updated"},on_conflict:{constraint:users_pkey,update_columns:[name],where:{age:{_in:$xs}}}){id name}}`,
			variables:         `{"xs":1}`,
			explicitVariables: `{"xs":[1]}`,
			want:              `{"insert_users_one":{"id":"u1","name":"updated"}}`,
		},
		{
			name:              "update integer singleton",
			query:             `mutation($xs:[Int!]!){update_users(where:{age:{_in:$xs}},_set:{name:"updated"}){affected_rows returning{id}}}`,
			variables:         `{"xs":1}`,
			explicitVariables: `{"xs":[1]}`,
			want:              `{"update_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
		{
			name:              "update boolean singleton",
			query:             `mutation($xs:[Boolean!]!){update_users(where:{active:{_in:$xs}},_set:{name:"updated"}){affected_rows returning{id}}}`,
			variables:         `{"xs":true}`,
			explicitVariables: `{"xs":[true]}`,
			want:              `{"update_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
		{
			name:              "update integer scalar default",
			query:             `mutation($xs:[Int!]=1){update_users(where:{age:{_in:$xs}},_set:{name:"updated"}){affected_rows returning{id}}}`,
			variables:         `{}`,
			explicitVariables: `{"xs":[1]}`,
			want:              `{"update_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
		{
			name:              "delete boolean singleton",
			query:             `mutation($xs:[Boolean!]!){delete_users(where:{active:{_in:$xs}}){affected_rows returning{id}}}`,
			variables:         `{"xs":true}`,
			explicitVariables: `{"xs":[true]}`,
			want:              `{"delete_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
		{
			name:              "delete boolean scalar default",
			query:             `mutation($xs:[Boolean!]=true){delete_users(where:{active:{_in:$xs}}){affected_rows returning{id}}}`,
			variables:         `{}`,
			explicitVariables: `{"xs":[true]}`,
			want:              `{"delete_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
		{
			name:              "update nested input list",
			query:             `mutation($where:users_bool_exp!){update_users(where:$where,_set:{name:"updated"}){affected_rows returning{id}}}`,
			variables:         `{"where":{"age":{"_in":1},"active":{"_in":true}}}`,
			explicitVariables: `{"where":{"age":{"_in":[1]},"active":{"_in":[true]}}}`,
			want:              `{"update_users":{"affected_rows":1,"returning":[{"id":"u1"}]}}`,
		},
	}
}

func TestScalarListVariableInputs(t *testing.T) {
	t.Parallel()

	roots, schema := variableInputRoots(t)
	for _, tt := range scalarListCoercionCases() {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := buildVariableInput(t, roots, schema, tt.query, tt.variables)
			want := buildVariableInput(t, roots, schema, tt.query, tt.explicitVariables)

			normalize(got)
			normalize(want)

			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("SQL and parameters (-array +singleton):\n%s", diff)
			}
		})
	}
}

//nolint:paralleltest,tparallel // Subtests reset one shared database and must execute sequentially.
func TestScalarListVariableExecution(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(t, `CREATE TABLE users (
		id text PRIMARY KEY, name text, age int4, data jsonb, active bool, score float8
	);`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)

	roots, schema := variableInputRoots(t)
	for _, tt := range scalarListCoercionCases() {
		t.Run(tt.name, func(t *testing.T) {
			// Reuse one pool and reset rows for both forms of each mutation.
			for _, variables := range []string{tt.variables, tt.explicitVariables} {
				if err := pool.Exec(t.Context(), `TRUNCATE users;
					INSERT INTO users(id,name,age,active,score) VALUES
					('u1','first',1,true,1.5), ('u2','second',2,false,2.5);`); err != nil {
					t.Fatalf("reset fixture: %v", err)
				}

				operations := buildVariableInput(t, roots, schema, tt.query, variables)

				result, err := client.ExecuteOperations(
					t.Context(),
					operations,
					slog.New(slog.DiscardHandler),
				)
				if err != nil {
					t.Fatalf("ExecuteOperations: %v", err)
				}

				raw, err := json.Marshal(result)
				if err != nil {
					t.Fatalf("Marshal result: %v", err)
				}

				var got, want any
				if err := json.Unmarshal(raw, &got); err != nil {
					t.Fatalf("Unmarshal result: %v", err)
				}

				if err := json.Unmarshal([]byte(tt.want), &want); err != nil {
					t.Fatalf("Unmarshal expected result: %v", err)
				}

				if diff := cmp.Diff(want, got); diff != "" {
					t.Errorf("execution result (-want +got):\n%s", diff)
				}
			}
		})
	}
}
