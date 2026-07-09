package funcs_test

import (
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl/eval"
	"github.com/nhost/nhost/internal/lib/jsontmpl/funcs"
)

// call looks up a builtin by name and invokes it, failing if it is absent.
func call(t *testing.T, name string, arg eval.Value) (eval.Value, error) {
	t.Helper()

	fn, ok := funcs.Basic()[name]
	if !ok {
		t.Fatalf("builtin %q not registered", name)
	}

	return fn(arg)
}

// marshal renders a Value to canonical JSON for structural comparison.
func marshal(t *testing.T, v eval.Value) string {
	t.Helper()

	b, err := json.Marshal(v, json.Deterministic(true))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	return string(b)
}

func obj(t *testing.T, kv ...any) eval.Object {
	t.Helper()

	o := eval.NewObject()
	for i := 0; i < len(kv); i += 2 {
		k, ok := kv[i].(string)
		if !ok {
			t.Fatalf("obj: key %d is not a string", i)
		}

		o.Set(k, kv[i+1])
	}

	return o
}

func TestBasic_RegistersExpectedNames(t *testing.T) {
	t.Parallel()

	want := []string{
		"empty", "size", "inverse", "head", "tail", "toCaseFold",
		"toLower", "toUpper", "toTitle", "escapeUri", "fromPairs",
		"toPairs", "removeNulls", "concat", "not",
	}

	got := funcs.Basic()
	for _, name := range want {
		if _, ok := got[name]; !ok {
			t.Errorf("missing builtin %q", name)
		}
	}

	if len(got) != len(want) {
		t.Errorf("Basic() has %d entries, want %d", len(got), len(want))
	}
}

func TestBuiltins_Success(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		fn   string
		arg  eval.Value
		want string
	}{
		{"empty array true", "empty", []eval.Value{}, `true`},
		{"empty string blank", "empty", "  ", `true`},
		{"empty nonblank false", "empty", "x", `false`},
		{"size array", "size", []eval.Value{1.0, 2.0, 3.0}, `3`},
		{"size string runes", "size", "héllo", `5`},
		{"inverse number", "inverse", 4.0, `0.25`},
		{"inverse bool", "inverse", true, `false`},
		{"inverse array", "inverse", []eval.Value{1.0, 2.0}, `[2,1]`},
		{"inverse string", "inverse", "ab", `"ba"`},
		{"head array", "head", []eval.Value{"a", "b"}, `"a"`},
		{"tail array", "tail", []eval.Value{1.0, 2.0, 3.0}, `[2,3]`},
		{"tail string", "tail", "abc", `"bc"`},
		{"toLower", "toLower", "ABC", `"abc"`},
		{"toUpper", "toUpper", "abc", `"ABC"`},
		{"escapeUri", "escapeUri", "a b/c", `"a%20b%2Fc"`},
		{"removeNulls", "removeNulls", []eval.Value{1.0, nil, 2.0}, `[1,2]`},
		{"concat arrays", "concat", []eval.Value{[]eval.Value{1.0}, []eval.Value{2.0}}, `[1,2]`},
		{"concat strings", "concat", []eval.Value{"a", "b"}, `"ab"`},
		{"not", "not", true, `false`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := call(t, tc.fn, tc.arg)
			if err != nil {
				t.Fatalf("%s: %v", tc.fn, err)
			}

			if s := marshal(t, got); s != tc.want {
				t.Fatalf("%s = %s, want %s", tc.fn, s, tc.want)
			}
		})
	}
}

func TestToPairsFromPairsRoundTrip(t *testing.T) {
	t.Parallel()

	in := obj(t, "a", 1.0, "b", 2.0)

	pairs, err := call(t, "toPairs", in)
	if err != nil {
		t.Fatalf("toPairs: %v", err)
	}

	if s := marshal(t, pairs); s != `[["a",1],["b",2]]` {
		t.Fatalf("toPairs = %s", s)
	}

	back, err := call(t, "fromPairs", pairs)
	if err != nil {
		t.Fatalf("fromPairs: %v", err)
	}

	if s := marshal(t, back); s != `{"a":1,"b":2}` {
		t.Fatalf("fromPairs = %s", s)
	}
}

func TestConcatObjectsRightmostWins(t *testing.T) {
	t.Parallel()

	arg := []eval.Value{
		obj(t, "a", 1.0, "b", 2.0),
		obj(t, "b", 9.0, "c", 3.0),
	}

	got, err := call(t, "concat", arg)
	if err != nil {
		t.Fatalf("concat: %v", err)
	}

	if s := marshal(t, got); s != `{"a":1,"b":9,"c":3}` {
		t.Fatalf("concat objects = %s", s)
	}
}

// TestDivergences pins the three documented cases where upstream Kriti
// crashes but the Go port returns a clean, typed error (see UPSTREAM.md).
func TestDivergences(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		fn      string
		arg     eval.Value
		wantMsg string
	}{
		{"inverse(0)", "inverse", 0.0, "Division by zero"},
		{"tail([])", "tail", []eval.Value{}, "Empty array"},
		{"tail(\"\")", "tail", "", "Empty string"},
		{"head([])", "head", []eval.Value{}, "Empty array"},
		{"head(\"\")", "head", "", "Empty string"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := call(t, tc.fn, tc.arg)
			if err == nil {
				t.Fatalf("%s: expected error, got nil", tc.fn)
			}

			if err.Error() != tc.wantMsg {
				t.Fatalf("%s error = %q, want %q", tc.fn, err.Error(), tc.wantMsg)
			}
		})
	}
}

func TestErrorPaths(t *testing.T) {
	t.Parallel()

	t.Run("empty rejects bool", func(t *testing.T) {
		t.Parallel()

		_, err := call(t, "empty", true)
		if err == nil || !strings.Contains(err.Error(), "boolean") {
			t.Fatalf("empty(bool) err = %v, want boolean message", err)
		}
	})

	t.Run("fromPairs rejects non-string key", func(t *testing.T) {
		t.Parallel()

		arg := []eval.Value{[]eval.Value{1.0, "v"}}

		_, err := call(t, "fromPairs", arg)
		if err == nil || !strings.Contains(err.Error(), "expected String") {
			t.Fatalf("fromPairs(numKey) err = %v", err)
		}
	})

	t.Run("concat rejects mixed object/non-object", func(t *testing.T) {
		t.Parallel()

		arg := []eval.Value{obj(t, "a", 1.0), 5.0}

		if _, err := call(t, "concat", arg); err == nil {
			t.Fatal("concat(mixed) expected error")
		}
	})

	t.Run("toLower rejects non-string", func(t *testing.T) {
		t.Parallel()

		if _, err := call(t, "toLower", 1.0); err == nil {
			t.Fatal("toLower(number) expected error")
		}
	})
}
