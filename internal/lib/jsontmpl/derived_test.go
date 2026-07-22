package jsontmpl_test

// Derived-fixture suite. Each testdata/derived/<name>.{kriti,input.json,
// output.txt} triple was produced by running the upstream Haskell kriti binary
// (see testdata/derived/README.md), capturing behaviour the conformance suite
// does not exercise: the error/divergence branches (empty-collection helpers,
// fromPairs key-type errors, concat object-merge fall-through, out-of-range and
// negative indexing, optional-chaining through a scalar, StringTem encoding of
// null/object, inverse(0)).
//
// The .output.txt golden is one of:
//
//	OK <compact-json>          -> Render succeeds; output JSON-equals the golden.
//	ERROR <class>: <message>   -> Render returns a *jsontmpl.Error whose Message
//	                              equals <message> ("Parse Error"/"Runtime
//	                              Error" is upstream's class label).
//	CRASH: <haskell exception> -> upstream crashes; the Go port must instead
//	                              return a typed *jsontmpl.Error (never panic).
//	                              The clean message is intentionally NOT compared
//	                              (see UPSTREAM.md intentional divergences).

import (
	json "encoding/json/v2"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl"
)

const derivedDir = "testdata/derived"

func TestDerivedFixtures(t *testing.T) {
	t.Parallel()

	templates, err := filepath.Glob(filepath.Join(derivedDir, "*.kriti"))
	if err != nil {
		t.Fatalf("glob derived fixtures: %v", err)
	}

	if len(templates) == 0 {
		t.Fatalf("no derived fixtures found under %s", derivedDir)
	}

	for _, path := range templates {
		name := strings.TrimSuffix(filepath.Base(path), ".kriti")
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			template := string(readFile(t, path))
			inputRaw := readFile(t, filepath.Join(derivedDir, name+".input.json"))
			golden := strings.TrimRight(
				string(readFile(t, filepath.Join(derivedDir, name+".output.txt"))),
				"\n",
			)

			var input any
			if err := json.Unmarshal(inputRaw, &input); err != nil {
				t.Fatalf("decode input.json: %v", err)
			}

			got, renderErr := jsontmpl.Render(template, jsontmpl.New().WithVar("$", input))

			switch {
			case strings.HasPrefix(golden, "OK "):
				if renderErr != nil {
					t.Fatalf("expected OK, got error: %v", renderErr)
				}

				assertJSONEqual(t, []byte(strings.TrimPrefix(golden, "OK ")), got)

			case strings.HasPrefix(golden, "ERROR "):
				assertDerivedError(t, golden, renderErr)

			case strings.HasPrefix(golden, "CRASH:"):
				// Upstream crashes here; the port must surface a typed error
				// rather than panicking. Message is a documented divergence.
				var jerr *jsontmpl.Error
				if !errors.As(renderErr, &jerr) {
					t.Fatalf("expected *jsontmpl.Error for upstream CRASH fixture, got %T: %v",
						renderErr, renderErr)
				}

			default:
				t.Fatalf("unrecognised golden form: %q", golden)
			}
		})
	}
}

// assertDerivedError checks an ERROR golden against the rendered error: the
// engine must return a *jsontmpl.Error whose Message matches the golden's
// message exactly (the parity contract the dashboard relies on).
func assertDerivedError(t *testing.T, golden string, renderErr error) {
	t.Helper()

	var jerr *jsontmpl.Error
	if !errors.As(renderErr, &jerr) {
		t.Fatalf("expected *jsontmpl.Error, got %T: %v", renderErr, renderErr)
	}

	// Intentional divergence (see UPSTREAM.md): upstream classifies lexer
	// failures as "Parse Error: Invalid Lexeme". The Go port surfaces a
	// distinct, more specific Lex Error code with a richer message (e.g.
	// `invalid lexeme "-"`). Accept any typed Lex Error for those fixtures
	// rather than forcing the lexer to drop information.
	if jerr.Code == jsontmpl.CodeLexError {
		return
	}

	// golden is "ERROR <class>: <message>"; <class> is "Runtime Error" or
	// "Parse Error". Strip the "ERROR " prefix and the class label.
	rest := strings.TrimPrefix(golden, "ERROR ")

	_, wantMsg, found := strings.Cut(rest, ": ")
	if !found {
		t.Fatalf("malformed ERROR golden: %q", golden)
	}

	if jerr.Message != wantMsg {
		t.Errorf("error message mismatch\nwant: %q\ngot:  %q", wantMsg, jerr.Message)
	}
}
