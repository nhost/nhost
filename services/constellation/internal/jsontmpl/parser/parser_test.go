package parser_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/lexer"
	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/parser"
)

func fixtureRoot(t *testing.T, sub string) string {
	t.Helper()
	return filepath.Join("..", "testdata", "conformance", sub)
}

// TestParseSuccessFixtures asserts every parser-success fixture lexes
// and parses without error. AST shape comparison vs upstream's golden
// .txt files is out of scope (they are Haskell-pretty-printed); the
// conformance bar is "parses cleanly", matching upstream's Spec.hs:142.
func TestParseSuccessFixtures(t *testing.T) {
	dir := fixtureRoot(t, "parser/success/examples")
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
			toks, err := lexer.Lex(string(src))
			if err != nil {
				t.Fatalf("lex: %v", err)
			}
			if _, err := parser.Parse(toks); err != nil {
				t.Fatalf("parse: %v", err)
			}
		})
	}
}

// TestParseEvalFixtures repeats the smoke test against the richer eval
// fixtures. They exercise object-with-template, nested ranges, and
// string templates.
func TestParseEvalFixtures(t *testing.T) {
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
			toks, err := lexer.Lex(string(src))
			if err != nil {
				t.Fatalf("lex: %v", err)
			}
			if _, err := parser.Parse(toks); err != nil {
				t.Fatalf("parse: %v", err)
			}
		})
	}
}

// TestParseDeepNestingReturnsError asserts the parser's recursion-depth guard
// converts pathologically nested input into a typed *parser.Error instead of
// overflowing the goroutine stack (an uncatchable Go fatal error). Each input
// nests far beyond maxParseDepth.
func TestParseDeepNestingReturnsError(t *testing.T) {
	t.Parallel()

	const n = 50000

	tests := []struct {
		name string
		src  string
	}{
		{"arrays", strings.Repeat("[", n) + strings.Repeat("]", n)},
		{"parens", strings.Repeat("(", n) + strings.Repeat(")", n)},
		{"curly", strings.Repeat("{{", n) + strings.Repeat("}}", n)},
		{"not", strings.Repeat("not ", n) + "1"},
		{"index", "$" + strings.Repeat("[$", n) + strings.Repeat("]", n)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			toks, err := lexer.Lex(tt.src)
			if err != nil {
				// A lex-level rejection is also an acceptable, non-crashing
				// outcome for these pathological inputs.
				return
			}

			_, parseErr := parser.Parse(toks)
			if parseErr == nil {
				t.Fatalf("expected a parse error for deeply nested input, got nil")
			}

			var pe *parser.Error
			if !errors.As(parseErr, &pe) {
				t.Fatalf("expected *parser.Error, got %T: %v", parseErr, parseErr)
			}
		})
	}
}

// TestParseFailureFixtures asserts every parser-failure fixture
// produces an error.
func TestParseFailureFixtures(t *testing.T) {
	dir := fixtureRoot(t, "parser/failure/examples")
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
			toks, lexErr := lexer.Lex(string(src))
			if lexErr != nil {
				// Lex errors are an acceptable failure mode for these
				// fixtures (the upstream parser absorbs them too).
				return
			}
			_, parseErr := parser.Parse(toks)
			if parseErr == nil {
				t.Fatalf("expected parse error, got nil")
			}
			var pe *parser.Error
			if !errors.As(parseErr, &pe) {
				t.Fatalf("expected *parser.Error, got %T: %v", parseErr, parseErr)
			}
		})
	}
}
