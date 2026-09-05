package eval

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/token"
)

// ErrorCode mirrors jsontmpl.ErrorCode. Defining locally avoids an
// import cycle (eval is used by the render package which is re-exported
// from jsontmpl). The render package translates these into
// *jsontmpl.Error.
type ErrorCode string

const (
	CodeAttribute ErrorCode = "Attribute Error"
	CodeName      ErrorCode = "Name Error"
	CodeType      ErrorCode = "Type Error"
	CodeIndex     ErrorCode = "Index Error"
	CodeFunction  ErrorCode = "Function Error"
)

// Error is a typed eval failure.
type Error struct {
	Code ErrorCode
	Msg  string
	Span token.Span
}

func (e *Error) Error() string {
	return fmt.Sprintf(
		"%s at %d:%d: %s",
		e.Code, e.Span.Start.Line, e.Span.Start.Column, e.Msg,
	)
}

func nameError(sp token.Span, name string) *Error {
	return &Error{Code: CodeName, Msg: fmt.Sprintf("Variable %q not in scope", name), Span: sp}
}

func attrError(sp token.Span, attr string) *Error {
	// Message matches upstream verbatim (Eval.hs:34): the dashboard
	// regex-matches on this string.
	return &Error{
		Code: CodeAttribute,
		Msg:  fmt.Sprintf("'Object' has no attribute '%s'", attr),
		Span: sp,
	}
}

func typeError(sp token.Span, actualName, expected string) *Error {
	return &Error{
		Code: CodeType,
		Msg: fmt.Sprintf(
			"Couldn't match expected type '%s' with actual type '%s'",
			expected,
			actualName,
		),
		Span: sp,
	}
}

func indexError(sp token.Span, msg string) *Error {
	if msg == "" {
		msg = "Index out of range"
	}
	return &Error{Code: CodeIndex, Msg: msg, Span: sp}
}

func functionError(sp token.Span, msg string) *Error {
	return &Error{Code: CodeFunction, Msg: msg, Span: sp}
}
