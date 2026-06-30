package jsontmpl_test

// Smoke tests for the parts of the public API that don't depend on
// Render: Scope construction and Error JSON serialisation. These run
// today (not skipped) and lock in the surface that downstream callers
// in Constellation will start writing against immediately.

import (
	json "encoding/json/v2"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl"
)

func TestRender_TrivialObject(t *testing.T) {
	got, err := jsontmpl.Render(`{"x": 1}`, jsontmpl.New())
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if string(got) != `{"x":1}` {
		t.Fatalf("got %s, want {\"x\":1}", got)
	}
}

func TestError_JSONShape_MatchesUpstream(t *testing.T) {
	// Mirrors third-party/hasura/kriti-lang/src/Kriti/Error.hs:36.
	// The dashboard's template-error UI reads error_code and
	// source_position; changing the shape silently breaks it.
	e := &jsontmpl.Error{
		Code:    jsontmpl.CodeTypeError,
		Message: "Couldn't match expected type 'Boolean' with actual type 'String'",
		Span: jsontmpl.Span{
			Start: jsontmpl.Position{Line: 3, Column: 14},
			End:   jsontmpl.Position{Line: 3, Column: 21},
		},
	}

	got, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	want := `{"error_code":"Type Error","message":"Couldn't match expected type 'Boolean' with actual type 'String'","source_position":{"start_line":3,"start_column":14,"end_line":3,"end_column":21}}`
	if string(got) != want {
		t.Fatalf("error JSON mismatch\nwant: %s\ngot:  %s", want, got)
	}
}

func TestError_CodesMatchUpstreamStrings(t *testing.T) {
	// Lock in every error-code string. These are the exact prettified
	// forms from src/Kriti/Error.hs:23-30 — the dashboard switches on
	// them.
	cases := []struct {
		code jsontmpl.ErrorCode
		want string
	}{
		{jsontmpl.CodeInvalidPath, "Invalid Path"},
		{jsontmpl.CodeAttributeError, "Attribute Error"},
		{jsontmpl.CodeNameError, "Name Error"},
		{jsontmpl.CodeTypeError, "Type Error"},
		{jsontmpl.CodeIndexError, "Index Error"},
		{jsontmpl.CodeParseError, "Parse Error"},
		{jsontmpl.CodeLexError, "Lex Error"},
		{jsontmpl.CodeFunctionError, "Function Error"},
	}
	for _, c := range cases {
		if string(c.code) != c.want {
			t.Errorf("code %v = %q, want %q", c.want, string(c.code), c.want)
		}
	}
}
