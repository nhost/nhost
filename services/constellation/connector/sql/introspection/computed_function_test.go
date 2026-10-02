package introspection_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

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
