package sql_test

import (
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func verifyComputedPermissionOperatorSessionOperands(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name            string
		prepare         func(*testing.T, *metadata.DatabaseMetadata, *pgx.Conn)
		field, operator string
		values          []struct {
			operand string
			want    []int
		}
	}{
		{"similar", nil, "item_label", "$similar", []struct {
			operand string
			want    []int
		}{
			{"f%", []int{1}}, {"s%", []int{2}}, {"%' OR 1=1 --", []int{}},
		}},
		{"ltree matches", installPermissionPath, "item_path", "$matches", []struct {
			operand string
			want    []int
		}{
			{"*.first", []int{1}}, {"*.second", []int{2}},
		}},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if tc.prepare != nil {
				tc.prepare(t, md, db)
			}

			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				computedGuard(
					map[string]any{tc.field: map[string]any{tc.operator: "X-Hasura-Pattern"}},
				),
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if got := inc.Snapshot(); len(got) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", got)
			}

			for _, sample := range tc.values {
				got := permissionIDs(
					t,
					conn,
					"phase9_guard",
					`query { cf_select_items(order_by:{id:asc}) { id } }`,
					"cf_select_items",
					map[string]any{"x-hasura-pattern": sample.operand},
				)
				if !reflect.DeepEqual(got, sample.want) {
					t.Fatalf(
						"session pattern %q: rows %v, want %v",
						sample.operand,
						got,
						sample.want,
					)
				}
			}
		})
	}
}
