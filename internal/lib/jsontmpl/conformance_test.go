package jsontmpl_test

// Conformance suite. Vendored verbatim from the upstream
// hasura/kriti-lang test/data/ tree at the commit pinned in
// UPSTREAM.md. Each fixture is exercised through the public
// jsontmpl.Render API only — no internal hooks. The implementation is
// complete, so every fixture must pass (none are skipped).

import (
	"bytes"
	json "encoding/json/v2"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl"
)

const (
	evalDir          = "testdata/conformance/eval"
	parserSuccessDir = "testdata/conformance/parser/success"
	parserFailureDir = "testdata/conformance/parser/failure"
)

// TestConformance_Eval renders every example*.kriti template against
// the shared source.json and asserts byte-equal output (after JSON
// canonicalisation) with the corresponding golden file.
//
// Upstream binds the entire source.json to the single-character name
// "$"; see test/Spec.hs:178 in the upstream repo at the pinned commit.
func TestConformance_Eval(t *testing.T) {
	source := readFile(t, filepath.Join(evalDir, "source.json"))

	var sourceVal any
	if err := json.Unmarshal(source, &sourceVal); err != nil {
		t.Fatalf("decode source.json: %v", err)
	}

	examples, err := filepath.Glob(filepath.Join(evalDir, "examples", "*.kriti"))
	if err != nil {
		t.Fatalf("glob examples: %v", err)
	}

	if len(examples) == 0 {
		t.Fatalf("no fixtures found under %s", filepath.Join(evalDir, "examples"))
	}

	for _, path := range examples {
		name := strings.TrimSuffix(filepath.Base(path), ".kriti")
		t.Run(name, func(t *testing.T) {
			template := string(readFile(t, path))
			scope := jsontmpl.New().WithVar("$", sourceVal)

			got, err := jsontmpl.Render(template, scope)
			if err != nil {
				t.Fatalf("render: %v", err)
			}

			wantRaw := readFile(t, filepath.Join(evalDir, "golden", name+".json"))
			assertJSONEqual(t, wantRaw, got)
		})
	}
}

// TestConformance_ParserSuccess asserts every parser-success fixture
// renders without a Parse Error. Full AST-shape and span comparison
// against the upstream Haskell goldens lives in parser/golden_test.go;
// this case is the coarser "does it parse" smoke check at the public
// Render boundary, matching upstream's Spec.hs:142 assertion.
func TestConformance_ParserSuccess(t *testing.T) {
	examples, err := filepath.Glob(filepath.Join(parserSuccessDir, "examples", "*.kriti"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}

	if len(examples) == 0 {
		t.Fatalf("no fixtures found under %s", filepath.Join(parserSuccessDir, "examples"))
	}

	for _, path := range examples {
		name := strings.TrimSuffix(filepath.Base(path), ".kriti")
		t.Run(name, func(t *testing.T) {
			template := string(readFile(t, path))

			_, err := jsontmpl.Render(template, jsontmpl.New())
			// Eval may still fail (e.g. NameError on unbound vars used in
			// the fixture) — but a Parse Error is the only failure mode
			// we treat as a fixture violation. Other errors are fine.
			var jerr *jsontmpl.Error
			if errors.As(err, &jerr) && jerr.Code == jsontmpl.CodeParseError {
				t.Fatalf("unexpected parse error: %v", err)
			}
		})
	}
}

// TestConformance_ParserFailure asserts every parser-failure fixture
// produces a Parse Error. The exact error message and span are not
// asserted here; once we settle on parser-error parity we can lift
// the (line, col) assertions from the upstream goldens. For v1, "did
// fail to parse" is the correctness signal.
func TestConformance_ParserFailure(t *testing.T) {
	examples, err := filepath.Glob(filepath.Join(parserFailureDir, "examples", "*.kriti"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}

	if len(examples) == 0 {
		t.Fatalf("no fixtures found under %s", filepath.Join(parserFailureDir, "examples"))
	}

	for _, path := range examples {
		name := strings.TrimSuffix(filepath.Base(path), ".kriti")
		t.Run(name, func(t *testing.T) {
			template := string(readFile(t, path))

			_, err := jsontmpl.Render(template, jsontmpl.New())
			if err == nil {
				t.Fatalf("expected parse error, got nil")
			}

			var jerr *jsontmpl.Error
			if !errors.As(err, &jerr) {
				t.Fatalf("expected *jsontmpl.Error, got %T: %v", err, err)
			}

			if jerr.Code != jsontmpl.CodeParseError {
				t.Fatalf("expected Parse Error, got %q: %v", jerr.Code, err)
			}
		})
	}
}

// readFile is a small helper that t.Fatals on read failure so call
// sites stay tight.
func readFile(t *testing.T, path string) []byte {
	t.Helper()

	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}

	return b
}

// assertJSONEqual canonicalises both sides via json.Unmarshal +
// json.Marshal before comparing. This makes whitespace/key-order
// differences from json.Encode irrelevant, while still catching real
// structural or value differences. Upstream golden files use Aeson's
// pretty-printer; ours use Go's compact encoder.
func assertJSONEqual(t *testing.T, want, got []byte) {
	t.Helper()
	wantCanon := canonicaliseJSON(t, want)

	gotCanon := canonicaliseJSON(t, got)
	if !bytes.Equal(wantCanon, gotCanon) {
		t.Fatalf("JSON mismatch\nwant: %s\ngot:  %s", wantCanon, gotCanon)
	}
}

func canonicaliseJSON(t *testing.T, raw []byte) []byte {
	t.Helper()

	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("canonicalise: %v\nraw: %s", err, raw)
	}
	// Deterministic(true): encoding/json/v2 randomises map key order, so
	// both sides must be sorted to compare byte-for-byte.
	out, err := json.Marshal(v, json.Deterministic(true))
	if err != nil {
		t.Fatalf("canonicalise marshal: %v", err)
	}

	return out
}
