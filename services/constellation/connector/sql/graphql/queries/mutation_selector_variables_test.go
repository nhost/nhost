package queries_test

import (
	"bytes"
	"errors"
	"fmt"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestMutationSelectorVariablesRejectOmission(t *testing.T) {
	t.Parallel()

	roots, schema := variableInputRoots(t)
	selectors := []struct {
		name, definition, where string
	}{
		{"comparison operand", "$id:String", "{id:{_eq:$id}}"},
		{"or arm", "$id:String", `{_or:[{id:{_eq:$id}},{name:{_eq:"other"}}]}`},
		{"and arm", "$id:String", "{_and:[{id:{_eq:$id}}]}"},
		{"not", "$id:String", "{_not:{id:{_neq:$id}}}"},
		{"whole comparison", "$cmp:String_comparison_exp", "{id:$cmp}"},
		{"whole or", "$or:[users_bool_exp!]", "{_or:$or}"},
		{"whole not", "$not:users_bool_exp", "{_not:$not}"},
		{"relationship", "$id:String", "{posts:{id:{_eq:$id}}}"},
		{"JSONB property", "$id:String", "{data:{_contains:{id:$id}}}"},
	}

	mutations := []struct{ name, field string }{
		{"delete", "delete_users(where:%s){affected_rows}"},
		{"update", `update_users(where:%s,_set:{name:"changed"}){affected_rows}`},
		{
			"update many",
			`update_users_many(updates:[{where:{},_set:{name:"first"}},{where:%s,_set:{name:"changed"}}]){affected_rows}`,
		},
		{
			"upsert",
			`insert_users_one(object:{id:"u1",name:"changed"},on_conflict:{constraint:users_pkey,update_columns:[name],where:%s}){id}`,
		},
		{
			"bulk upsert",
			`insert_users(objects:[{id:"u1",name:"changed"}],on_conflict:{constraint:users_pkey,update_columns:[name],where:%s}){affected_rows}`,
		},
		{
			"nested upsert",
			`insert_posts_one(object:{id:"p1",author:{data:{id:"u1"},on_conflict:{constraint:users_pkey,update_columns:[name],where:%s}}}){id}`,
		},
	}
	for _, mutation := range mutations {
		for _, selector := range selectors {
			t.Run(mutation.name+"/"+selector.name, func(t *testing.T) {
				t.Parallel()

				query := "mutation(" + selector.definition + "){" + fmt.Sprintf(
					mutation.field,
					selector.where,
				) + "}"

				document, errs := gqlparser.LoadQueryWithRules(
					schema,
					query,
					rules.NewDefaultRules(),
				)
				if len(errs) != 0 {
					t.Fatalf("LoadQueryWithRules: %v", errs)
				}

				variables, err := validator.VariableValues(schema, document.Operations[0], nil)
				if err != nil {
					t.Fatalf("VariableValues: %v", err)
				}

				var before bytes.Buffer
				formatter.NewFormatter(&before).FormatQueryDocument(document)
				operations, err := roots.BuildQuery(
					document.Operations[0],
					document.Fragments,
					variables,
					"admin",
					nil,
				)

				var validationErr *arguments.QueryValidationError
				if len(operations) != 0 || !errors.Is(err, arguments.ErrInvalidArgument) ||
					!errors.As(err, &validationErr) {
					t.Fatalf(
						"expected validation failure and no SQL, got operations=%v, error=%v",
						operations,
						err,
					)
				}

				if validationErr.Error() != arguments.NewOmittedMutationSelectorError().Error() {
					t.Fatalf("unexpected validation error: %v", err)
				}

				var after bytes.Buffer
				formatter.NewFormatter(&after).FormatQueryDocument(document)

				if before.String() != after.String() {
					t.Fatal("rejected request mutated the cached document")
				}
			})
		}
	}
}

func TestMutationSelectorVariablesPreserveControls(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "explicit null",
			query:         `mutation($id:String){delete_users(where:{id:{_eq:$id}}){affected_rows}}`,
			variables:     `{"id":null}`,
			wantQuery:     `mutation{delete_users(where:{id:{_eq:null}}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "variable default",
			query:         `mutation($id:String="u1"){delete_users(where:{id:{_eq:$id}}){affected_rows}}`,
			variables:     `{}`,
			wantQuery:     `mutation{delete_users(where:{id:{_eq:"u1"}}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "intentional empty comparison",
			query:         `mutation($cmp:String_comparison_exp){delete_users(where:{id:$cmp}){affected_rows}}`,
			variables:     `{"cmp":{}}`,
			wantQuery:     `mutation{delete_users(where:{}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "intentional empty filter",
			query:         `mutation($where:users_bool_exp!){delete_users(where:$where){affected_rows}}`,
			variables:     `{"where":{}}`,
			wantQuery:     `mutation{delete_users(where:{}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "nullable list position",
			query:         `mutation($id:String){delete_users(where:{data:{_contains:{ids:["u1",$id]}}}){affected_rows}}`,
			variables:     `{}`,
			wantQuery:     `mutation{delete_users(where:{data:{_contains:{ids:["u1",null]}}}){affected_rows}}`,
			wantVariables: `{}`,
		},
	}
	testVariableInputs(t, tests)
}
