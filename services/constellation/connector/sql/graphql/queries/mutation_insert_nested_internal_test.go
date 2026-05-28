package queries

import (
	"maps"
	"slices"
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
