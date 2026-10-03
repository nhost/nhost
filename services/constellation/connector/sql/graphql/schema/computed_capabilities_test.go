package schema_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
)

func TestComputedCapabilitiesSelectionEnabledOnlyOnPostgres(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name string
		kind schema.DBKind
		dial dialect.Dialect
	}{
		{name: "postgres", kind: schema.KindPostgres, dial: dialect.NewPostgresDialect()},
		{name: "sqlite", kind: schema.KindSQLite, dial: dialect.NewSQLiteDialect()},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			caps := schema.NewCapabilities(tt.kind, tt.dial)
			if caps.SupportsComputedFields != (tt.kind == schema.KindPostgres) {
				t.Fatalf("wrong backend computed capability: %+v", caps)
			}

			if caps.SupportsComputedScalarSelection != (tt.kind == schema.KindPostgres) ||
				caps.SupportsComputedScalarInput != (tt.kind == schema.KindPostgres) ||
				caps.SupportsComputedTableSelection ||
				caps.SupportsComputedTableInput {
				t.Fatalf("computed capability gates: %+v", caps)
			}
		})
	}
}
