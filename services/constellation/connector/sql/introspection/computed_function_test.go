package introspection_test

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

func TestComputedGraphQLArgumentNames(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name    string
		row     int
		session string
		args    []introspection.ComputedFunctionArgument
		want    []string
	}{
		{name: "row then unnamed", row: 0, args: []introspection.ComputedFunctionArgument{
			{Mode: "i"}, {Mode: "i"},
		}, want: []string{"", "arg_1"}},
		{name: "named and session do not advance counter", row: 0, session: "session", args: []introspection.ComputedFunctionArgument{
			{Mode: "i"}, {Mode: "i", Name: "scale"}, {Mode: "i", Name: "session"}, {Mode: "i"}, {Mode: "i"},
		}, want: []string{"", "scale", "", "arg_1", "arg_2"}},
		{name: "row after unnamed", row: 1, args: []introspection.ComputedFunctionArgument{
			{Mode: "i"}, {Mode: "i", Name: "item"}, {Mode: "i"},
		}, want: []string{"arg_1", "", "arg_2"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			fn := introspection.ComputedFunction{RowArgument: tt.row, Arguments: tt.args}
			if got := fn.GraphQLArgumentNames(tt.session); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("argument names = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestComputedFunctionLookupTableIdentity(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	if _, found := objects.GetComputedFunction("a", "b.c", "label"); found {
		t.Fatal("empty objects contained a computed function")
	}

	objects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
		{Schema: "a", Name: "b.c"}: {"label": {Function: nil, Reason: "missing"}},
		{Schema: "a.b", Name: "c"}: {"label": {Function: nil, Reason: "overloaded"}},
	}

	tests := []struct {
		schema string
		table  string
		field  string
		reason string
		found  bool
	}{
		{schema: "a", table: "b.c", field: "label", reason: "missing", found: true},
		{schema: "a.b", table: "c", field: "label", reason: "overloaded", found: true},
		{schema: "a", table: "b.c", field: "other", reason: "", found: false},
	}
	for _, tt := range tests {
		t.Run(tt.schema+"/"+tt.table+"/"+tt.field, func(t *testing.T) {
			t.Parallel()

			got, found := objects.GetComputedFunction(tt.schema, tt.table, tt.field)
			if found != tt.found || got.Reason != tt.reason {
				t.Errorf(
					"lookup = %+v, %v; want reason %q, found %v",
					got,
					found,
					tt.reason,
					tt.found,
				)
			}
		})
	}
}
