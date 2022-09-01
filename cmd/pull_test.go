package cmd

import (
	"reflect"
	"testing"
)

func Test_pgDumpSchemasFlags(t *testing.T) {
	type args struct {
		schemas []string
	}
	tests := []struct {
		name    string
		schemas []string
		want    []string
	}{
		{
			name:    "test",
			schemas: []string{"public", "my_schema1", "my_schema2"},
			want:    []string{"--schema", "public", "--schema", "my_schema1", "--schema", "my_schema2"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pgDumpSchemasFlags(tt.schemas); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("pgDumpSchemasFlags() = %v, want %v", got, tt.want)
			}
		})
	}
}
