package jsontmpl_test

// Fuzz harness for the lexer, parser, and renderer. Seeds are loaded
// from the conformance corpus so the fuzzer starts on real templates.
//
// Properties asserted:
//   - lexer/parser are total: every input either returns tokens/AST
//     or a typed error; no panics.
//   - render is deterministic: rendering the same template against the
//     same scope yields identical bytes.
//
// Run locally:
//   go test -fuzz=FuzzLexer    -fuzztime=30s ./internal/lib/jsontmpl
//   go test -fuzz=FuzzParser   -fuzztime=30s ./internal/lib/jsontmpl
//   go test -fuzz=FuzzRender   -fuzztime=30s ./internal/lib/jsontmpl

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl"
	"github.com/nhost/nhost/internal/lib/jsontmpl/lexer"
	"github.com/nhost/nhost/internal/lib/jsontmpl/parser"
)

func seedCorpus(f *testing.F) {
	roots := []string{
		"testdata/conformance/eval/examples",
		"testdata/conformance/parser/success/examples",
		"testdata/conformance/parser/failure/examples",
	}
	for _, dir := range roots {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".kriti") {
				continue
			}
			src, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err == nil {
				f.Add(string(src))
			}
		}
	}
}

func FuzzLexer(f *testing.F) {
	seedCorpus(f)
	f.Fuzz(func(t *testing.T, src string) {
		toks, err := lexer.Lex(src)
		if err != nil {
			var le *lexer.Error
			if !errors.As(err, &le) {
				t.Fatalf("non-typed lex error: %T %v", err, err)
			}
			return
		}
		if len(toks) == 0 {
			t.Fatalf("token stream empty for non-error lex")
		}
	})
}

func FuzzParser(f *testing.F) {
	seedCorpus(f)
	f.Fuzz(func(t *testing.T, src string) {
		toks, err := lexer.Lex(src)
		if err != nil {
			return
		}
		if _, err := parser.Parse(toks); err != nil {
			var pe *parser.Error
			if !errors.As(err, &pe) {
				t.Fatalf("non-typed parse error: %T %v", err, err)
			}
		}
	})
}

func FuzzRender(f *testing.F) {
	seedCorpus(f)
	f.Fuzz(func(t *testing.T, src string) {
		scope := jsontmpl.New()
		a, errA := jsontmpl.Render(src, scope)
		b, errB := jsontmpl.Render(src, scope)
		if (errA == nil) != (errB == nil) {
			t.Fatalf("non-deterministic error: errA=%v errB=%v", errA, errB)
		}
		if errA == nil && !bytes.Equal(a, b) {
			t.Fatalf("non-deterministic output:\n a=%s\n b=%s", a, b)
		}
	})
}
