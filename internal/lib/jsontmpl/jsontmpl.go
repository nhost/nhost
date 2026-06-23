// Package jsontmpl is a Go port of hasura/kriti-lang, the JSON
// templating language Hasura uses for action / event-trigger / cron /
// connection transforms. "Kriti" is the upstream language name; this
// package implements the same semantics under a Hasura-neutral Go
// package name.
//
// Render lexes, parses, and evaluates templates against a Scope; the
// upstream conformance suite passes. Validate runs lex+parse only,
// for compile-time syntax checking of stored templates.
//
// Source of truth: the upstream hasura/kriti-lang repository at the
// commit pinned in UPSTREAM.md (no in-tree clone is kept).
package jsontmpl

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"maps"

	"github.com/nhost/nhost/internal/lib/jsontmpl/eval"
	"github.com/nhost/nhost/internal/lib/jsontmpl/funcs"
	"github.com/nhost/nhost/internal/lib/jsontmpl/lexer"
	"github.com/nhost/nhost/internal/lib/jsontmpl/parser"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// Validate checks that template lexes and parses, returning a non-nil
// *Error (with a Code of CodeLexError or CodeParseError and source span)
// when it does not. It performs no evaluation, so it never reports
// undefined-variable or type errors — use it to reject malformed
// templates at metadata-application time, before any scope exists. The
// parsed form is cached, so a subsequent Render of the same template
// skips re-parsing.
func Validate(template string) error {
	if _, ok := cache().get(template); ok {
		return nil
	}

	toks, err := lexer.Lex(template)
	if err != nil {
		return wrapLexErr(err)
	}

	root, err := parser.Parse(toks)
	if err != nil {
		return wrapParseErr(err)
	}

	cache().put(template, root)

	return nil
}

// Render evaluates a JSON template against the given Scope and
// returns the resulting JSON document. Template syntax and semantics
// match hasura/kriti-lang exactly.
//
// See UPSTREAM.md for the upstream pin, the intentional divergences,
// and the conformance suite this function is graded against.
func Render(template string, scope Scope) (jsontext.Value, error) {
	root, ok := cache().get(template)
	if !ok {
		toks, err := lexer.Lex(template)
		if err != nil {
			return nil, wrapLexErr(err)
		}

		root, err = parser.Parse(toks)
		if err != nil {
			return nil, wrapParseErr(err)
		}

		cache().put(template, root)
	}

	bindings := make([]eval.Binding, 0, len(scope.vars))
	for _, b := range scope.vars {
		v, err := eval.FromJSON([]byte(b.Value))
		if err != nil {
			return nil, &Error{Code: CodeTypeError, Message: "scope decode: " + err.Error()}
		}

		bindings = append(bindings, eval.Binding{Name: b.Name, Value: v})
	}

	fm := funcs.Basic()
	for name, fn := range scope.funcs {
		caller := fn // capture
		fm[name] = func(arg eval.Value) (eval.Value, error) {
			rawArg, err := json.Marshal(arg, json.Deterministic(true))
			if err != nil {
				return nil, err
			}

			rawRes, err := caller(rawArg)
			if err != nil {
				return nil, err
			}

			return eval.FromJSON(rawRes)
		}
	}

	result, err := eval.Eval(root, bindings, fm)
	if err != nil {
		return nil, wrapEvalErr(err)
	}

	return json.Marshal(result, json.Deterministic(true))
}

func wrapLexErr(err error) error {
	var le *lexer.Error
	if errors.As(err, &le) {
		return &Error{
			Code:    CodeLexError,
			Message: le.Msg,
			Span:    convertSpan(le.Span),
			Cause:   err,
		}
	}

	return &Error{Code: CodeLexError, Message: err.Error(), Cause: err}
}

func wrapParseErr(err error) error {
	var pe *parser.Error
	if errors.As(err, &pe) {
		return &Error{
			Code:    CodeParseError,
			Message: pe.Msg,
			Span:    convertSpan(pe.Span),
			Cause:   err,
		}
	}

	return &Error{Code: CodeParseError, Message: err.Error(), Cause: err}
}

func wrapEvalErr(err error) error {
	var ee *eval.Error
	if errors.As(err, &ee) {
		return &Error{
			Code:    ErrorCode(ee.Code),
			Message: ee.Msg,
			Span:    convertSpan(ee.Span),
			Cause:   err,
		}
	}

	return &Error{Code: CodeTypeError, Message: err.Error(), Cause: err}
}

func convertSpan(s token.Span) Span {
	return Span{
		Start: Position{Line: s.Start.Line, Column: s.Start.Column},
		End:   Position{Line: s.End.Line, Column: s.End.Column},
	}
}

// Scope holds the variable bindings and overlay function map for a
// single render. Construct it with the generic New + WithVar + WithFunc
// combinators. The per-transform variable-name parity (which Hasura
// variables to bind for action/event/cron/response transforms) is owned
// by the consuming connector/action/transform package, which builds its
// own scope from those names.
//
// Zero value is a valid empty scope.
type Scope struct {
	// vars preserves insertion order; later entries shadow earlier
	// on lookup. Mirrors upstream's [(Text, Value)] association list.
	vars  []binding
	funcs map[string]Func
}

type binding struct {
	Name  string
	Value jsontext.Value
}

// Func is a template function: a single-argument JSON->JSON
// transformation. Returning a non-nil error surfaces as a
// FunctionError at the call site.
type Func func(arg jsontext.Value) (jsontext.Value, error)

// New returns an empty Scope.
func New() Scope { return Scope{} }

// WithVar binds a variable in the scope. The value is JSON-marshalled
// once. Later bindings of the same name shadow earlier ones, matching
// upstream's Compat.fromList semantics.
//
// If v cannot be JSON-marshalled (e.g. a channel, func, or cyclic
// value), WithVar binds JSON null rather than panicking or returning an
// error: an unmarshalable scope value is a caller programming error,
// and surfacing it here would force every fluent call site to handle an
// error that cannot occur for the JSON-derived values transforms
// actually bind. The null binding still yields a Kriti-shaped
// Name/Type error at Render time. Pass only JSON-marshalable values.
func (s Scope) WithVar(name string, v any) Scope {
	// Deterministic(true) sorts map keys so the same input always yields
	// the same scope encoding (encoding/json/v2 randomises map order).
	raw, err := json.Marshal(v, json.Deterministic(true))
	if err != nil {
		// Marshaling failures are a programming error in the caller,
		// not a template-time concern. We surface them as a Null
		// binding so the eventual Render still produces a Kriti-shaped
		// error, never a panic.
		raw = jsontext.Value(`null`)
	}

	out := Scope{vars: append([]binding(nil), s.vars...), funcs: s.funcs}
	out.vars = append(out.vars, binding{Name: name, Value: raw})

	return out
}

// WithFunc registers (or overrides) a function in the scope's overlay
// map. Overlay functions are merged on top of basicFuncMap at render
// time.
func (s Scope) WithFunc(name string, fn Func) Scope {
	out := Scope{vars: append([]binding(nil), s.vars...)}

	out.funcs = make(map[string]Func, len(s.funcs)+1)
	maps.Copy(out.funcs, s.funcs)

	out.funcs[name] = fn

	return out
}
