package queries_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// buildObjectsWithUsersTable builds a minimal *introspection.Objects with a
// single public.users table that has one primary-key column "id".
func buildObjectsWithUsersTable() *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}

	return objs
}

// tableMetaFor returns a minimal TableMetadata for a tracked table in the
// "public" schema.
func tableMetaFor(name string) metadata.TableMetadata {
	return metadata.TableMetadata{Table: metadata.TableSource{Schema: "public", Name: name}}
}

func TestBuildRoots_TableMissingFromIntrospection(t *testing.T) {
	t.Parallel()

	// Objects contain users; metadata tracks orders. Initialize should fail.
	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("orders")}}

	_, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err == nil {
		t.Fatal("expected error for table missing from introspection, got nil")
	}

	if !strings.Contains(err.Error(), "public.orders") {
		t.Errorf("error should mention schema.table, got: %v", err)
	}
}

func TestBuildRoots_FunctionMissingFromIntrospectionIsSkipped(t *testing.T) {
	t.Parallel()

	// Track a function that doesn't exist in introspection. errFunctionNotFound
	// should cause it to be skipped silently.
	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{tableMetaFor("users")},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "missing_fn"}},
		},
	}

	roots, ops, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if roots.Operations == nil || ops == nil {
		t.Fatalf("expected non-nil Roots and Ops, got roots=%v ops=%v", roots, ops)
	}

	// users root field should still be registered; missing_fn should not exist anywhere.
	for _, m := range roots.Operations {
		for fieldName := range m {
			if fieldName == "missing_fn" {
				t.Errorf("expected missing_fn to be skipped, but found it in roots")
			}
		}
	}
}

// TestBuildRoots_FunctionReturningUnknownTableIsSkipped covers the
// defense-in-depth path: reconcile is expected to drop a function whose
// return-type table is not tracked (errBaseTableForFunctionNotFound is no
// longer fatal), but if one slips into BuildRoots the function is silently
// skipped so the rest of the source keeps serving.
func TestBuildRoots_FunctionReturningUnknownTableIsSkipped(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}
	objects.Functions["public.search_orders"] = &introspection.Function{
		Arguments: nil,
		ReturnType: introspection.FunctionReturnType{
			Type:        "",
			IsSetOf:     true,
			TableSchema: "public",
			TableName:   "orders", // not tracked in metadata
		},
		Volatility: introspection.VolatilityStable,
	}
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{tableMetaFor("users")},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "search_orders"}},
		},
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// users root field should still be registered; search_orders should not exist.
	for _, m := range roots.Operations {
		for fieldName := range m {
			if fieldName == "search_orders" {
				t.Errorf("expected search_orders to be skipped, but found it in roots")
			}
		}
	}

	// Positive assertion: the surviving users table's roots must still be
	// registered. Catches a regression where the function-skip path drops the
	// rest of the source instead of just the offending function.
	queryRoots, ok := roots.Operations[queries.OperationQuery]
	if !ok {
		t.Fatal("expected query roots to be present")
	}

	if _, ok := queryRoots["users"]; !ok {
		t.Errorf("expected 'users' collection root to survive, got: %v", keys(queryRoots))
	}

	if _, ok := queryRoots["users_by_pk"]; !ok {
		t.Errorf("expected 'users_by_pk' root to survive, got: %v", keys(queryRoots))
	}
}

func TestBuildRoots_HappyPathRegistersTableRoots(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, ops, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ops == nil {
		t.Fatal("expected non-nil Ops")
	}

	queryRoots, ok := roots.Operations[queries.OperationQuery]
	if !ok {
		t.Fatal("expected query roots to be present")
	}

	if _, ok := queryRoots["users"]; !ok {
		t.Errorf("expected 'users' collection root to be registered, got: %v", keys(queryRoots))
	}

	if _, ok := queryRoots["users_by_pk"]; !ok {
		t.Errorf("expected 'users_by_pk' root to be registered, got: %v", keys(queryRoots))
	}
}

// TestBuildRoots_BrokenRelationshipIsSwallowed exercises the queries-layer
// defense-in-depth contract introduced alongside reconcile's per-relationship
// drop pass: when a relationship's FK shape cannot be paired against
// introspection, BuildRoots must skip the offending relationship rather than
// abort the whole source. Reconcile is expected to have already removed these
// shapes, but a future drift between reconcile's decision tree and the
// queries-layer constructor would otherwise silently take the whole table
// down.
//
// Each case covers one sentinel listed in isInconsistencyTolerantRelationshipError.
// The assertion shape is identical across cases:
//
//  1. BuildRoots returns no error (the swallow fired).
//  2. The parent table's collection and _by_pk roots survive.
//  3. Selecting the broken relationship as a nested field on the parent root
//     through the public BuildQuery API produces a "field does not exist"
//     error — proving the relationship was not registered on the parent
//     table. This is the strongest black-box observation available: the
//     internal relationships slice is unexported, but selection_query's
//     errFieldDoesNotExist surface fires exactly when relationshipFromGraphqlName
//     returns nil, so a regression that registered the broken relationship
//     (or stopped firing the swallow but kept the relationship somehow) is
//     caught by either assertion (1) or assertion (3).
func TestBuildRoots_BrokenRelationshipIsSwallowed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		buildMeta  func() (*introspection.Objects, *metadata.DatabaseMetadata)
		brokenRel  string
		parentName string
	}{
		{
			name: "reverse FK column unmatched on introspected target",
			// Parent users has an array relationship "orders" defined by a
			// ForeignKeyConstraint against orders.user_id, but orders'
			// introspected ForeignKeys do not contain user_id — only other_col.
			// This is the errRelationshipReverseFKColumnUnmatched path.
			buildMeta: func() (*introspection.Objects, *metadata.DatabaseMetadata) {
				objs := introspection.NewObjects()
				objs.Schemas["public"] = &introspection.Schema{
					Tables: map[string]*introspection.Table{
						"users": {
							Schema:      "public",
							Name:        "users",
							Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
							PrimaryKeys: []string{"id"},
						},
						"orders": {
							Schema:      "public",
							Name:        "orders",
							Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
							PrimaryKeys: []string{"id"},
							ForeignKeys: []introspection.ForeignKey{
								{
									ColumnName:        "other_col",
									ForeignSchema:     "public",
									ForeignTable:      "users",
									ForeignColumnName: "id",
								},
							},
						},
					},
				}
				md := &metadata.DatabaseMetadata{
					Tables: []metadata.TableMetadata{
						{
							Table: metadata.TableSource{Schema: "public", Name: "users"},
							ArrayRelationships: []metadata.ArrayRelationship{
								{
									Name: "orders",
									Using: metadata.RelationshipUsing{
										ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
											Columns: []string{"user_id"},
											Table: metadata.TableSource{
												Schema: "public",
												Name:   "orders",
											},
										},
									},
								},
							},
						},
						tableMetaFor("orders"),
					},
				}

				return objs, md
			},
			brokenRel:  "orders",
			parentName: "users",
		},
		{
			name: "reverse FK target table missing from introspection",
			// Parent users defines an array relationship against orders, but
			// orders is absent from the introspection objects.
			// This is the errRelationshipTargetTableIntrospectionNotFound path
			// inside buildReverseJoin.
			buildMeta: func() (*introspection.Objects, *metadata.DatabaseMetadata) {
				objs := buildObjectsWithUsersTable()
				md := &metadata.DatabaseMetadata{
					Tables: []metadata.TableMetadata{
						{
							Table: metadata.TableSource{Schema: "public", Name: "users"},
							ArrayRelationships: []metadata.ArrayRelationship{
								{
									Name: "orders",
									Using: metadata.RelationshipUsing{
										ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
											Columns: []string{"user_id"},
											Table: metadata.TableSource{
												Schema: "public",
												Name:   "orders",
											},
										},
									},
								},
							},
						},
					},
				}

				return objs, md
			},
			brokenRel:  "orders",
			parentName: "users",
		},
		{
			name: "forward FK column unresolved on parent introspection",
			// Parent users defines an object relationship via ForeignKeyColumns
			// [user_id], but users has no introspected ForeignKey for user_id.
			// LookupForwardFKTarget returns empty, so newLocalRelationship's
			// getRelationshipTable returns (nil, false) and the constructor
			// raises errRelationshipTargetTableNotFound. orders is still tracked
			// in metadata so this exercises the FK-introspection gap, not the
			// "target table not tracked" gap reconcile catches earlier.
			buildMeta: func() (*introspection.Objects, *metadata.DatabaseMetadata) {
				objs := introspection.NewObjects()
				objs.Schemas["public"] = &introspection.Schema{
					Tables: map[string]*introspection.Table{
						"users": {
							Schema:      "public",
							Name:        "users",
							Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
							PrimaryKeys: []string{"id"},
							// No ForeignKeys entry for user_id.
						},
						"orders": {
							Schema:      "public",
							Name:        "orders",
							Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
							PrimaryKeys: []string{"id"},
						},
					},
				}
				md := &metadata.DatabaseMetadata{
					Tables: []metadata.TableMetadata{
						{
							Table: metadata.TableSource{Schema: "public", Name: "users"},
							ObjectRelationships: []metadata.ObjectRelationship{
								{
									Name: "primary_order",
									Using: metadata.RelationshipUsing{
										ForeignKeyColumns: []string{"user_id"},
									},
								},
							},
						},
						tableMetaFor("orders"),
					},
				}

				return objs, md
			},
			brokenRel:  "primary_order",
			parentName: "users",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			objects, md := tc.buildMeta()

			roots, ops, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
			if err != nil {
				t.Fatalf(
					"BuildRoots: expected the broken relationship to be swallowed, got error: %v",
					err,
				)
			}

			if ops == nil {
				t.Fatal("expected non-nil Ops")
			}

			queryRoots, ok := roots.Operations[queries.OperationQuery]
			if !ok {
				t.Fatal("expected query roots to be present")
			}

			if _, ok := queryRoots[tc.parentName]; !ok {
				t.Errorf(
					"expected parent table %q collection root to survive, got: %v",
					tc.parentName, keys(queryRoots),
				)
			}

			if _, ok := queryRoots[tc.parentName+"_by_pk"]; !ok {
				t.Errorf(
					"expected parent table %q by-pk root to survive, got: %v",
					tc.parentName, keys(queryRoots),
				)
			}

			// Strongest observation: ask BuildQuery to select the broken
			// relationship as a nested field on the parent root. If the
			// relationship was dropped (the intended behaviour), the field
			// lookup in selection_query.go falls through to the
			// "field does not exist" branch with the field name in the
			// error message. If a future regression registered the
			// relationship despite the per-relationship error, BuildQuery
			// would proceed (potentially even succeed) and this assertion
			// would fail, catching the drift.
			op, _, _ := parseSingleField(
				t,
				`query { `+tc.parentName+` { id `+tc.brokenRel+` { id } } }`,
			)

			_, err = roots.BuildQuery(op, nil, nil, "admin", nil)
			if err == nil {
				t.Fatalf(
					"BuildQuery selecting dropped relationship %q on %q: expected "+
						"%q error, got nil — relationship appears to have been "+
						"registered despite the swallow",
					tc.brokenRel, tc.parentName, "field does not exist",
				)
			}

			if !strings.Contains(err.Error(), "field does not exist") ||
				!strings.Contains(err.Error(), tc.brokenRel) {
				t.Errorf(
					"BuildQuery selecting dropped relationship %q on %q: "+
						"expected error mentioning %q and the relationship name, got: %v",
					tc.brokenRel, tc.parentName, "field does not exist", err,
				)
			}
		})
	}
}

func keys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}

	return out
}
