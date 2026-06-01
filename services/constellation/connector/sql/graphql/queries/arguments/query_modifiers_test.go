package arguments_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestOrderBy_WriteSQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		items []arguments.OrderByItem
		want  string
	}{
		{
			name:  "empty",
			items: nil,
			want:  "",
		},
		{
			name:  "single column ASC",
			items: []arguments.OrderByItem{{Column: "name", Direction: core.OrderAsc}},
			want:  `ORDER BY "name" ASC`,
		},
		{
			name: "multiple columns",
			items: []arguments.OrderByItem{
				{Column: "name", Direction: core.OrderAscNullsFirst},
				{Column: "age", Direction: core.OrderDesc},
			},
			want: `ORDER BY "name" ASC NULLS FIRST, "age" DESC`,
		},
		{
			name: "unknown direction falls back to ASC",
			items: []arguments.OrderByItem{
				{Column: "name", Direction: core.OrderDirection(99)},
			},
			want: `ORDER BY "name" ASC`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ob := &arguments.OrderBy{Items: tt.items}

			var b strings.Builder
			if _, _, err := ob.WriteSQL(&b, nil, 1); err != nil {
				t.Fatalf("WriteSQL: %v", err)
			}

			if got := b.String(); got != tt.want {
				t.Errorf("WriteSQL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestLimit_WriteSQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value int
		want  string
	}{
		{"zero", 0, "LIMIT 0"},
		{"positive", 25, "LIMIT 25"},
		{"large", 1000000, "LIMIT 1000000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			l := &arguments.Limit{Value: tt.value}

			var b strings.Builder
			if _, _, err := l.WriteSQL(&b, nil, 1); err != nil {
				t.Fatalf("WriteSQL: %v", err)
			}

			if got := b.String(); got != tt.want {
				t.Errorf("WriteSQL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestOffset_WriteSQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value int
		want  string
	}{
		{"zero", 0, "OFFSET 0"},
		{"positive", 50, "OFFSET 50"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			o := &arguments.Offset{Value: tt.value}

			var b strings.Builder
			if _, _, err := o.WriteSQL(&b, nil, 1); err != nil {
				t.Fatalf("WriteSQL: %v", err)
			}

			if got := b.String(); got != tt.want {
				t.Errorf("WriteSQL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDistinctOn_WriteSQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		columns []string
		want    string
	}{
		{"empty", nil, ""},
		{"single column", []string{"name"}, `DISTINCT ON ("name")`},
		{"multiple columns", []string{"name", "age"}, `DISTINCT ON ("name", "age")`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			d := &arguments.DistinctOn{Columns: tt.columns}

			var b strings.Builder
			d.WriteSQL(&b)

			if got := b.String(); got != tt.want {
				t.Errorf("WriteSQL = %q, want %q", got, tt.want)
			}
		})
	}
}
