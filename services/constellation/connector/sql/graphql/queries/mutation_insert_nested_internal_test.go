package queries

import (
	"maps"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
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
	}

	tbl := &table{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tbl.buildNestedCTEsMap(tt.insertObjs)
			if !maps.Equal(got, tt.want) {
				t.Fatalf("buildNestedCTEsMap() = %#v, want %#v", got, tt.want)
			}
		})
	}
}
