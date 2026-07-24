package python_test

import (
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor/python"
)

func TestPyReturnType(t *testing.T) {
	t.Parallel()

	p := &python.Python{}

	fn, ok := p.GetFuncMap()["pyReturnType"].(func(string) string)
	if !ok {
		t.Fatal("pyReturnType not registered as func(string) string")
	}

	cases := map[string]string{
		"":                 "None",
		"void":             "None",
		"SomeType":         "SomeType",
		"SomeType | void":  "SomeType | None",
		"void | SomeType":  "None | SomeType",
		"Avoidance":        "Avoidance",        // real name containing "void" is untouched
		"Avoidance | void": "Avoidance | None", // only the sentinel is mapped
		"list[Avoidance]":  "list[Avoidance]",  // nested name with "void" is untouched
	}

	for in, want := range cases {
		if got := fn(in); got != want {
			t.Errorf("pyReturnType(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTypeEnumValues(t *testing.T) {
	t.Parallel()

	p := &python.Python{}
	got := p.TypeEnumValues([]any{"packed", true, false, nil, 1, 2.5})
	want := []string{`"packed"`, "True", "False", "None", "1", "2.5"}

	if len(got) != len(want) {
		t.Fatalf("TypeEnumValues length = %d, want %d (%v)", len(got), len(want), got)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Errorf("TypeEnumValues[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
