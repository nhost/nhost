// Package token defines the lexical token types produced by the
// jsontmpl lexer. Layout mirrors Hasura Kriti's
// src/Kriti/Parser/Token.hs (Symbol / Token sum types). Token kinds
// here correspond 1:1 to those constructors so the lexer and parser
// can be ported directly.
package token

import "fmt"

// Position is a source location in the template. Line and Column are
// 0-indexed to match upstream's AlexSourcePos (Parser/Spans.hs).
// Offset is a byte offset into the raw template string.
type Position struct {
	Line   int
	Column int
	Offset int
}

// Span is a half-open range [Start, End) in the source template.
type Span struct {
	Start Position
	End   Position
}

// Kind identifies the syntactic category of a Token.
//
// The set of kinds mirrors upstream's Symbol and Token constructors
// (Token.hs:19-58):
//   - Single-character symbols and digraphs (SymBling..SymStringEnd).
//   - Literal-bearing tokens (StringLit, Identifier, NumLit, IntLit,
//     BoolLit).
//   - EOF as a sentinel.
type Kind int

const (
	KindEOF Kind = iota

	// Literal-bearing.
	KindStringLit
	KindIdentifier
	KindIntLit
	KindNumLit
	KindBoolLit

	// Symbols (Token.hs:20-46).
	KindBling             // $
	KindColon             // :
	KindDot               // .
	KindComma             // ,
	KindQuestionMark      // ?
	KindDoubleQuestionMark // ??
	KindEq                // ==
	KindNotEq             // !=
	KindGt                // >
	KindGte               // >=
	KindLt                // <
	KindLte               // <=
	KindAnd               // &&
	KindOr                // ||
	KindSingleQuote       // '
	KindCurlyOpen         // {
	KindCurlyClose        // }
	KindDoubleCurlyOpen   // {{
	KindDoubleCurlyClose  // }}
	KindSquareOpen        // [
	KindSquareClose       // ]
	KindParenOpen         // (
	KindParenClose        // )
	KindUnderscore        // _
	KindAssignment        // :=
	KindStringBegin       // " entering string mode
	KindStringEnd         // " leaving string mode
)

// String returns a short tag for the token kind. Useful in test
// goldens and error messages.
func (k Kind) String() string {
	switch k {
	case KindEOF:
		return "EOF"
	case KindStringLit:
		return "STRING_LIT"
	case KindIdentifier:
		return "IDENT"
	case KindIntLit:
		return "INT"
	case KindNumLit:
		return "NUMBER"
	case KindBoolLit:
		return "BOOL"
	case KindBling:
		return "$"
	case KindColon:
		return ":"
	case KindDot:
		return "."
	case KindComma:
		return ","
	case KindQuestionMark:
		return "?"
	case KindDoubleQuestionMark:
		return "??"
	case KindEq:
		return "=="
	case KindNotEq:
		return "!="
	case KindGt:
		return ">"
	case KindGte:
		return ">="
	case KindLt:
		return "<"
	case KindLte:
		return "<="
	case KindAnd:
		return "&&"
	case KindOr:
		return "||"
	case KindSingleQuote:
		return "'"
	case KindCurlyOpen:
		return "{"
	case KindCurlyClose:
		return "}"
	case KindDoubleCurlyOpen:
		return "{{"
	case KindDoubleCurlyClose:
		return "}}"
	case KindSquareOpen:
		return "["
	case KindSquareClose:
		return "]"
	case KindParenOpen:
		return "("
	case KindParenClose:
		return ")"
	case KindUnderscore:
		return "_"
	case KindAssignment:
		return ":="
	case KindStringBegin:
		return "STR_BEGIN"
	case KindStringEnd:
		return "STR_END"
	}
	return fmt.Sprintf("Kind(%d)", int(k))
}

// Token is one lexeme produced by the lexer. Text holds the raw
// source slice (useful for diagnostics and numeric reparsing); Bool
// is populated only for KindBoolLit.
type Token struct {
	Kind Kind
	Text string
	Bool bool
	Span Span
}

func (t Token) String() string {
	switch t.Kind {
	case KindStringLit, KindIdentifier, KindIntLit, KindNumLit:
		return fmt.Sprintf("%s(%q)", t.Kind, t.Text)
	case KindBoolLit:
		return fmt.Sprintf("BOOL(%t)", t.Bool)
	}
	return t.Kind.String()
}
