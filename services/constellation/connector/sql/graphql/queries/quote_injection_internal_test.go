package queries

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// TestWriteNodeColumnSelectionsQuotesEmbeddedQuote guards the second-order
// SQL-injection invariant: a database column whose SQLName contains an embedded
// double quote (e.g. created via CREATE TABLE t ("a""b" int), giving SQLName
// `a"b`) must have that quote doubled when emitted into the generated SQL, so
// it cannot break out of the quoted identifier context. The column reference is
// built at root_query_aggregate.go via writeNodeColumnSelections.
func TestWriteNodeColumnSelectionsQuotesEmbeddedQuote(t *testing.T) {
	t.Parallel()

	tbl := &table{
		dialect: dialect.NewPostgresDialect(),
	}

	columns := []columnSelection{
		{
			alias: "evil",
			column: &core.Column{
				SQLName: `a"b`,
			},
			literal: "",
		},
	}

	var b strings.Builder

	if got := tbl.writeNodeColumnSelections(&b, columns, "_root"); !got {
		t.Fatalf("expected writeNodeColumnSelections to report columns written")
	}

	sql := b.String()

	// The embedded quote must be doubled inside the column reference.
	if !strings.Contains(sql, `"_root"."a""b"`) {
		t.Errorf("column reference not escaped; got %q", sql)
	}

	// The raw, unescaped form must not appear (it would break out of quoting).
	if strings.Contains(sql, `"_root"."a"b"`) {
		t.Errorf("unescaped quote leaked into SQL; got %q", sql)
	}
}

// TestQuoteIdentifierColumnReferenceQuoteFreeUnchanged confirms the fix is
// byte-identical to the previous manual concatenation for normal, quote-free
// column names, so existing golden SQL is unaffected.
func TestQuoteIdentifierColumnReferenceQuoteFreeUnchanged(t *testing.T) {
	t.Parallel()

	got := core.QuoteIdentifier("_root") + "." + core.QuoteIdentifier("name")
	if want := `"_root"."name"`; got != want {
		t.Errorf("quote-free column reference changed: got %q want %q", got, want)
	}
}

// TestBuildColumnSelectionsQuotesEmbeddedQuote guards the same second-order
// SQL-injection invariant for the single-row mutation final SELECT builder
// (selection_mutation_final_select.go). The column reference is built against
// the fixed mutation_result FROM-clause token, so the column name must have any
// embedded double quote doubled while quote-free names stay byte-identical
// (mutation_result."id").
func TestBuildColumnSelectionsQuotesEmbeddedQuote(t *testing.T) {
	t.Parallel()

	tbl := &table{
		dialect: dialect.NewPostgresDialect(),
	}

	columns := []columnSelection{
		{
			alias: "ok",
			column: &core.Column{
				SQLName: "id",
			},
			literal: "",
		},
		{
			alias: "evil",
			column: &core.Column{
				SQLName: `a"b`,
			},
			literal: "",
		},
	}

	var b strings.Builder

	first := true
	tbl.buildColumnSelections(&b, columns, &first)

	sql := b.String()

	// Quote-free name stays byte-identical to the prior manual concatenation.
	if !strings.Contains(sql, `mutation_result."id"`) {
		t.Errorf("quote-free column reference changed; got %q", sql)
	}

	// The embedded quote must be doubled inside the column reference.
	if !strings.Contains(sql, `mutation_result."a""b"`) {
		t.Errorf("column reference not escaped; got %q", sql)
	}

	// The raw, unescaped form must not appear (it would break out of quoting).
	if strings.Contains(sql, `mutation_result."a"b"`) {
		t.Errorf("unescaped quote leaked into SQL; got %q", sql)
	}
}
