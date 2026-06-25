// Package lexer tokenises jsontmpl source. Hand-rolled mode-stack
// scanner port of Hasura Kriti's Alex grammar
// (third-party/hasura/kriti-lang/src/Kriti/Parser/Lexer.x).
//
// Four lexer modes, mirroring upstream's Alex start codes
// (Lexer.x:11-13):
//
//	modeInit    — top-level template text. JSON-like.
//	modeExpr    — inside {{ ... }}. Reads Kriti expressions.
//	modeString  — inside "..." JSON string literals.
//	modeLiteral — inside '...' single-quoted strings, used for object
//	              key lookups; reachable only from modeInit/modeExpr.
//
// Mode transitions (Lexer.x:55-86):
//
//	init|expr  "  -> push string, emit StringBegin
//	string     "  -> pop, emit StringEnd
//	string     {{ -> push expr, emit DoubleCurlyOpen
//	expr       }} -> pop, emit DoubleCurlyClose
//	init|expr  '  -> push literal, emit SingleQuote
//	literal    '  -> pop, emit SingleQuote
//	init|expr  {{ -> push expr, emit DoubleCurlyOpen (top-level only)
package lexer

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// Error is a typed lexer failure carrying a span.
type Error struct {
	Msg  string
	Span token.Span
}

func (e *Error) Error() string {
	return fmt.Sprintf("lex error at %d:%d: %s",
		e.Span.Start.Line, e.Span.Start.Column, e.Msg)
}

// Lex tokenises src. The returned token slice always ends with a
// KindEOF token, mirroring upstream's EOF sentinel (Token.hs:53).
func Lex(src string) ([]token.Token, error) {
	l := &lexer{src: src}
	l.pushMode(modeInit)
	for !l.eof() {
		if err := l.step(); err != nil {
			return nil, err
		}
	}
	l.emit(token.Token{Kind: token.KindEOF, Span: token.Span{Start: l.pos, End: l.pos}})
	return l.out, nil
}

type mode int

const (
	modeInit mode = iota
	modeExpr
	modeString
	modeLiteral
)

type lexer struct {
	src   string
	pos   token.Position // current position (byte offset + line/col)
	modes []mode
	out   []token.Token
}

func (l *lexer) pushMode(m mode) { l.modes = append(l.modes, m) }
func (l *lexer) popMode() {
	if len(l.modes) > 0 {
		l.modes = l.modes[:len(l.modes)-1]
	}
}

func (l *lexer) mode() mode {
	if len(l.modes) == 0 {
		return modeInit
	}
	return l.modes[len(l.modes)-1]
}

func (l *lexer) eof() bool { return l.pos.Offset >= len(l.src) }

// peek returns the byte at offset relative to the current position
// (default 0). 0 if past EOF.
func (l *lexer) peek(off int) byte {
	i := l.pos.Offset + off
	if i >= len(l.src) {
		return 0
	}
	return l.src[i]
}

// has2 reports whether the next two bytes match s.
func (l *lexer) has2(s string) bool {
	if len(s) != 2 {
		return false
	}
	return l.peek(0) == s[0] && l.peek(1) == s[1]
}

// advanceN advances n bytes, updating line/col. Assumes the consumed
// bytes do not contain mid-codepoint splits.
func (l *lexer) advanceN(n int) {
	end := min(l.pos.Offset+n, len(l.src))
	for l.pos.Offset < end {
		r, size := utf8.DecodeRuneInString(l.src[l.pos.Offset:])
		if r == '\n' {
			l.pos.Line++
			l.pos.Column = 0
		} else {
			l.pos.Column++
		}
		l.pos.Offset += size
	}
}

func (l *lexer) emit(t token.Token) { l.out = append(l.out, t) }

func (l *lexer) errAt(start token.Position, msg string) error {
	return &Error{Msg: msg, Span: token.Span{Start: start, End: l.pos}}
}

// step consumes one logical token (or whitespace/comment) and emits
// any resulting tokens.
func (l *lexer) step() error {
	switch l.mode() {
	case modeInit, modeExpr:
		return l.stepCode()
	case modeString:
		return l.stepString()
	case modeLiteral:
		return l.stepLiteral()
	}
	return l.errAt(l.pos, fmt.Sprintf("unknown lexer mode %d", l.mode()))
}

// stepCode handles modeInit and modeExpr. They share almost every
// rule; the only mode-specific behaviour is }} (pops expr).
func (l *lexer) stepCode() error {
	// Whitespace.
	c := l.peek(0)
	if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
		l.advanceN(1)
		return nil
	}
	// Comments: # to end of line.
	if c == '#' {
		for !l.eof() && l.peek(0) != '\n' {
			l.advanceN(1)
		}
		return nil
	}

	start := l.pos

	// String entry. " pushes string mode.
	if c == '"' {
		l.advanceN(1)
		l.pushMode(modeString)
		l.emit(
			token.Token{
				Kind: token.KindStringBegin,
				Text: `"`,
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	// Single-quote: enter literal mode.
	if c == '\'' {
		l.advanceN(1)
		l.pushMode(modeLiteral)
		l.emit(
			token.Token{
				Kind: token.KindSingleQuote,
				Text: "'",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	// Digraphs first.
	if l.has2("{{") {
		l.advanceN(2)
		l.pushMode(modeExpr)
		l.emit(
			token.Token{
				Kind: token.KindDoubleCurlyOpen,
				Text: "{{",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	// }} only matches in modeExpr (Lexer.x:75). At top level we treat
	// two }'s as two CurlyClose tokens, so JSON like `[true]}}` lexes.
	if l.mode() == modeExpr && l.has2("}}") {
		l.advanceN(2)
		l.popMode()
		l.emit(
			token.Token{
				Kind: token.KindDoubleCurlyClose,
				Text: "}}",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2("==") {
		l.advanceN(2)
		l.emit(
			token.Token{Kind: token.KindEq, Text: "==", Span: token.Span{Start: start, End: l.pos}},
		)
		return nil
	}
	if l.has2("!=") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindNotEq,
				Text: "!=",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2(">=") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindGte,
				Text: ">=",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2("<=") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindLte,
				Text: "<=",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2("&&") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindAnd,
				Text: "&&",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2("||") {
		l.advanceN(2)
		l.emit(
			token.Token{Kind: token.KindOr, Text: "||", Span: token.Span{Start: start, End: l.pos}},
		)
		return nil
	}
	if l.has2("??") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindDoubleQuestionMark,
				Text: "??",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2(":=") {
		l.advanceN(2)
		l.emit(
			token.Token{
				Kind: token.KindAssignment,
				Text: ":=",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}

	// Numbers. Try the JSON-number form first (it's a superset of
	// IntLit when a decimal or exponent is present). The Alex grammar
	// resolves overlap by longest-match; we replicate by lookahead.
	if isNumStart(c) || (c == '-' && isDigit(l.peek(1))) {
		return l.lexNumber()
	}

	// Identifiers and keywords. An identifier is `\$? $alpha [..]*`.
	// Optional leading $, but $ alone is also a valid identifier.
	if c == '$' || isAlpha(c) {
		return l.lexIdent()
	}

	// Single-character symbols.
	switch c {
	case ':':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindColon,
				Text: ":",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '.':
		l.advanceN(1)
		l.emit(
			token.Token{Kind: token.KindDot, Text: ".", Span: token.Span{Start: start, End: l.pos}},
		)
		return nil
	case ',':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindComma,
				Text: ",",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '?':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindQuestionMark,
				Text: "?",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '>':
		l.advanceN(1)
		l.emit(
			token.Token{Kind: token.KindGt, Text: ">", Span: token.Span{Start: start, End: l.pos}},
		)
		return nil
	case '<':
		l.advanceN(1)
		l.emit(
			token.Token{Kind: token.KindLt, Text: "<", Span: token.Span{Start: start, End: l.pos}},
		)
		return nil
	case '_':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindUnderscore,
				Text: "_",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '{':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindCurlyOpen,
				Text: "{",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '}':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindCurlyClose,
				Text: "}",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '[':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindSquareOpen,
				Text: "[",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case ']':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindSquareClose,
				Text: "]",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case '(':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindParenOpen,
				Text: "(",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	case ')':
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindParenClose,
				Text: ")",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}

	return l.errAt(start, fmt.Sprintf("invalid lexeme %q", string(rune(c))))
}

// lexNumber consumes a numeric literal. Distinguishes IntLit (no
// decimal, no exponent) from NumLit, matching the Alex regexes at
// Lexer.x:103-104:
//
//	IntLit: -? [0-9]+
//	NumLit: -?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?
//
// Longest-match resolves overlap. We implement: scan optional minus +
// digits, then a *NumLit-only* tail (decimal and/or exponent). If the
// tail is present, classify as NumLit; otherwise IntLit.
func (l *lexer) lexNumber() error {
	start := l.pos
	startOff := l.pos.Offset
	if l.peek(0) == '-' {
		l.advanceN(1)
	}
	// Digit run.
	hasDigit := false
	for isDigit(l.peek(0)) {
		l.advanceN(1)
		hasDigit = true
	}
	if !hasDigit {
		return l.errAt(start, "expected digits after '-'")
	}

	isFloat := false
	// Fraction.
	if l.peek(0) == '.' && isDigit(l.peek(1)) {
		l.advanceN(1)
		for isDigit(l.peek(0)) {
			l.advanceN(1)
		}
		isFloat = true
	}
	// Exponent.
	if c := l.peek(0); c == 'e' || c == 'E' {
		// Peek past optional sign and require at least one digit; if not
		// present, don't consume the 'e' — leave it for ident lex.
		save := l.pos
		l.advanceN(1)
		if c2 := l.peek(0); c2 == '+' || c2 == '-' {
			l.advanceN(1)
		}
		if !isDigit(l.peek(0)) {
			// Roll back: no valid exponent, restore position before 'e'.
			l.pos = save
		} else {
			for isDigit(l.peek(0)) {
				l.advanceN(1)
			}
			isFloat = true
		}
	}

	text := l.src[startOff:l.pos.Offset]
	kind := token.KindIntLit
	if isFloat {
		kind = token.KindNumLit
	}
	l.emit(token.Token{Kind: kind, Text: text, Span: token.Span{Start: start, End: l.pos}})
	return nil
}

// lexIdent consumes an identifier, with two special cases that the
// upstream lexer also recognises:
//
//   - `true` / `false` emit KindBoolLit (Lexer.x:24-25).
//   - bare `$` is a valid identifier of text "$" (Lexer.x:28).
//
// All other keyword-like tokens (`if`, `else`, `elif`, `end`,
// `range`, `not`, `in`, `null`) are plain identifiers at the lexer
// level; the parser matches them by text.
func (l *lexer) lexIdent() error {
	start := l.pos
	startOff := l.pos.Offset
	// Optional leading $.
	if l.peek(0) == '$' {
		l.advanceN(1)
	}
	hasAlpha := false
	for {
		c := l.peek(0)
		if isAlpha(c) {
			hasAlpha = true
			l.advanceN(1)
			continue
		}
		if hasAlpha && (isDigit(c) || c == '_' || c == '-' || c == '$') {
			l.advanceN(1)
			continue
		}
		break
	}
	text := l.src[startOff:l.pos.Offset]
	// `$` alone is valid (Lexer.x:28 emits TokIdentifier "$").
	if text == "$" {
		l.emit(
			token.Token{
				Kind: token.KindIdentifier,
				Text: "$",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if !hasAlpha {
		return l.errAt(start, fmt.Sprintf("invalid lexeme %q", text))
	}
	switch text {
	case "true":
		l.emit(
			token.Token{
				Kind: token.KindBoolLit,
				Text: text,
				Bool: true,
				Span: token.Span{Start: start, End: l.pos},
			},
		)
	case "false":
		l.emit(
			token.Token{
				Kind: token.KindBoolLit,
				Text: text,
				Bool: false,
				Span: token.Span{Start: start, End: l.pos},
			},
		)
	default:
		l.emit(
			token.Token{
				Kind: token.KindIdentifier,
				Text: text,
				Span: token.Span{Start: start, End: l.pos},
			},
		)
	}
	return nil
}

// stepString handles modeString. Per Lexer.x:57-78 the recognised
// productions are: escape sequences, plain segments (anything but
// \, ", {), a single `{`, the digraph `{{` (push expr), and `"`
// (pop, emit StringEnd).
func (l *lexer) stepString() error {
	c := l.peek(0)
	start := l.pos

	if c == '"' {
		l.advanceN(1)
		l.popMode()
		l.emit(
			token.Token{
				Kind: token.KindStringEnd,
				Text: `"`,
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if l.has2("{{") {
		l.advanceN(2)
		l.pushMode(modeExpr)
		l.emit(
			token.Token{
				Kind: token.KindDoubleCurlyOpen,
				Text: "{{",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	// Single '{' is a literal { in upstream.
	if c == '{' {
		l.advanceN(1)
		l.emit(
			token.Token{
				Kind: token.KindStringLit,
				Text: "{",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	// Escape sequence.
	if c == '\\' {
		return l.lexStringEscape()
	}
	// Plain run.
	var sb strings.Builder
	for !l.eof() {
		c := l.peek(0)
		if c == '\\' || c == '"' || c == '{' {
			break
		}
		_, size := utf8.DecodeRuneInString(l.src[l.pos.Offset:])
		sb.WriteString(l.src[l.pos.Offset : l.pos.Offset+size])
		l.advanceN(size)
	}
	if sb.Len() == 0 {
		return l.errAt(start, "unterminated string")
	}
	l.emit(
		token.Token{
			Kind: token.KindStringLit,
			Text: sb.String(),
			Span: token.Span{Start: start, End: l.pos},
		},
	)
	return nil
}

// lexStringEscape consumes a single escape sequence in modeString and
// emits a KindStringLit token for the decoded text. Per Lexer.x:57-67.
func (l *lexer) lexStringEscape() error {
	start := l.pos
	// We're sitting on '\\'.
	l.advanceN(1)
	if l.eof() {
		return l.errAt(start, "trailing backslash in string")
	}
	c := l.peek(0)
	var out string
	switch c {
	case '{':
		out = "{"
	case '"':
		out = `"`
	case '\\':
		out = `\`
	case '/':
		// Upstream emits "\\/" (literal backslash-slash), not "/".
		// See Lexer.x:60.
		out = `\/`
	case 'b':
		out = "\b"
	case 'f':
		out = "\f"
	case 'n':
		out = "\n"
	case 'r':
		out = "\r"
	case 't':
		out = "\t"
	case 'u':
		l.advanceN(1) // consume 'u'
		return l.lexUnicodeEscape(start)
	default:
		return l.errAt(start, fmt.Sprintf("invalid escape sequence \\%c", c))
	}
	l.advanceN(1)
	l.emit(
		token.Token{
			Kind: token.KindStringLit,
			Text: out,
			Span: token.Span{Start: start, End: l.pos},
		},
	)
	return nil
}

// lexUnicodeEscape consumes a \uXXXX (start already past the 'u').
// Handles UTF-16 surrogate pairs by chaining a second \uXXXX.
func (l *lexer) lexUnicodeEscape(start token.Position) error {
	r, err := l.readHex4()
	if err != nil {
		return l.errAt(start, err.Error())
	}
	// Surrogate handling: a high surrogate must be followed by \uXXXX
	// low surrogate.
	if utf16.IsSurrogate(r) {
		if !l.has2(`\u`) {
			return l.errAt(start, "unpaired UTF-16 surrogate")
		}
		l.advanceN(2)
		r2, err := l.readHex4()
		if err != nil {
			return l.errAt(start, err.Error())
		}
		decoded := utf16.DecodeRune(r, r2)
		if decoded == utf8.RuneError {
			return l.errAt(start, "invalid UTF-16 surrogate pair")
		}
		r = decoded
	}
	l.emit(
		token.Token{
			Kind: token.KindStringLit,
			Text: string(r),
			Span: token.Span{Start: start, End: l.pos},
		},
	)
	return nil
}

func (l *lexer) readHex4() (rune, error) {
	var v rune
	for range 4 {
		c := l.peek(0)
		switch {
		case c >= '0' && c <= '9':
			v = v<<4 | rune(c-'0')
		case c >= 'a' && c <= 'f':
			v = v<<4 | rune(c-'a'+10)
		case c >= 'A' && c <= 'F':
			v = v<<4 | rune(c-'A'+10)
		default:
			return 0, errors.New("expected 4 hex digits in \\u escape")
		}
		l.advanceN(1)
	}
	return v, nil
}

// stepLiteral handles modeLiteral (single-quoted strings). Per
// Lexer.x:84-86 the productions are: \\ and \` escapes, any
// character except ' and {, and ' to pop.
func (l *lexer) stepLiteral() error {
	start := l.pos
	c := l.peek(0)
	if c == '\'' {
		l.advanceN(1)
		l.popMode()
		l.emit(
			token.Token{
				Kind: token.KindSingleQuote,
				Text: "'",
				Span: token.Span{Start: start, End: l.pos},
			},
		)
		return nil
	}
	if c == '{' {
		// `{` not allowed inside literal (Lexer.x:85 excludes it).
		return l.errAt(start, "unexpected '{' inside single-quoted string")
	}
	var sb strings.Builder
	for !l.eof() {
		c := l.peek(0)
		if c == '\'' || c == '{' {
			break
		}
		if c == '\\' && (l.peek(1) == '\\' || l.peek(1) == '`') {
			sb.WriteByte(l.peek(1))
			l.advanceN(2)
			continue
		}
		_, size := utf8.DecodeRuneInString(l.src[l.pos.Offset:])
		sb.WriteString(l.src[l.pos.Offset : l.pos.Offset+size])
		l.advanceN(size)
	}
	if sb.Len() == 0 {
		return l.errAt(start, "empty fragment in single-quoted string")
	}
	l.emit(
		token.Token{
			Kind: token.KindStringLit,
			Text: sb.String(),
			Span: token.Span{Start: start, End: l.pos},
		},
	)
	return nil
}

func isDigit(b byte) bool    { return b >= '0' && b <= '9' }
func isAlpha(b byte) bool    { return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') }
func isNumStart(b byte) bool { return isDigit(b) }
