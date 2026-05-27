package core_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestOrderDirection_SQL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		dir  core.OrderDirection
		want string
	}{
		{"asc", core.OrderAsc, "ASC"},
		{"desc", core.OrderDesc, "DESC"},
		{"asc nulls first", core.OrderAscNullsFirst, "ASC NULLS FIRST"},
		{"asc nulls last", core.OrderAscNullsLast, "ASC NULLS LAST"},
		{"desc nulls first", core.OrderDescNullsFirst, "DESC NULLS FIRST"},
		{"desc nulls last", core.OrderDescNullsLast, "DESC NULLS LAST"},
		{"unknown falls back to ASC", core.OrderDirection(99), "ASC"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := tc.dir.SQL(); got != tc.want {
				t.Fatalf("(%v).SQL() = %q, want %q", tc.dir, got, tc.want)
			}
		})
	}
}

func TestOrderDirection_IsDescending(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		dir  core.OrderDirection
		want bool
	}{
		{"asc", core.OrderAsc, false},
		{"desc", core.OrderDesc, true},
		{"asc nulls first", core.OrderAscNullsFirst, false},
		{"asc nulls last", core.OrderAscNullsLast, false},
		{"desc nulls first", core.OrderDescNullsFirst, true},
		{"desc nulls last", core.OrderDescNullsLast, true},
		{"unknown defaults to false", core.OrderDirection(99), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := tc.dir.IsDescending(); got != tc.want {
				t.Fatalf("(%v).IsDescending() = %v, want %v", tc.dir, got, tc.want)
			}
		})
	}
}

func TestQuoteIdentifier(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain identifier", "users", `"users"`},
		{"empty", "", `""`},
		{"identifier with dot is one quoted token", "a.b", `"a.b"`},
		{
			name: "embedded double quote is doubled",
			in:   `id") FROM users;--`,
			want: `"id"") FROM users;--"`,
		},
		{
			name: "multiple embedded quotes",
			in:   `a"b"c`,
			want: `"a""b""c"`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := core.QuoteIdentifier(tc.in); got != tc.want {
				t.Fatalf("QuoteIdentifier(%q) = %q, want %q", tc.in, got, tc.want)
			}

			var b strings.Builder
			core.WriteQuotedIdentifier(&b, tc.in)

			if got := b.String(); got != tc.want {
				t.Fatalf("WriteQuotedIdentifier(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestWriteQualifiedColumn(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		source string
		column string
		want   string
	}{
		{
			name:   "qualified with schema-qualified source",
			source: `"public"."users"`,
			column: "id",
			want:   `"public"."users"."id"`,
		},
		{
			name:   "qualified with alias source",
			source: `"u"`,
			column: "email",
			want:   `"u"."email"`,
		},
		{
			name:   "unqualified when source is empty",
			source: "",
			column: "count",
			want:   `"count"`,
		},
		{
			name:   "embedded double quote in column is doubled",
			source: `"u"`,
			column: `id") FROM users;--`,
			want:   `"u"."id"") FROM users;--"`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder
			core.WriteQualifiedColumn(&b, tc.source, tc.column)

			if got := b.String(); got != tc.want {
				t.Fatalf("WriteQualifiedColumn(%q, %q) = %q, want %q",
					tc.source, tc.column, got, tc.want)
			}
		})
	}
}
