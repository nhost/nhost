package sql

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestReconcileMetadata_SelectRootAllowlistsPreserveComputedGrantIndex(t *testing.T) {
	t.Parallel()

	objects := makeObjects()
	input := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres",
		Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "users"},
			SelectPermissions: []metadata.SelectPermission{
				{
					Role: "grant",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, ComputedFields: []string{"stale"},
						QueryRootFields: new([]string{"select", "select_aggregate"}),
					},
				},
				{
					Role: "filter",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"},
						Filter:  map[string]any{"stale": map[string]any{"_eq": "value"}},
					},
				},
				{
					Role:       "healthy",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			},
		}},
	}
	inc := metadata.NewInconsistencies()
	effective := reconcileMetadata(t.Context(), nil, inc, input, objects)
	dial := dialect.NewPostgresDialect()

	caps := schema.NewCapabilities(schema.KindPostgres, dial)
	if _, _, err := queries.BuildRoots(objects, effective, dial, caps); err != nil {
		t.Errorf("reconciled source must still build its roots: %v", err)
	}

	if diff := cmp.Diff(
		input.Tables[0].SelectPermissions[2:],
		effective.Tables[0].SelectPermissions,
	); diff != "" {
		t.Errorf("surviving permissions (-want +got):\n%s", diff)
	}

	records := inc.Snapshot()

	names := make([]string, 0, len(records))
	for _, record := range records {
		if record.Kind != "select_permission" || !strings.Contains(record.Reason, `"stale"`) {
			t.Errorf(
				"want a select permission inconsistency about the stale computed field: %+v",
				record,
			)
		}

		names = append(names, record.Name)
	}

	slices.Sort(names)

	if diff := cmp.Diff([]string{"public.users.filter", "public.users.grant"}, names); diff != "" {
		t.Errorf("inconsistent permissions (-want +got):\n%s", diff)
	}
}

func TestReconcileMetadata_SelectRootAllowlists(t *testing.T) {
	t.Parallel()

	byPK := new([]string{"select", "select_by_pk"})
	aggregate := new([]string{"select", "select_aggregate"})
	compositePK := []string{"id", "name"}

	tests := []struct {
		name           string
		role           string
		primaryKeys    []string
		columns        []string
		query          *[]string
		subscription   *[]string
		allowAggregate bool
		wantColumns    []string
		wantReason     string
	}{
		{
			"missing PK column",
			"reader",
			compositePK,
			[]string{"id"},
			byPK,
			nil,
			false,
			nil,
			`cannot select primary key column "name"`,
		},
		{
			"no PK",
			"reader",
			nil,
			[]string{"*"},
			nil,
			byPK,
			false,
			nil,
			"the table has no primary key",
		},
		{
			"query aggregate disabled",
			"reader",
			compositePK,
			[]string{"id"},
			aggregate,
			nil,
			false,
			nil,
			`requires "allow_aggregations" to be true`,
		},
		{
			"subscription aggregate disabled",
			"reader",
			compositePK,
			[]string{"id"},
			nil,
			aggregate,
			false,
			nil,
			`requires "allow_aggregations" to be true`,
		},
		{
			"wildcard columns",
			"reader",
			compositePK,
			[]string{"*"},
			byPK,
			byPK,
			false,
			[]string{"id", "name"},
			"",
		},
		{
			"all PK columns and aggregates",
			"reader",
			compositePK,
			compositePK,
			byPK,
			aggregate,
			true,
			compositePK,
			"",
		},
		{"implicit roots", "reader", nil, []string{"id"}, nil, nil, false, []string{"id"}, ""},
		{
			"empty roots",
			"reader",
			nil,
			[]string{"id"},
			new([]string{}),
			new([]string{}),
			false,
			[]string{"id"},
			"",
		},
		{
			"admin bypass",
			metadata.RoleAdmin,
			nil,
			[]string{"id"},
			byPK,
			aggregate,
			false,
			[]string{"id"},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			objects := makeObjects(func(objects *introspection.Objects) {
				objects.Schemas["public"].Tables["users"].PrimaryKeys = tt.primaryKeys
			})
			input := &metadata.DatabaseMetadata{
				Name: "default", Kind: "postgres",
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: "public", Name: "users"},
					SelectPermissions: []metadata.SelectPermission{{
						Role: tt.role,
						Permission: metadata.SelectPermissionConfig{
							Columns: tt.columns, AllowAggregations: tt.allowAggregate,
							QueryRootFields: tt.query, SubscriptionRootFields: tt.subscription,
						},
					}, {
						Role:       "other",
						Permission: metadata.SelectPermissionConfig{Columns: []string{"name"}},
					}},
				}},
			}
			before := slices.Clone(input.Tables[0].SelectPermissions)
			inc := metadata.NewInconsistencies()

			got := reconcileMetadata(t.Context(), nil, inc, input, objects)
			permissions := got.Tables[0].SelectPermissions

			want := slices.Clone(before)

			want[0].Permission.Columns = tt.wantColumns
			if tt.wantReason != "" {
				want = want[1:]
			}

			if diff := cmp.Diff(want, permissions); diff != "" {
				t.Errorf("permission diff (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(before, input.Tables[0].SelectPermissions); diff != "" {
				t.Errorf("reconciliation mutated input (-want +got):\n%s", diff)
			}

			records := inc.Snapshot()
			if tt.wantReason == "" {
				if len(records) != 0 {
					t.Errorf("unexpected inconsistencies: %+v", records)
				}

				return
			}

			if len(records) != 1 || records[0].Kind != "select_permission" ||
				records[0].Source != "default" || records[0].Name != "public.users."+tt.role ||
				!strings.Contains(records[0].Reason, tt.wantReason) {
				t.Errorf(
					"inconsistencies = %+v; want select_permission for %s containing %q",
					records,
					tt.role,
					tt.wantReason,
				)
			}
		})
	}
}
