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

func TestBuildNestedCTEsMapMirrorsEmittedCTEs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		insertObjs []arguments.InsertObject
		want       map[string]string
	}{
		{
			name: "keeps first-parent object rels and all array rels",
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
			want: map[string]string{
				"file":        "nested_file",
				"replies":     "nested_replies",
				"attachments": "nested_attachments",
			},
		},
		{
			name: "keeps later array rel when first parent has no nested inserts",
			insertObjs: []arguments.InsertObject{
				{},
				{
					NestedInserts: []arguments.NestedInsert{
						{RelationshipName: "file", IsArrayRelationship: false},
						{RelationshipName: "replies", IsArrayRelationship: true},
					},
				},
			},
			want: map[string]string{
				"replies": "nested_replies",
			},
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
			want: map[string]string{
				"replies": "nested_replies",
				"likes":   "nested_replies_nested_likes",
			},
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
			want: map[string]string{
				"replies":   "nested_replies",
				"replies#1": "nested_replies_1",
			},
		},
	}

	tbl := &table{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := tbl.buildNestedCTEsMap(tt.insertObjs)
			if err != nil {
				t.Fatalf("buildNestedCTEsMap(): %v", err)
			}

			if !maps.Equal(got, tt.want) {
				t.Fatalf("buildNestedCTEsMap() = %#v, want %#v", got, tt.want)
			}
		})
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
