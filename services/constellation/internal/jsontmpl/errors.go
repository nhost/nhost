package jsontmpl

import (
	json "encoding/json/v2"
	"fmt"
)

// ErrorCode is the error code surfaced as the "error_code" field in
// serialised errors. Strings match upstream Kriti exactly
// (third-party/hasura/kriti-lang/src/Kriti/Error.hs:23-30) because
// the dashboard's template-error UI reads them.
type ErrorCode string

const (
	CodeInvalidPath    ErrorCode = "Invalid Path"
	CodeAttributeError ErrorCode = "Attribute Error"
	CodeNameError      ErrorCode = "Name Error"
	CodeTypeError      ErrorCode = "Type Error"
	CodeIndexError     ErrorCode = "Index Error"
	CodeParseError     ErrorCode = "Parse Error"
	CodeLexError       ErrorCode = "Lex Error"
	CodeFunctionError  ErrorCode = "Function Error"
)

// Position is a 0-indexed (line, column) location in the source
// template. Matches AlexSourcePos in upstream's
// src/Kriti/Parser/Spans.hs.
type Position struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// Span is a contiguous range in the source template.
type Span struct {
	Start Position
	End   Position
}

// Error is the typed error every template operation can return. Its
// JSON form matches upstream Kriti's SerializedError (Error.hs:36) so
// the dashboard error UI works unchanged.
type Error struct {
	Code    ErrorCode
	Message string
	Span    Span
	Cause   error
}

func (e *Error) Error() string {
	if e == nil {
		return "<nil jsontmpl error>"
	}
	return fmt.Sprintf(
		"%s at %d:%d: %s",
		e.Code, e.Span.Start.Line, e.Span.Start.Column, e.Message,
	)
}

func (e *Error) Unwrap() error { return e.Cause }

// MarshalJSON emits the upstream SerializedError shape:
//
//	{
//	  "error_code": "Type Error",
//	  "message":    "...",
//	  "source_position": {
//	    "start_line": 0, "start_column": 0,
//	    "end_line":   0, "end_column":   0
//	  }
//	}
func (e *Error) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		ErrorCode      ErrorCode `json:"error_code"`
		Message        string    `json:"message"`
		SourcePosition struct {
			StartLine   int `json:"start_line"`
			StartColumn int `json:"start_column"`
			EndLine     int `json:"end_line"`
			EndColumn   int `json:"end_column"`
		} `json:"source_position"`
	}{
		ErrorCode: e.Code,
		Message:   e.Message,
		SourcePosition: struct {
			StartLine   int `json:"start_line"`
			StartColumn int `json:"start_column"`
			EndLine     int `json:"end_line"`
			EndColumn   int `json:"end_column"`
		}{
			StartLine:   e.Span.Start.Line,
			StartColumn: e.Span.Start.Column,
			EndLine:     e.Span.End.Line,
			EndColumn:   e.Span.End.Column,
		},
	})
}
