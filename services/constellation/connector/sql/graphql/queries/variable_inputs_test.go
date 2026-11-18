package queries_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type variableInputCase struct {
	name          string
	query         string
	variables     string
	wantQuery     string
	wantVariables string
}

func TestFilterVariableInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "query_in_element",
			query:         `query($id:String!){users(where:{id:{_in:[$id]}}){id}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     `query($ids:[String!]!){users(where:{id:{_in:$ids}}){id}}`,
			wantVariables: `{"ids":["u1"]}`,
		},
		{
			name:          "query_in_whole_control",
			query:         `query($ids:[String!]!){users(where:{id:{_in:$ids}}){id}}`,
			variables:     `{"ids":["u1"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_in_element",
			query:         `mutation($id:String!){update_users(where:{id:{_in:[$id]}},_set:{name:"updated"}){affected_rows}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     `mutation($ids:[String!]!){update_users(where:{id:{_in:$ids}},_set:{name:"updated"}){affected_rows}}`,
			wantVariables: `{"ids":["u1"]}`,
		},
		{
			name:          "delete_in_element",
			query:         `mutation($id:String!){delete_users(where:{id:{_in:[$id]}}){affected_rows}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     `mutation($ids:[String!]!){delete_users(where:{id:{_in:$ids}}){affected_rows}}`,
			wantVariables: `{"ids":["u1"]}`,
		},
		{
			name:          "query_nin_element",
			query:         `query($id:String!){users(where:{id:{_nin:[$id]}}){id}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     `query($ids:[String!]!){users(where:{id:{_nin:$ids}}){id}}`,
			wantVariables: `{"ids":["u1"]}`,
		},
		{
			name:          "query_comparison_object",
			query:         `query($cmp:String_comparison_exp!){users(where:{id:$cmp}){id}}`,
			variables:     `{"cmp":{"_eq":"u1"}}`,
			wantQuery:     `query($where:users_bool_exp!){users(where:$where){id}}`,
			wantVariables: `{"where":{"id":{"_eq":"u1"}}}`,
		},
		{
			name:          "update_comparison_object",
			query:         `mutation($cmp:String_comparison_exp!){update_users(where:{id:$cmp},_set:{name:"updated"}){affected_rows}}`,
			variables:     `{"cmp":{"_eq":"u1"}}`,
			wantQuery:     `mutation($where:users_bool_exp!){update_users(where:$where,_set:{name:"updated"}){affected_rows}}`,
			wantVariables: `{"where":{"id":{"_eq":"u1"}}}`,
		},
		{
			name:          "delete_comparison_object",
			query:         `mutation($cmp:String_comparison_exp!){delete_users(where:{id:$cmp}){affected_rows}}`,
			variables:     `{"cmp":{"_eq":"u1"}}`,
			wantQuery:     `mutation($where:users_bool_exp!){delete_users(where:$where){affected_rows}}`,
			wantVariables: `{"where":{"id":{"_eq":"u1"}}}`,
		},
		{
			name:          "and_element_control",
			query:         `query($c:users_bool_exp!){users(where:{_and:[$c]}){id}}`,
			variables:     `{"c":{"id":{"_eq":"u1"}}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "or_element_control",
			query:         `query($c:users_bool_exp!){users(where:{_or:[$c]}){id}}`,
			variables:     `{"c":{"id":{"_eq":"u1"}}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "stream_cursor_element_control",
			query:         `subscription($c:users_stream_cursor_input!){users_stream(batch_size:10,cursor:[$c]){id}}`,
			variables:     `{"c":{"initial_value":{"id":"u1"},"ordering":"ASC"}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_in_whole_control",
			query:         `mutation($ids:[String!]!){update_users(where:{id:{_in:$ids}},_set:{name:"updated"}){affected_rows}}`,
			variables:     `{"ids":["u1"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "delete_in_whole_control",
			query:         `mutation($ids:[String!]!){delete_users(where:{id:{_in:$ids}}){affected_rows}}`,
			variables:     `{"ids":["u1"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "mixed_in_list",
			query:         `query($id:String!){users(where:{id:{_in:["u0",$id,"u2"]}}){id}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     `query($ids:[String!]!){users(where:{id:{_in:$ids}}){id}}`,
			wantVariables: `{"ids":["u0","u1","u2"]}`,
		},
	}
	testVariableInputs(t, tests)
}

func TestJSONBVariableInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "jsonb_delete_path_element",
			query:         `mutation($key:String!){update_users(where:{},_delete_at_path:{data:[$key]}){affected_rows}}`,
			variables:     `{"key":"profile"}`,
			wantQuery:     `mutation($path:[String!]!){update_users(where:{},_delete_at_path:{data:$path}){affected_rows}}`,
			wantVariables: `{"path":["profile"]}`,
		},
		{
			name:          "jsonb_delete_path_whole_control",
			query:         `mutation($path:[String!]!){update_users(where:{},_delete_at_path:{data:$path}){affected_rows}}`,
			variables:     `{"path":["profile"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "jsonb_has_keys_all_element",
			query:         `query($key:String!){users(where:{data:{_has_keys_all:[$key]}}){id}}`,
			variables:     `{"key":"profile"}`,
			wantQuery:     `query($keys:[String!]!){users(where:{data:{_has_keys_all:$keys}}){id}}`,
			wantVariables: `{"keys":["profile"]}`,
		},
		{
			name:          "jsonb_has_keys_any_element",
			query:         `query($key:String!){users(where:{data:{_has_keys_any:[$key]}}){id}}`,
			variables:     `{"key":"profile"}`,
			wantQuery:     `query($keys:[String!]!){users(where:{data:{_has_keys_any:$keys}}){id}}`,
			wantVariables: `{"keys":["profile"]}`,
		},
		{
			name:          "jsonb_has_keys_whole_control",
			query:         `query($keys:[String!]!){users(where:{data:{_has_keys_all:$keys}}){id}}`,
			variables:     `{"keys":["profile"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "jsonb_contains_nested_variable",
			query:         `query($name:String!){users(where:{data:{_contains:{name:$name}}}){id}}`,
			variables:     `{"name":"Alice"}`,
			wantQuery:     `query($obj:jsonb!){users(where:{data:{_contains:$obj}}){id}}`,
			wantVariables: `{"obj":{"name":"Alice"}}`,
		},
		{
			name:          "jsonb_contains_whole_control",
			query:         `query($obj:jsonb!){users(where:{data:{_contains:$obj}}){id}}`,
			variables:     `{"obj":{"name":"Alice"}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_jsonb_append_nested_control",
			query:         `mutation($name:String!){update_users(where:{},_append:{data:{name:$name}}){affected_rows}}`,
			variables:     `{"name":"Alice"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "mixed_jsonb_keys",
			query:         `query($key:String!){users(where:{data:{_has_keys_all:["name",$key]}}){id}}`,
			variables:     `{"key":"profile"}`,
			wantQuery:     `query($keys:[String!]!){users(where:{data:{_has_keys_all:$keys}}){id}}`,
			wantVariables: `{"keys":["name","profile"]}`,
		},
		{
			name:          "mixed_jsonb_path",
			query:         `mutation($key:String!){update_users(where:{},_delete_at_path:{data:["profile",$key,"0"]}){affected_rows}}`,
			variables:     `{"key":"contacts"}`,
			wantQuery:     `mutation($path:[String!]!){update_users(where:{},_delete_at_path:{data:$path}){affected_rows}}`,
			wantVariables: `{"path":["profile","contacts","0"]}`,
		},
		{
			name:          "nested_jsonb_lists",
			query:         `query($name:String!,$age:Int!){users(where:{data:{_contains:{profile:{names:["Bob",$name],age:$age,active:true,missing:null}}}}){id}}`,
			variables:     `{"name":"Alice","age":42}`,
			wantQuery:     `query($obj:jsonb!){users(where:{data:{_contains:$obj}}){id}}`,
			wantVariables: `{"obj":{"profile":{"names":["Bob","Alice"],"age":42,"active":true,"missing":null}}}`,
		},
		{
			name:          "jsonb_contained_in",
			query:         `query($name:String!){users(where:{data:{_contained_in:{profile:{name:$name}}}}){id}}`,
			variables:     `{"name":"Alice"}`,
			wantQuery:     `query($obj:jsonb!){users(where:{data:{_contained_in:$obj}}){id}}`,
			wantVariables: `{"obj":{"profile":{"name":"Alice"}}}`,
		},
	}
	testVariableInputs(t, tests)
}

func TestOrderByVariableInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "order_by_element",
			query:         `query($o:users_order_by!){users(order_by:[$o]){id}}`,
			variables:     `{"o":{"name":"asc"}}`,
			wantQuery:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			wantVariables: `{"o":[{"name":"asc"}]}`,
		},
		{
			name:          "order_by_direction",
			query:         `query($d:order_by!){users(order_by:{name:$d}){id}}`,
			variables:     `{"d":"asc"}`,
			wantQuery:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			wantVariables: `{"o":[{"name":"asc"}]}`,
		},
		{
			name:          "order_by_relationship_object",
			query:         `query($o:users_order_by!){posts(order_by:{author:$o}){id}}`,
			variables:     `{"o":{"name":"asc"}}`,
			wantQuery:     `query($o:[posts_order_by!]!){posts(order_by:$o){id}}`,
			wantVariables: `{"o":[{"author":{"name":"asc"}}]}`,
		},
		{
			name:          "order_by_aggregate_direction",
			query:         `query($d:order_by!){users(order_by:{posts_aggregate:{count:$d}}){id}}`,
			variables:     `{"d":"asc"}`,
			wantQuery:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			wantVariables: `{"o":[{"posts_aggregate":{"count":"asc"}}]}`,
		},
		{
			name:          "order_by_whole_control",
			query:         `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			variables:     `{"o":[{"name":"asc"}]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "distinct_on_element",
			query:         `query($c:users_select_column!){users(distinct_on:[$c]){id}}`,
			variables:     `{"c":"id"}`,
			wantQuery:     `query($cols:[users_select_column!]!){users(distinct_on:$cols){id}}`,
			wantVariables: `{"cols":["id"]}`,
		},
		{
			name:          "distinct_on_whole_control",
			query:         `query($cols:[users_select_column!]!){users(distinct_on:$cols){id}}`,
			variables:     `{"cols":["id"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "mixed_order_by",
			query:         `query($o:users_order_by!,$d:order_by!){users(order_by:[{id:asc},$o,{age:$d}]){id}}`,
			variables:     `{"o":{"name":"desc"},"d":"desc_nulls_last"}`,
			wantQuery:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			wantVariables: `{"o":[{"id":"asc"},{"name":"desc"},{"age":"desc_nulls_last"}]}`,
		},
		{
			name:          "relationship_direction",
			query:         `query($d:order_by!){posts(order_by:{author:{name:$d}}){id}}`,
			variables:     `{"d":"desc"}`,
			wantQuery:     `query($o:[posts_order_by!]!){posts(order_by:$o){id}}`,
			wantVariables: `{"o":[{"author":{"name":"desc"}}]}`,
		},
		{
			name:          "aggregate_object",
			query:         `query($o:posts_aggregate_order_by!){users(order_by:{posts_aggregate:$o}){id}}`,
			variables:     `{"o":{"count":"desc"}}`,
			wantQuery:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			wantVariables: `{"o":[{"posts_aggregate":{"count":"desc"}}]}`,
		},
		{
			name:          "aggregate_column_direction",
			query:         `query($d:order_by!){posts(order_by:{author:{posts_aggregate:{count:$d}}}){id}}`,
			variables:     `{"d":"asc"}`,
			wantQuery:     `query($o:[posts_order_by!]!){posts(order_by:$o){id}}`,
			wantVariables: `{"o":[{"author":{"posts_aggregate":{"count":"asc"}}}]}`,
		},
		{
			name:          "distinct_mixed_columns",
			query:         `query($c:users_select_column!){users(distinct_on:[id,$c],order_by:[{id:asc},{name:asc}]){id}}`,
			variables:     `{"c":"name"}`,
			wantQuery:     `query($cols:[users_select_column!]!){users(distinct_on:$cols,order_by:[{id:asc},{name:asc}]){id}}`,
			wantVariables: `{"cols":["id","name"]}`,
		},
	}
	testVariableInputs(t, tests)
}

func TestVariableInputControls(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "delete_scalar_control",
			query:         `mutation($id:String!){delete_users(where:{id:{_eq:$id}}){affected_rows}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "delete_where_control",
			query:         `mutation($where:users_bool_exp!){delete_users(where:$where){affected_rows}}`,
			variables:     `{"where":{"id":{"_eq":"u1"}}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_set_object_control",
			query:         `mutation($set:users_set_input!){update_users(where:{},_set:$set){affected_rows}}`,
			variables:     `{"set":{"name":"updated"}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_set_scalar_control",
			query:         `mutation($name:String!){update_users(where:{},_set:{name:$name}){affected_rows}}`,
			variables:     `{"name":"updated"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_inc_control",
			query:         `mutation($age:Int!){update_users(where:{},_inc:{age:$age}){affected_rows}}`,
			variables:     `{"age":1}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_batch_element_control",
			query:         `mutation($u:users_updates!){update_users_many(updates:[$u]){affected_rows}}`,
			variables:     `{"u":{"_set":{"name":"updated"},"where":{"id":{"_eq":"u1"}}}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "update_by_pk_control",
			query:         `mutation($pk:users_pk_columns_input!,$name:String!){update_users_by_pk(pk_columns:$pk,_set:{name:$name}){id}}`,
			variables:     `{"name":"updated","pk":{"id":"u1"}}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "delete_by_pk_control",
			query:         `mutation($id:String!){delete_users_by_pk(id:$id){id}}`,
			variables:     `{"id":"u1"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "aggregate_count_column_element",
			query:         `query($c:users_select_column!){users_aggregate{aggregate{count(columns:[$c])}}}`,
			variables:     `{"c":"id"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "aggregate_count_columns_whole_control",
			query:         `query($cols:[users_select_column!]!){users_aggregate{aggregate{count(columns:$cols)}}}`,
			variables:     `{"cols":["id"]}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "upsert_update_column_element_control",
			query:         `mutation($c:users_update_column!){insert_users_one(object:{id:"u1"},on_conflict:{constraint:users_pkey,update_columns:[$c]}){id}}`,
			variables:     `{"c":"name"}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "query_limit_offset_control",
			query:         `query($limit:Int!,$offset:Int!){users(limit:$limit,offset:$offset){id}}`,
			variables:     `{"limit":2,"offset":1}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "query_no_args_control",
			query:         `query{users{id}}`,
			variables:     `{}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
	}
	testVariableInputs(t, tests)
}

func TestOptionalVariableInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:          "omitted offset",
			query:         `query($offset:Int){users(offset:$offset){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "null offset",
			query:         `query($offset:Int){users(offset:$offset){id}}`,
			variables:     `{"offset":null}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted sort direction",
			query:         `query($d:order_by){users(order_by:{name:$d}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted order_by",
			query:         `query($o:[users_order_by!]){users(order_by:$o){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted distinct_on",
			query:         `query($c:[users_select_column!]){users(distinct_on:$c){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted nested comparison",
			query:         `query($id:String){users(where:{id:{_eq:$id}}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted update column",
			query:         `mutation($name:String){update_users(where:{},_set:{name:$name},_inc:{age:1}){affected_rows}}`,
			variables:     `{}`,
			wantQuery:     `mutation{update_users(where:{},_inc:{age:1}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "explicit null update column",
			query:         `mutation($name:String){update_users(where:{},_set:{name:$name},_inc:{age:1}){affected_rows}}`,
			variables:     `{"name":null}`,
			wantQuery:     `mutation{update_users(where:{},_set:{name:null},_inc:{age:1}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "explicit null update object",
			query:         `mutation($set:users_set_input){update_users(where:{},_set:$set,_inc:{age:1}){affected_rows}}`,
			variables:     `{"set":null}`,
			wantQuery:     `mutation{update_users(where:{},_inc:{age:1}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted insert column",
			query:         `mutation($name:String){insert_users_one(object:{id:"u1",name:$name}){id}}`,
			variables:     `{}`,
			wantQuery:     `mutation{insert_users_one(object:{id:"u1"}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "explicit null insert column",
			query:         `mutation($name:String){insert_users_one(object:{id:"u1",name:$name}){id}}`,
			variables:     `{"name":null}`,
			wantQuery:     `mutation{insert_users_one(object:{id:"u1",name:null}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted upsert input uses field default",
			query:         `mutation($cols:[users_update_column!]){insert_users_one(object:{id:"u1"},on_conflict:{constraint:users_pkey,update_columns:$cols}){id}}`,
			variables:     `{}`,
			wantQuery:     `mutation{insert_users_one(object:{id:"u1"},on_conflict:{constraint:users_pkey,update_columns:[]}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted JSONB property",
			query:         `query($name:String){users(where:{data:{_contains:{name:$name,age:1}}}){id}}`,
			variables:     `{}`,
			wantQuery:     `query($obj:jsonb!){users(where:{data:{_contains:$obj}}){id}}`,
			wantVariables: `{"obj":{"age":1}}`,
		},
		{
			name:          "omitted JSONB list element keeps index",
			query:         `query($name:String){users(where:{data:{_contains:{names:["Bob",$name]}}}){id}}`,
			variables:     `{}`,
			wantQuery:     `query($obj:jsonb!){users(where:{data:{_contains:$obj}}){id}}`,
			wantVariables: `{"obj":{"names":["Bob",null]}}`,
		},
		{
			name:          "mutation selector default",
			query:         `mutation($where:users_bool_exp={id:{_eq:"u1"}}){delete_users(where:$where){affected_rows}}`,
			variables:     `{}`,
			wantQuery:     `mutation{delete_users(where:{id:{_eq:"u1"}}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "nested fragment optional argument",
			query:         `query($limit:Int){users{...F}} fragment F on users{posts(limit:$limit){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{posts{id}}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted_limit_variable",
			query:         `query($limit:Int){users(limit:$limit){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted_where_variable",
			query:         `query($where:users_bool_exp){users(where:$where){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted_update_set_variable",
			query:         `mutation($set:users_set_input){update_users(where:{},_set:$set,_inc:{age:1}){affected_rows}}`,
			variables:     `{}`,
			wantQuery:     `mutation{update_users(where:{},_inc:{age:1}){affected_rows}}`,
			wantVariables: `{}`,
		},
		{
			name:          "omitted_limit_default_control",
			query:         `query($limit:Int=2){users(limit:$limit){id}}`,
			variables:     `{}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
		{
			name:          "null_limit_control",
			query:         `query($limit:Int){users(limit:$limit){id}}`,
			variables:     `{"limit":null}`,
			wantQuery:     `query{users{id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "null_where_control",
			query:         `query($where:users_bool_exp){users(where:$where){id}}`,
			variables:     `{"where":null}`,
			wantQuery:     ``,
			wantVariables: ``,
		},
	}
	testVariableInputs(t, tests)
}

func TestVariableInputsRejectInvalidValues(t *testing.T) {
	t.Parallel()
	roots, schema := variableInputRoots(t)

	tests := []struct {
		name          string
		query         string
		variables     string
		coercionError bool
		wantErr       error
	}{
		{
			name:          "missing required delete selector",
			query:         `mutation($where:users_bool_exp!){delete_users(where:$where){affected_rows}}`,
			variables:     `{}`,
			coercionError: true,
			wantErr:       values.ErrVariableNotFound,
		},
		{
			name:          "missing required update selector",
			query:         `mutation($where:users_bool_exp!){update_users(where:$where,_set:{name:"updated"}){affected_rows}}`,
			variables:     `{}`,
			coercionError: true,
			wantErr:       values.ErrVariableNotFound,
		},
		{
			name:          "missing required list element",
			query:         `query($id:String!){users(where:{id:{_in:[$id]}}){id}}`,
			variables:     `{}`,
			coercionError: true,
			wantErr:       values.ErrVariableNotFound,
		},
		{
			name:          "missing required comparison",
			query:         `query($cmp:String_comparison_exp!){users(where:{id:$cmp}){id}}`,
			variables:     `{}`,
			coercionError: true,
			wantErr:       values.ErrVariableNotFound,
		},
		{
			name:          "missing required sort object",
			query:         `query($sort:users_order_by!){users(order_by:[$sort]){id}}`,
			variables:     `{}`,
			coercionError: true,
			wantErr:       values.ErrVariableNotFound,
		},
		{
			name:          "invalid sort direction",
			query:         `query($direction:order_by!){users(order_by:{name:$direction}){id}}`,
			variables:     `{"direction":"asc; DROP TABLE users"}`,
			coercionError: true,
			wantErr:       arguments.ErrInvalidArgument,
		},
		{
			name:          "invalid distinct column",
			query:         `query($column:users_select_column!){users(distinct_on:[$column]){id}}`,
			variables:     `{"column":"id); DROP TABLE users"}`,
			coercionError: true,
			wantErr:       arguments.ErrInvalidArgument,
		},
		{
			name:      "distinct order prefix still required",
			query:     `query($column:users_select_column!){users(distinct_on:[$column],order_by:{id:asc}){id}}`,
			variables: `{"column":"name"}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "null nullable delete selector with default",
			query:     `mutation($where:users_bool_exp={}){delete_users(where:$where){affected_rows}}`,
			variables: `{"where":null}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "null nullable list element with default",
			query:     `query($id:String="u1"){users(where:{id:{_in:[$id]}}){id}}`,
			variables: `{"id":null}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "null nullable primary key with default",
			query:     `mutation($pk:users_pk_columns_input={id:"u1"}){update_users_by_pk(pk_columns:$pk,_set:{name:"updated"}){id}}`,
			variables: `{"pk":null}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "null nullable insert object with default",
			query:     `mutation($object:users_insert_input={id:"u1"}){insert_users_one(object:$object){id}}`,
			variables: `{"object":null}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "null nullable stream batch with default",
			query:     `subscription($size:Int=1){users_stream(batch_size:$size,cursor:{initial_value:{id:"u1"}}){id}}`,
			variables: `{"size":null}`,
			wantErr:   arguments.ErrInvalidArgument,
		},
		{
			name:      "omitted sole update operator is not a mutation",
			query:     `mutation($set:users_set_input){update_users(where:{},_set:$set){affected_rows}}`,
			variables: `{}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			document, errs := gqlparser.LoadQueryWithRules(
				schema,
				tt.query,
				rules.NewDefaultRules(),
			)
			if len(errs) != 0 {
				t.Fatalf("LoadQueryWithRules: %v", errs)
			}

			var variables map[string]any
			if err := json.Unmarshal([]byte(tt.variables), &variables); err != nil {
				t.Fatalf("Unmarshal: %v", err)
			}

			coerced, err := validator.VariableValues(schema, document.Operations[0], variables)
			if (err != nil) != tt.coercionError {
				t.Fatalf("VariableValues: %v, want error %v", err, tt.coercionError)
			}

			if !tt.coercionError {
				variables = coerced
			}

			operations, err := roots.BuildQuery(
				document.Operations[0],
				document.Fragments,
				variables,
				"admin",
				nil,
			)
			if err == nil || len(operations) != 0 {
				t.Fatalf(
					"expected no SQL operations and an input error, got %v / %v",
					operations,
					err,
				)
			}

			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("expected error identity %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestVariableInputsCachedDocument(t *testing.T) {
	t.Parallel()
	roots, schema := variableInputRoots(t)

	document, errs := gqlparser.LoadQueryWithRules(
		schema,
		`query Cached($id:String,$direction:order_by,$limit:Int){users(where:{id:{_eq:$id}},order_by:{name:$direction},limit:$limit){id}}`,
		rules.NewDefaultRules(),
	)
	if len(errs) != 0 {
		t.Fatalf("LoadQueryWithRules: %v", errs)
	}

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(document)
	t.Cleanup(func() {
		var after bytes.Buffer
		formatter.NewFormatter(&after).FormatQueryDocument(document)

		if before.String() != after.String() {
			t.Error("concurrent requests mutated the cached query")
		}
	})

	tests := []struct {
		name          string
		variables     string
		wantQuery     string
		wantVariables string
	}{
		{
			name:          "first",
			variables:     `{"id":"u1","direction":"asc","limit":2}`,
			wantQuery:     `query($where:users_bool_exp!,$sort:[users_order_by!]!,$limit:Int!){users(where:$where,order_by:$sort,limit:$limit){id}}`,
			wantVariables: `{"where":{"id":{"_eq":"u1"}},"sort":[{"name":"asc"}],"limit":2}`,
		},
		{
			name:          "second",
			variables:     `{"id":"u2","direction":"desc","limit":1}`,
			wantQuery:     `query($where:users_bool_exp!,$sort:[users_order_by!]!,$limit:Int!){users(where:$where,order_by:$sort,limit:$limit){id}}`,
			wantVariables: `{"where":{"id":{"_eq":"u2"}},"sort":[{"name":"desc"}],"limit":1}`,
		},
		{name: "omitted", variables: `{}`, wantQuery: `query{users{id}}`, wantVariables: `{}`},
		{
			name:          "null limit",
			variables:     `{"id":"u3","direction":"asc","limit":null}`,
			wantQuery:     `query($where:users_bool_exp!,$sort:[users_order_by!]!){users(where:$where,order_by:$sort){id}}`,
			wantVariables: `{"where":{"id":{"_eq":"u3"}},"sort":[{"name":"asc"}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var provided map[string]any
			if err := json.Unmarshal([]byte(tt.variables), &provided); err != nil {
				t.Fatalf("Unmarshal: %v", err)
			}

			variables, err := validator.VariableValues(schema, document.Operations[0], provided)
			if err != nil {
				t.Fatalf("VariableValues: %v", err)
			}

			got, err := roots.BuildQuery(
				document.Operations[0],
				document.Fragments,
				variables,
				"admin",
				nil,
			)
			if err != nil {
				t.Fatalf("BuildQuery: %v", err)
			}

			want := buildVariableInput(t, roots, schema, tt.wantQuery, tt.wantVariables)
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("cached request (-want +got):\n%s", diff)
			}
		})
	}
}

func testVariableInputs(t *testing.T, tests []variableInputCase) {
	t.Helper()

	roots, schema := variableInputRoots(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := buildVariableInput(t, roots, schema, tt.query, tt.variables)
			if len(got) == 0 {
				t.Fatal("expected a SQL operation")
			}

			if tt.wantQuery != "" {
				want := buildVariableInput(t, roots, schema, tt.wantQuery, tt.wantVariables)
				normalize(want)
				normalize(got)

				if diff := cmp.Diff(want, got); diff != "" {
					t.Errorf("SQL operations (-whole argument +nested input):\n%s", diff)
				}
			}
		})
	}
}

func buildVariableInput(
	t *testing.T,
	roots queries.Roots,
	schema *ast.Schema,
	query, provided string,
) []core.SQLOperation {
	t.Helper()

	document, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatalf("LoadQueryWithRules: %v", errs)
	}

	var variables map[string]any
	if err := json.Unmarshal([]byte(provided), &variables); err != nil {
		t.Fatalf("Unmarshal variables: %v", err)
	}

	coerced, err := validator.VariableValues(schema, document.Operations[0], variables)
	if err != nil {
		t.Fatalf("VariableValues: %v", err)
	}

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(document)

	originalVariables, err := json.Marshal(coerced)
	if err != nil {
		t.Fatalf("Marshal variables: %v", err)
	}

	operations, err := roots.BuildQuery(
		document.Operations[0],
		document.Fragments,
		coerced,
		"admin",
		nil,
	)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	var after bytes.Buffer
	formatter.NewFormatter(&after).FormatQueryDocument(document)

	if before.String() != after.String() {
		t.Error("BuildQuery mutated the cached query AST")
	}

	remainingVariables, err := json.Marshal(coerced)
	if err != nil {
		t.Fatalf("Marshal remaining variables: %v", err)
	}

	if !bytes.Equal(originalVariables, remainingVariables) {
		t.Error("BuildQuery mutated the coerced variables")
	}

	return operations
}

func variableInputRoots(t *testing.T) (queries.Roots, *ast.Schema) {
	t.Helper()

	objects := introspection.NewObjects()

	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"users": {
			Schema:      "public",
			Name:        "users",
			PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{
				{
					Name: "id",
					Type: "text",
				},
				{Name: "name", Type: "text"},
				{
					Name:           "age",
					Type:           "int4",
					SupportsInc:    true,
					SupportsAgg:    true,
					SupportsMinMax: true,
				},
				{Name: "data", Type: "jsonb"},
			},
		},
		"posts": {
			Schema:      "public",
			Name:        "posts",
			PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{
				{
					Name: "id",
					Type: "text",
				},
				{Name: "author_id", Type: "text"},
				{Name: "title", Type: "text"},
			},
		},
	}}
	for name, table := range objects.Schemas["public"].Tables {
		table.IsInsertable = true
		table.IsUpdatable = true
		table.PrimaryKeyConstraintName = name + "_pkey"
	}

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "posts",
						Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Schema: "public",
									Name:   "posts",
								},
								ColumnMapping: map[string]string{"id": "author_id"},
							},
						},
					},
				},
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "posts"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "author",
						Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Schema: "public",
									Name:   "users",
								},
								ColumnMapping: map[string]string{"author_id": "id"},
							},
						},
					},
				},
			},
		},
	}
	dial := dialect.NewPostgresDialect()
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, dial)

	graph, err := graphqlschema.GenerateForRole(objects, "admin", md, caps)
	if err != nil {
		t.Fatalf("GenerateForRole: %v", err)
	}

	_, schema, err := schemamerge.BuildValidatedSchema(graph, "admin")
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dial, caps)
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	return roots, schema
}
