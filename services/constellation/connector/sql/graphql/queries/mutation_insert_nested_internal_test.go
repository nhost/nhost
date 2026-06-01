package queries

import (
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func TestBuildNestedCTERefsMirrorEmittedCTEs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		insertObjs   []arguments.InsertObject
		wantAllNames []string
		wantDirect   map[string]string
	}{
		{
			// Multi-parent inserts emit one object-rel CTE per parent, so both
			// parents' object rels appear (nested_<rel>_<parentIdx>) — the
			// pre-fix behavior dropped every parent past the first, which
			// silently lost rows and misrouted FKs (BUG_HIGH_1).
			name: "keeps every parent's object rels and all array rels",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
						{RelationshipName: "replies", IsArrayRelationship: true},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "avatar", IsArrayRelationship: false},
						{RelationshipName: "attachments", IsArrayRelationship: true},
					},
				},
			},
			wantAllNames: []string{
				"nested_file_0",
				"nested_avatar_1",
				"nested_replies",
				"nested_attachments",
			},
		},
		{
			// The object rel lives only on the second parent, so it is emitted
			// from parent index 1 (nested_file_1).
			name: "keeps later object and array rels when first parent has no nested inserts",
			insertObjs: []arguments.InsertObject{
				{},
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
						{RelationshipName: "replies", IsArrayRelationship: true},
					},
				},
			},
			wantAllNames: []string{"nested_file_1", "nested_replies"},
		},
		{
			name: "includes descendants below multi-parent object rels",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "department",
							IsArrayRelationship: false,
							NestedObjects: []arguments.InsertObject{
								{
									NestedInserts: []arguments.NestedInsert{
										{
											RelationshipName:    "employees",
											IsArrayRelationship: true,
											NestedObjects:       []arguments.InsertObject{{}},
										},
									},
								},
							},
						},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "department",
							IsArrayRelationship: false,
							NestedObjects: []arguments.InsertObject{
								{
									NestedInserts: []arguments.NestedInsert{
										{
											RelationshipName:    "employees",
											IsArrayRelationship: true,
											NestedObjects:       []arguments.InsertObject{{}},
										},
									},
								},
							},
						},
					},
				},
			},
			wantAllNames: []string{
				"nested_department_0",
				"nested_department_1",
				"nested_employees_0",
				"nested_employees_1",
			},
		},
		{
			name: "separates direct selection refs from descendant force refs",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "department",
							IsArrayRelationship: false,
							NestedObjects: []arguments.InsertObject{
								{
									NestedInserts: []arguments.NestedInsert{
										{
											RelationshipName:    "employees",
											IsArrayRelationship: true,
											NestedObjects:       []arguments.InsertObject{{}},
										},
									},
								},
							},
						},
					},
				},
			},
			wantAllNames: []string{"nested_department", "nested_employees"},
			wantDirect:   map[string]string{"department": "nested_department"},
		},
		{
			name: "includes partitioned array grandchildren",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects: []arguments.InsertObject{
								{
									NestedInserts: []arguments.NestedInsert{
										{
											RelationshipName:    "likes",
											IsArrayRelationship: true,
											NestedObjects:       []arguments.InsertObject{{}},
										},
									},
								},
							},
						},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects: []arguments.InsertObject{
								{
									NestedInserts: []arguments.NestedInsert{
										{
											RelationshipName:    "likes",
											IsArrayRelationship: true,
											NestedObjects:       []arguments.InsertObject{{}},
										},
									},
								},
							},
						},
					},
				},
			},
			wantAllNames: []string{"nested_replies", "nested_replies_nested_likes"},
		},
		{
			name: "splits same array rel by on_conflict",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects:       []arguments.InsertObject{{}},
							OnConflict: &arguments.OnConflict{
								ConstraintName: "note_replies_pkey",
								UpdateColumns:  []string{"body"},
							},
						},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects:       []arguments.InsertObject{{}},
							OnConflict: &arguments.OnConflict{
								ConstraintName: "note_replies_pkey",
								UpdateColumns:  []string{"visibility"},
							},
						},
					},
				},
			},
			wantAllNames: []string{"nested_replies", "nested_replies_1"},
		},
		{
			// Object-rel-only multi-parent insert: each parent's object rel is
			// emitted from its own CTE (nested_<rel>_<parentIdx>), the
			// affected_rows / force-ref counterpart of BUG_HIGH_1's per-parent
			// object CTE emission.
			name: "maps per-parent object rel for object-only multi-parent insert",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
					},
				},
			},
			wantAllNames: []string{"nested_file_0", "nested_file_1"},
		},
		{
			// Array-rel names are allocated after object-rel names. If an array
			// rel's bare name would equal a per-parent object CTE (for example,
			// relationship `file_1` vs parent[1]'s `file` object CTE), the array
			// rel must take a suffixed name instead of emitting a duplicate CTE
			// alias.
			name: "array rel CTE name avoids per-parent object rel CTE collision",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
						{
							RelationshipName:    "file_1",
							IsArrayRelationship: true,
							NestedObjects:       []arguments.InsertObject{{}},
						},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
					},
				},
			},
			wantAllNames: []string{"nested_file_0", "nested_file_1", "nested_file_1_1"},
		},
		{
			name: "keeps single-parent object rel as bare nested name",
			insertObjs: []arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
					},
				},
			},
			wantAllNames: []string{"nested_file"},
			wantDirect:   map[string]string{"file": "nested_file"},
		},
	}

	tbl := &table{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := tbl.buildNestedCTERefs(tt.insertObjs)
			if err != nil {
				t.Fatalf("buildNestedCTERefs(): %v", err)
			}

			gotAllNames := sortedNestedCTENames(got.allNames)

			wantAllNames := sortedNestedCTENames(tt.wantAllNames)
			if !slices.Equal(gotAllNames, wantAllNames) {
				t.Fatalf(
					"buildNestedCTERefs().allNames = %#v, want %#v",
					gotAllNames,
					wantAllNames,
				)
			}

			if !maps.Equal(got.direct, tt.wantDirect) {
				t.Fatalf("buildNestedCTERefs().direct = %#v, want %#v", got.direct, tt.wantDirect)
			}
		})
	}
}

// TestBuildNestedCTERefsAvoidsObjectDescendantCollision is the regression for a
// duplicate-CTE-alias bug: a multi-parent object rel emits its whole subtree
// under a parent-indexed namer, so an object rel `department` containing an
// array rel `employees` emits the descendant CTE nested_employees_0 (and _1). A
// sibling top-level array rel literally named `employees_0` must not also take
// the bare nested_employees_0 — that would duplicate the alias and produce an
// invalid WITH query — so it must suffix to nested_employees_0_1. The
// allocation seeds the full object subtree as used, not just the immediate
// object rels, which is what this test pins.
func TestBuildNestedCTERefsAvoidsObjectDescendantCollision(t *testing.T) {
	t.Parallel()

	departmentWithEmployees := arguments.NestedInsert{
		RelationshipName:    "department",
		IsArrayRelationship: false,
		NestedObjects: []arguments.InsertObject{
			{
				NestedInserts: []arguments.NestedInsert{
					{
						RelationshipName:    "employees",
						IsArrayRelationship: true,
						NestedObjects:       []arguments.InsertObject{{}},
					},
				},
			},
		},
	}

	insertObjs := []arguments.InsertObject{
		{
			NestedInserts: []arguments.NestedInsert{
				departmentWithEmployees,
				{
					RelationshipName:    "employees_0",
					IsArrayRelationship: true,
					NestedObjects:       []arguments.InsertObject{{}},
				},
			},
		},
		{NestedInserts: []arguments.NestedInsert{departmentWithEmployees}},
	}

	tbl := &table{}

	got, err := tbl.buildNestedCTERefs(insertObjs)
	if err != nil {
		t.Fatalf("buildNestedCTERefs(): %v", err)
	}

	seen := make(map[string]int, len(got.allNames))
	for _, name := range got.allNames {
		seen[name]++
		if seen[name] > 1 {
			t.Errorf("duplicate CTE alias %q in allNames %#v", name, got.allNames)
		}
	}

	wantAllNames := []string{
		"nested_department_0",
		"nested_department_1",
		"nested_employees_0",
		"nested_employees_1",
		"nested_employees_0_1",
	}

	gotAllNames := sortedNestedCTENames(got.allNames)
	if !slices.Equal(gotAllNames, sortedNestedCTENames(wantAllNames)) {
		t.Fatalf("buildNestedCTERefs().allNames = %#v, want %#v", gotAllNames, wantAllNames)
	}
}

func TestBuildNestedCTERefsAvoidsObjectRelationshipDescendantCollision(t *testing.T) {
	t.Parallel()

	profile := arguments.NestedInsert{
		RelationshipName:    "profile",
		IsArrayRelationship: false,
		NestedObjects:       []arguments.InsertObject{{}},
	}
	ownerWithProfile := arguments.NestedInsert{
		RelationshipName:    "owner",
		IsArrayRelationship: false,
		NestedObjects: []arguments.InsertObject{
			{NestedInserts: []arguments.NestedInsert{profile}},
		},
	}

	insertObjs := []arguments.InsertObject{
		{
			NestedInserts: []arguments.NestedInsert{
				profile,
				ownerWithProfile,
				{
					RelationshipName:    "profile_0_1",
					IsArrayRelationship: true,
					NestedObjects:       []arguments.InsertObject{{}},
				},
			},
		},
		{NestedInserts: []arguments.NestedInsert{profile, ownerWithProfile}},
	}

	tbl := &table{}

	got, err := tbl.buildNestedCTERefs(insertObjs)
	if err != nil {
		t.Fatalf("buildNestedCTERefs(): %v", err)
	}

	seen := make(map[string]int, len(got.allNames))
	for _, name := range got.allNames {
		seen[name]++
		if seen[name] > 1 {
			t.Errorf("duplicate CTE alias %q in allNames %#v", name, got.allNames)
		}
	}

	wantAllNames := []string{
		"nested_owner_0",
		"nested_owner_1",
		"nested_profile_0",
		"nested_profile_0_1",
		"nested_profile_0_1_1",
		"nested_profile_1",
		"nested_profile_1_1",
	}

	gotAllNames := sortedNestedCTENames(got.allNames)
	if !slices.Equal(gotAllNames, sortedNestedCTENames(wantAllNames)) {
		t.Fatalf("buildNestedCTERefs().allNames = %#v, want %#v", gotAllNames, wantAllNames)
	}
}

func TestBuildNestedInsertCTEsAvoidsObjectRelationshipDescendantCollision(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	tbl := newTestTable(t, []*core.Column{idCol}, nil)

	objectRel := func(
		name string,
		id string,
		children ...arguments.NestedInsert,
	) arguments.NestedInsert {
		return arguments.NestedInsert{
			RelationshipName:    name,
			TargetTable:         tbl,
			IsArrayRelationship: false,
			NestedObjects: []arguments.InsertObject{
				{
					Columns:       []arguments.InsertColumn{insertCol(idCol, id)},
					NestedInserts: children,
				},
			},
		}
	}

	insertObjs := []arguments.InsertObject{
		{
			NestedInserts: []arguments.NestedInsert{
				objectRel("profile", "profile-0"),
				objectRel("owner", "owner-0", objectRel("profile", "owner-profile-0")),
			},
		},
		{
			NestedInserts: []arguments.NestedInsert{
				objectRel("profile", "profile-1"),
				objectRel("owner", "owner-1", objectRel("profile", "owner-profile-1")),
			},
		},
	}

	got, _, _, err := tbl.buildNestedInsertCTEs(insertObjs, "admin", nil, nil, 1)
	if err != nil {
		t.Fatalf("buildNestedInsertCTEs(): %v", err)
	}

	wantAliases := []string{
		"nested_owner_0",
		"nested_owner_1",
		"nested_profile_0",
		"nested_profile_0_1",
		"nested_profile_1",
		"nested_profile_1_1",
	}
	for _, alias := range wantAliases {
		count := 0
		if strings.HasPrefix(got, alias+" AS (") {
			count++
		}

		count += strings.Count(got, ", "+alias+" AS (")

		if count != 1 {
			t.Fatalf("CTE alias %q appears %d times in SQL:\n%s", alias, count, got)
		}
	}
}

// TestBuildPartitionedUnionAllSelectDefaultExprForMissing locks the
// Hasura-parity fix for the multi-parent partitioned nested-array path
// (INCON_HIGH_4): when a partitioned UNION-ALL branch omits a column that has a
// registered DB default, the branch must emit the default expression
// (parenthesised and type-cast) instead of a typed NULL. The partitioned path
// feeds INSERT INTO <table>(cols...) SELECT ..., so a typed NULL for a NOT NULL
// DEFAULT column omitted by one row but supplied by a sibling would trip
// Postgres 23502 where Hasura lets the per-row default apply. Mirrors
// TestBuildUnionAllSelectDefaultExprForMissing for the single-parent path.
func TestBuildPartitionedUnionAllSelectDefaultExprForMissing(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	bodyCol := col("body", "text", false)
	visibilityCol := colWithDefaultExpr("visibility", "text", "'public'::text")

	tbl := newTestTable(t, []*core.Column{idCol, bodyCol, visibilityCol}, nil)

	objs := []arguments.InsertObject{
		// Row 0 omits visibility -> must render the default expression.
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(bodyCol, "first"),
		}},
		// Row 1 supplies visibility -> renders the typed placeholder as usual.
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u2"),
			insertCol(bodyCol, "second"),
			insertCol(visibilityCol, "private"),
		}},
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs, nil)
	parentCTENames := []string{"mutation_result_0", "mutation_result_1"}

	var b strings.Builder

	params, _ := tbl.buildPartitionedUnionAllSelect(
		&b, objs, parentCTENames, allColumns, columnToValue, nil, nil, 1,
	)

	got := b.String()

	// No FK columns are mapped, so neither branch emits a FROM clause.
	wantFirst := `SELECT $1::uuid AS "id", $2::text AS "body", ` +
		`('public'::text)::text AS "visibility"`
	wantSecond := `SELECT $3::uuid AS "id", $4::text AS "body", $5::text AS "visibility"`

	want := wantFirst + " UNION ALL " + wantSecond
	if got != want {
		t.Errorf("buildPartitionedUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}

	wantParams := []any{"u1", "first", "u2", "second", "private"}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}

	for i, p := range wantParams {
		if params[i] != p {
			t.Errorf("params[%d] = %v, want %v", i, params[i], p)
		}
	}
}

func onConflictWithBodyWhere(value string) *arguments.OnConflict {
	bodyColumn := &core.Column{
		SQLName:     "body",
		GraphqlName: "body",
		SQLType:     "text",
		IsArray:     false,
		IsGenerated: false,
		IsIdentity:  false,
		HasDefault:  false,
	}

	return &arguments.OnConflict{
		ConstraintName: "note_replies_pkey",
		UpdateColumns:  []string{"body"},
		Where: where.Clause{
			where.NewEqualsFilter(bodyColumn, value, dialect.NewPostgresDialect()),
		},
	}
}

func TestGroupPartitionedArrayNestedInsertsOnConflictCompatibility(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		firstOnConflict  *arguments.OnConflict
		secondOnConflict *arguments.OnConflict
		wantCTENames     []string
		wantParentIdxs   [][]int
	}{
		{
			name: "groups equal on_conflict clauses",
			firstOnConflict: &arguments.OnConflict{
				ConstraintName: "note_replies_pkey",
				UpdateColumns:  []string{"body"},
			},
			secondOnConflict: &arguments.OnConflict{
				ConstraintName: "note_replies_pkey",
				UpdateColumns:  []string{"body"},
			},
			wantCTENames:   []string{"nested_replies"},
			wantParentIdxs: [][]int{{0, 1}},
		},
		{
			name: "splits incompatible on_conflict clauses",
			firstOnConflict: &arguments.OnConflict{
				ConstraintName: "note_replies_pkey",
				UpdateColumns:  []string{"body"},
			},
			secondOnConflict: &arguments.OnConflict{
				ConstraintName: "note_replies_pkey",
				UpdateColumns:  []string{"visibility"},
			},
			wantCTENames:   []string{"nested_replies", "nested_replies_1"},
			wantParentIdxs: [][]int{{0}, {1}},
		},
		{
			name:             "splits matching where SQL with different params",
			firstOnConflict:  onConflictWithBodyWhere("first"),
			secondOnConflict: onConflictWithBodyWhere("second"),
			wantCTENames:     []string{"nested_replies", "nested_replies_1"},
			wantParentIdxs:   [][]int{{0}, {1}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			groups, err := groupPartitionedArrayNestedInserts([]arguments.InsertObject{
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects:       []arguments.InsertObject{{}},
							OnConflict:          tt.firstOnConflict,
						},
					},
				},
				{
					NestedInserts: []arguments.NestedInsert{
						{
							RelationshipName:    "replies",
							IsArrayRelationship: true,
							NestedObjects:       []arguments.InsertObject{{}},
							OnConflict:          tt.secondOnConflict,
						},
					},
				},
			})
			if err != nil {
				t.Fatalf("groupPartitionedArrayNestedInserts(): %v", err)
			}

			if len(groups) != len(tt.wantCTENames) {
				t.Fatalf("got %d groups, want %d", len(groups), len(tt.wantCTENames))
			}

			for i := range groups {
				if groups[i].cteName != tt.wantCTENames[i] {
					t.Errorf(
						"group %d cteName = %q, want %q",
						i,
						groups[i].cteName,
						tt.wantCTENames[i],
					)
				}

				if !slices.Equal(groups[i].parentIdxs, tt.wantParentIdxs[i]) {
					t.Errorf(
						"group %d parentIdxs = %v, want %v",
						i,
						groups[i].parentIdxs,
						tt.wantParentIdxs[i],
					)
				}
			}
		})
	}
}
