package dialect_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestPostgresComputedRow(t *testing.T) {
	t.Parallel()

	var b strings.Builder
	dialect.WritePostgresComputedRow(&b, `alias`, `case"schema`, "items", []string{"id", "payload"})

	want := `ROW("alias"."id", "alias"."payload")::"case""schema"."items"`
	if b.String() != want {
		t.Fatalf("row = %s, want %s", b.String(), want)
	}
}

func TestPostgresComputedOutput(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct{ placeholder, expected string }{
		{"", `"fn"()`},
		{"$3", `("fn"() #> $3::text[])`},
	} {
		t.Run(tt.placeholder, func(t *testing.T) {
			t.Parallel()

			if got := dialect.PostgresComputedOutput(`"fn"()`, tt.placeholder); got != tt.expected {
				t.Fatalf("computed output = %s, want %s", got, tt.expected)
			}
		})
	}
}
