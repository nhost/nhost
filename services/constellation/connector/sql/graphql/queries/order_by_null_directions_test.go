package queries_test

import "testing"

func TestNullableOrderByDirections(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "null variable",
			query:         `query($d:order_by){users(order_by:{name:$d}){id}}`,
			variables:     `{"d":null}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "null default",
			query:         `query($d:order_by=null){users(order_by:{name:$d}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "null overrides default",
			query:         `query($d:order_by=asc){users(order_by:{name:$d}){id}}`,
			variables:     `{"d":null}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "non-null default retained",
			query:         `query($d:order_by=desc){users(order_by:{name:$d}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users(order_by:{name:desc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "literal null with ordered siblings",
			query:         `query{users(order_by:[{age:desc,name:null,id:asc},{name:desc_nulls_first}]){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users(order_by:[{age:desc,id:asc},{name:desc_nulls_first}]){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "whole object variable",
			query:         `query($o:users_order_by!){users(order_by:[$o]){id}}`,
			variables:     `{"o":{"name":null}}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "whole list variable",
			query:         `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			variables:     `{"o":[{"name":null},{"id":"desc"}]}`,
			wantQuery:     `query{users(order_by:{id:desc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "singleton list variable",
			query:         `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			variables:     `{"o":{"name":null,"id":"desc"}}`,
			wantQuery:     `query{users(order_by:{id:desc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "fragment variable",
			query:         `query($d:order_by){users{...Sorted}} fragment Sorted on users{posts(order_by:{title:$d,id:desc}){id}}`,
			variables:     `{"d":null}`,
			wantQuery:     `query{users{posts(order_by:{id:desc}){id}}}`,
			wantVariables: `{}`,
		},
		{
			name:          "relationship direction",
			query:         `query($d:order_by){posts(order_by:{author:{name:$d,id:desc},id:asc}){id}}`,
			variables:     `{"d":null}`,
			wantQuery:     `query{posts(order_by:{author:{id:desc},id:asc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "nested relationship object variable",
			query:         `query($o:posts_order_by!){posts(order_by:[$o]){id}}`,
			variables:     `{"o":{"author":{"name":null},"id":"asc"}}`,
			wantQuery:     `query{posts(order_by:{id:asc}){id}}`,
			wantVariables: `{}`,
		},
	}
	testVariableInputs(t, tests)
}
