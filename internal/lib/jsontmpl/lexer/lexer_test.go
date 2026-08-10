package lexer_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl/lexer"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// fixtureRoot resolves the conformance directory relative to this
// test file. The lexer package lives one directory deeper than
// the conformance suite at the package root.
func fixtureRoot(t *testing.T, sub string) string {
	t.Helper()
	return filepath.Join("..", "testdata", "conformance", sub)
}

// TestLexParserSuccessFixtures asserts every parser-success fixture
// lexes to a stream ending in EOF without error. Stronger AST
// assertions live in the parser tests; here we only check that the
// tokeniser doesn't panic or err on real templates.
func TestLexParserSuccessFixtures(t *testing.T) {
	dir := fixtureRoot(t, "parser/success/examples")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	if len(entries) == 0 {
		t.Fatalf("no fixtures under %s", dir)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".kriti") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".kriti")
		t.Run(name, func(t *testing.T) {
			src, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				t.Fatalf("read: %v", err)
			}
			toks, err := lexer.Lex(string(src))
			if err != nil {
				t.Fatalf("lex %s: %v", name, err)
			}
			if len(toks) == 0 || toks[len(toks)-1].Kind != token.KindEOF {
				t.Fatalf("stream does not end in EOF: last=%v", toks[len(toks)-1])
			}
		})
	}
}

// TestLexEvalFixtures repeats the smoke test against every eval
// fixture. They are richer than the parser-only ones (StringTem +
// range + nested templates), so they exercise the mode stack.
func TestLexEvalFixtures(t *testing.T) {
	dir := fixtureRoot(t, "eval/examples")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".kriti") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".kriti")
		t.Run(name, func(t *testing.T) {
			src, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				t.Fatalf("read: %v", err)
			}
			if _, err := lexer.Lex(string(src)); err != nil {
				t.Fatalf("lex: %v", err)
			}
		})
	}
}

// kind is a helper for compact expected-token specs.
func kind(k token.Kind) token.Token { return token.Token{Kind: k} }

// hasVariableText reports whether the kind's Text is content-bearing
// (rather than a canonical symbol like "==" or `"`). For canonical
// symbol kinds we don't compare Text in TestLexBasic.
func hasVariableText(k token.Kind) bool {
	switch k {
	case token.KindStringLit, token.KindIdentifier,
		token.KindIntLit, token.KindNumLit, token.KindBoolLit:
		return true
	}
	return false
}

// TestLexBasic exercises the unit-level rules.
func TestLexBasic(t *testing.T) {
	cases := []struct {
		name string
		src  string
		want []token.Token
	}{
		{
			"empty",
			"",
			[]token.Token{kind(token.KindEOF)},
		},
		{
			"simple_int",
			"42",
			[]token.Token{
				{Kind: token.KindIntLit, Text: "42"},
				kind(token.KindEOF),
			},
		},
		{
			"negative_int",
			"-7",
			[]token.Token{
				{Kind: token.KindIntLit, Text: "-7"},
				kind(token.KindEOF),
			},
		},
		{
			"float",
			"1.5",
			[]token.Token{
				{Kind: token.KindNumLit, Text: "1.5"},
				kind(token.KindEOF),
			},
		},
		{
			"exponent",
			"1e3",
			[]token.Token{
				{Kind: token.KindNumLit, Text: "1e3"},
				kind(token.KindEOF),
			},
		},
		{
			"identifier_with_dollar",
			"$body",
			[]token.Token{
				{Kind: token.KindIdentifier, Text: "$body"},
				kind(token.KindEOF),
			},
		},
		{
			"bare_dollar",
			"$",
			[]token.Token{
				{Kind: token.KindIdentifier, Text: "$"},
				kind(token.KindEOF),
			},
		},
		{
			"bool_true",
			"true",
			[]token.Token{
				{Kind: token.KindBoolLit, Text: "true", Bool: true},
				kind(token.KindEOF),
			},
		},
		{
			"comment_then_token",
			"# hello\n1",
			[]token.Token{
				{Kind: token.KindIntLit, Text: "1"},
				kind(token.KindEOF),
			},
		},
		{
			"digraphs",
			"==!=>=<=&&||??:=",
			[]token.Token{
				kind(token.KindEq),
				kind(token.KindNotEq),
				kind(token.KindGte),
				kind(token.KindLte),
				kind(token.KindAnd),
				kind(token.KindOr),
				kind(token.KindDoubleQuestionMark),
				kind(token.KindAssignment),
				kind(token.KindEOF),
			},
		},
		{
			"underscore_symbol",
			"_",
			[]token.Token{
				kind(token.KindUnderscore),
				kind(token.KindEOF),
			},
		},
		{
			"template_in_string",
			`"hi {{ $x }}!"`,
			[]token.Token{
				kind(token.KindStringBegin),
				{Kind: token.KindStringLit, Text: "hi "},
				kind(token.KindDoubleCurlyOpen),
				{Kind: token.KindIdentifier, Text: "$x"},
				kind(token.KindDoubleCurlyClose),
				{Kind: token.KindStringLit, Text: "!"},
				kind(token.KindStringEnd),
				kind(token.KindEOF),
			},
		},
		{
			"nested_template_in_string",
			`"a{{"b{{c}}"}}d"`,
			[]token.Token{
				kind(token.KindStringBegin),
				{Kind: token.KindStringLit, Text: "a"},
				kind(token.KindDoubleCurlyOpen),
				kind(token.KindStringBegin),
				{Kind: token.KindStringLit, Text: "b"},
				kind(token.KindDoubleCurlyOpen),
				{Kind: token.KindIdentifier, Text: "c"},
				kind(token.KindDoubleCurlyClose),
				kind(token.KindStringEnd),
				kind(token.KindDoubleCurlyClose),
				{Kind: token.KindStringLit, Text: "d"},
				kind(token.KindStringEnd),
				kind(token.KindEOF),
			},
		},
		{
			"unicode_escape",
			`"a\u00e9b"`,
			[]token.Token{
				kind(token.KindStringBegin),
				{Kind: token.KindStringLit, Text: "a"},
				{Kind: token.KindStringLit, Text: "é"},
				{Kind: token.KindStringLit, Text: "b"},
				kind(token.KindStringEnd),
				kind(token.KindEOF),
			},
		},
		{
			"top_level_template",
			"{{ if true }}x{{ else }}y{{ end }}",
			[]token.Token{
				kind(token.KindDoubleCurlyOpen),
				{Kind: token.KindIdentifier, Text: "if"},
				{Kind: token.KindBoolLit, Text: "true", Bool: true},
				kind(token.KindDoubleCurlyClose),
				// 'x' here is in modeInit (we never entered string mode).
				{Kind: token.KindIdentifier, Text: "x"},
				kind(token.KindDoubleCurlyOpen),
				{Kind: token.KindIdentifier, Text: "else"},
				kind(token.KindDoubleCurlyClose),
				{Kind: token.KindIdentifier, Text: "y"},
				kind(token.KindDoubleCurlyOpen),
				{Kind: token.KindIdentifier, Text: "end"},
				kind(token.KindDoubleCurlyClose),
				kind(token.KindEOF),
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := lexer.Lex(c.src)
			if err != nil {
				t.Fatalf("lex error: %v", err)
			}
			if len(got) != len(c.want) {
				t.Fatalf(
					"token count: got %d, want %d\ngot:  %v\nwant: %v",
					len(got),
					len(c.want),
					got,
					c.want,
				)
			}
			for i := range got {
				if got[i].Kind != c.want[i].Kind {
					t.Errorf("token %d kind: got %v, want %v", i, got[i].Kind, c.want[i].Kind)
					continue
				}
				if hasVariableText(got[i].Kind) && got[i].Text != c.want[i].Text {
					t.Errorf("token %d text: got %q, want %q", i, got[i].Text, c.want[i].Text)
				}
				if got[i].Bool != c.want[i].Bool {
					t.Errorf("token %d bool: got %v, want %v", i, got[i].Bool, c.want[i].Bool)
				}
			}
		})
	}
}
