package queries_test

import (
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

//nolint:paralleltest,tparallel // Sequential subtests share one fixture and pool to respect the testdb connection budget.
func TestJSONBTypedMutationValuesExecution(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(t, `CREATE TABLE users (
		id text PRIMARY KEY, name text, age int4, data jsonb DEFAULT '{"default":true}', active bool, score float8
	);`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)
	roots, schema := variableInputRoots(t)

	tests := []struct {
		name      string
		initial   string
		query     string
		variables string
		want      string
		sqlNull   bool
	}{
		{
			name:      "insert whole object string",
			query:     `mutation($object:users_insert_input!){result:insert_users(objects:[$object]){affected_rows returning{id name data}}}`,
			variables: `{"object":{"id":"u1","name":"original","data":"{}"}}`,
			want:      `"{}"`,
		},
		{
			name:      "insert nested string operand",
			query:     `mutation($data:jsonb!){result:insert_users(objects:[{id:"u1",name:"original",data:$data}]){affected_rows returning{id name data}}}`,
			variables: `{"data":"hello"}`,
			want:      `"hello"`,
		},
		{
			name:      "insert nested object control",
			query:     `mutation($data:jsonb!){result:insert_users(objects:[{id:"u1",name:"original",data:$data}]){affected_rows returning{id name data}}}`,
			variables: `{"data":{"strings":["{}","hello"],"missing":null}}`,
			want:      `{"strings":["{}","hello"],"missing":null}`,
		},
		{
			name:      "insert explicit SQL null",
			query:     `mutation($data:jsonb){result:insert_users(objects:[{id:"u1",name:"original",data:$data}]){affected_rows returning{id name data}}}`,
			variables: `{"data":null}`,
			want:      `null`,
			sqlNull:   true,
		},
		{
			name:      "insert omitted default",
			query:     `mutation($data:jsonb){result:insert_users(objects:[{id:"u1",name:"original",data:$data}]){affected_rows returning{id name data}}}`,
			variables: `{}`,
			want:      `{"default":true}`,
		},
		{
			name:      "set string",
			initial:   `{}`,
			query:     `mutation($set:users_set_input!){result:update_users(where:{id:{_eq:"u1"}},_set:$set){affected_rows returning{id name data}}}`,
			variables: `{"set":{"data":"{}"}}`,
			want:      `"{}"`,
		},
		{
			name:      "set null-looking string",
			initial:   `{}`,
			query:     `mutation($value:jsonb!){result:update_users(where:{id:{_eq:"u1"}},_set:{data:$value}){affected_rows returning{id name data}}}`,
			variables: `{"value":"null"}`,
			want:      `"null"`,
		},
		{
			name:      "set SQL null",
			initial:   `{}`,
			query:     `mutation($value:jsonb){result:update_users(where:{id:{_eq:"u1"}},_set:{data:$value}){affected_rows returning{id name data}}}`,
			variables: `{"value":null}`,
			want:      `null`,
			sqlNull:   true,
		},
		{
			name:      "append string",
			initial:   `[]`,
			query:     `mutation($append:users_append_input!){result:update_users(where:{id:{_eq:"u1"}},_append:$append){affected_rows returning{id name data}}}`,
			variables: `{"append":{"data":"hello"}}`,
			want:      `["hello"]`,
		},
		{
			name:      "prepend string",
			initial:   `[42]`,
			query:     `mutation($value:jsonb!){result:update_users(where:{id:{_eq:"u1"}},_prepend:{data:$value}){affected_rows returning{id name data}}}`,
			variables: `{"value":"hello"}`,
			want:      `["hello",42]`,
		},
		{
			name:      "append nested object control",
			initial:   `{}`,
			query:     `mutation($value:String!){result:update_users(where:{id:{_eq:"u1"}},_append:{data:{profile:{value:$value,missing:null}}}){affected_rows returning{id name data}}}`,
			variables: `{"value":"{}"}`,
			want:      `{"profile":{"value":"{}","missing":null}}`,
		},
		{
			name:      "delete key stays text",
			initial:   `{"hello":1,"keep":2}`,
			query:     `mutation($value:String!){result:update_users(where:{id:{_eq:"u1"}},_delete_key:{data:$value}){affected_rows returning{id name data}}}`,
			variables: `{"value":"hello"}`,
			want:      `{"keep":2}`,
		},
		{
			name:      "delete element stays integer",
			initial:   `[10,20]`,
			query:     `mutation($value:Int!){result:update_users(where:{id:{_eq:"u1"}},_delete_elem:{data:$value}){affected_rows returning{id name data}}}`,
			variables: `{"value":0}`,
			want:      `[20]`,
		},
		{
			name:      "delete path stays text array",
			initial:   `{"profile":{"hello":1,"keep":2}}`,
			query:     `mutation($value:String!){result:update_users(where:{id:{_eq:"u1"}},_delete_at_path:{data:["profile",$value]}){affected_rows returning{id name data}}}`,
			variables: `{"value":"hello"}`,
			want:      `{"profile":{"keep":2}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pool.Exec(t.Context(), "TRUNCATE users"); err != nil {
				t.Fatalf("reset fixture: %v", err)
			}

			if tt.initial != "" {
				if err := pool.Exec(
					t.Context(),
					`INSERT INTO users(id,name,data) VALUES('u1','original',$1::jsonb)`,
					json.RawMessage(tt.initial),
				); err != nil {
					t.Fatalf("seed fixture: %v", err)
				}
			}

			built := buildVariableInput(t, roots, schema, tt.query, tt.variables)

			result, err := client.ExecuteOperations(
				t.Context(),
				built,
				slog.New(slog.DiscardHandler),
			)
			if err != nil {
				t.Fatalf("ExecuteOperations: %v", err)
			}

			var data any
			if err := json.Unmarshal([]byte(tt.want), &data); err != nil {
				t.Fatalf("decode expectation: %v", err)
			}

			want := []jsonbStoredRow{{ID: "u1", Name: "original", Data: data, SQLNull: false}}
			assertJSONBReturning(t, result, true, want)

			want[0].SQLNull = tt.sqlNull
			if diff := cmp.Diff(want, readJSONBStoredRows(t, pool)); diff != "" {
				t.Errorf("stored rows (-want +got):\n%s", diff)
			}
		})
	}
}
