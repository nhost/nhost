//nolint:cyclop,err113,exhaustive,funlen,gocognit,gocyclo,mnd,nestif,nilnil,unparam // grammar-shaped parser
package transform

import (
	"errors"
	"fmt"
	"maps"
	"math"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

type tokenKind int

const (
	tokenEOF tokenKind = iota
	tokenIdent
	tokenVariable
	tokenString
	tokenNumber
	tokenLBrace
	tokenRBrace
	tokenLBracket
	tokenRBracket
	tokenLParen
	tokenRParen
	tokenComma
	tokenColon
	tokenDot
	tokenQuestion
	tokenQuestionDot
	tokenNullCoalesce
	tokenAssign
	tokenEqual
	tokenNotEqual
	tokenLess
	tokenLessEqual
	tokenGreater
	tokenGreaterEqual
	tokenAnd
	tokenOr
	tokenBang
	tokenPlus
	tokenMinus
)

type token struct {
	kind tokenKind
	text string
}

type lexer struct {
	input string
	pos   int
}

func (l *lexer) next() (token, error) {
	l.skipWhitespace()

	if l.pos >= len(l.input) {
		return token{kind: tokenEOF, text: ""}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "??") {
		l.pos += 2
		return token{kind: tokenNullCoalesce, text: "??"}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "?.") {
		l.pos += 2
		return token{kind: tokenQuestionDot, text: "?."}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], ":=") {
		l.pos += 2
		return token{kind: tokenAssign, text: ":="}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "==") {
		l.pos += 2
		return token{kind: tokenEqual, text: "=="}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "!=") {
		l.pos += 2
		return token{kind: tokenNotEqual, text: "!="}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "<=") {
		l.pos += 2
		return token{kind: tokenLessEqual, text: "<="}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], ">=") {
		l.pos += 2
		return token{kind: tokenGreaterEqual, text: ">="}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "&&") {
		l.pos += 2
		return token{kind: tokenAnd, text: "&&"}, nil
	}

	if strings.HasPrefix(l.input[l.pos:], "||") {
		l.pos += 2
		return token{kind: tokenOr, text: "||"}, nil
	}

	r, size := utf8.DecodeRuneInString(l.input[l.pos:])
	if r == utf8.RuneError && size == 1 {
		return token{}, fmt.Errorf("invalid UTF-8 at byte %d", l.pos)
	}

	switch r {
	case '{':
		l.pos += size
		return token{kind: tokenLBrace, text: "{"}, nil
	case '}':
		l.pos += size
		return token{kind: tokenRBrace, text: "}"}, nil
	case '[':
		l.pos += size
		return token{kind: tokenLBracket, text: "["}, nil
	case ']':
		l.pos += size
		return token{kind: tokenRBracket, text: "]"}, nil
	case '(':
		l.pos += size
		return token{kind: tokenLParen, text: "("}, nil
	case ')':
		l.pos += size
		return token{kind: tokenRParen, text: ")"}, nil
	case ',':
		l.pos += size
		return token{kind: tokenComma, text: ","}, nil
	case ':':
		l.pos += size
		return token{kind: tokenColon, text: ":"}, nil
	case '.':
		l.pos += size
		return token{kind: tokenDot, text: "."}, nil
	case '?':
		l.pos += size
		return token{kind: tokenQuestion, text: "?"}, nil
	case '!':
		l.pos += size
		return token{kind: tokenBang, text: "!"}, nil
	case '<':
		l.pos += size
		return token{kind: tokenLess, text: "<"}, nil
	case '>':
		l.pos += size
		return token{kind: tokenGreater, text: ">"}, nil
	case '+':
		l.pos += size
		return token{kind: tokenPlus, text: "+"}, nil
	case '-':
		if l.hasNumberAfterSign(size) {
			return l.readNumber()
		}

		l.pos += size

		return token{kind: tokenMinus, text: "-"}, nil
	case '\'', '"':
		return l.readString(r, size)
	case '$':
		return l.readVariable(size)
	default:
		if unicode.IsDigit(r) {
			return l.readNumber()
		}

		if isIdentStart(r) {
			return l.readIdent()
		}
	}

	return token{}, fmt.Errorf("unexpected character %q", r)
}

func (l *lexer) skipWhitespace() {
	for l.pos < len(l.input) {
		r, size := utf8.DecodeRuneInString(l.input[l.pos:])
		if !unicode.IsSpace(r) {
			return
		}

		l.pos += size
	}
}

func (l *lexer) hasNumberAfterSign(size int) bool {
	if l.pos+size >= len(l.input) {
		return false
	}

	r, _ := utf8.DecodeRuneInString(l.input[l.pos+size:])

	return unicode.IsDigit(r)
}

func (l *lexer) readString(quote rune, quoteSize int) (token, error) {
	start := l.pos
	l.pos += quoteSize

	var builder strings.Builder
	for l.pos < len(l.input) {
		r, size := utf8.DecodeRuneInString(l.input[l.pos:])
		if r == utf8.RuneError && size == 1 {
			return token{}, fmt.Errorf("invalid UTF-8 in string literal at byte %d", l.pos)
		}

		l.pos += size

		if r == quote {
			return token{kind: tokenString, text: builder.String()}, nil
		}

		if r != '\\' {
			builder.WriteRune(r)
			continue
		}

		if l.pos >= len(l.input) {
			return token{}, fmt.Errorf("unterminated escape sequence in %q", l.input[start:])
		}

		escaped, escapedSize := utf8.DecodeRuneInString(l.input[l.pos:])
		if escaped == utf8.RuneError && escapedSize == 1 {
			return token{}, fmt.Errorf("invalid UTF-8 escape in string literal at byte %d", l.pos)
		}

		l.pos += escapedSize
		switch escaped {
		case '\\', '\'', '"', '/':
			builder.WriteRune(escaped)
		case 'b':
			builder.WriteByte('\b')
		case 'f':
			builder.WriteByte('\f')
		case 'n':
			builder.WriteByte('\n')
		case 'r':
			builder.WriteByte('\r')
		case 't':
			builder.WriteByte('\t')
		case 'u':
			decoded, err := l.readUnicodeEscape()
			if err != nil {
				return token{}, err
			}

			builder.WriteRune(decoded)
		default:
			return token{}, fmt.Errorf("unsupported escape sequence \\%c", escaped)
		}
	}

	return token{}, fmt.Errorf("unterminated string literal %q", l.input[start:])
}

func (l *lexer) readUnicodeEscape() (rune, error) {
	if l.pos+4 > len(l.input) {
		return 0, errors.New("short unicode escape")
	}

	value, err := strconv.ParseInt(l.input[l.pos:l.pos+4], 16, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid unicode escape: %w", err)
	}

	l.pos += 4

	return rune(value), nil
}

func (l *lexer) readVariable(dollarSize int) (token, error) {
	l.pos += dollarSize

	start := l.pos
	for l.pos < len(l.input) {
		r, size := utf8.DecodeRuneInString(l.input[l.pos:])
		if !isIdentPart(r) {
			break
		}

		l.pos += size
	}

	if start == l.pos {
		return token{}, errors.New("expected variable name after $")
	}

	return token{kind: tokenVariable, text: l.input[start:l.pos]}, nil
}

func (l *lexer) readIdent() (token, error) {
	start := l.pos
	for l.pos < len(l.input) {
		r, size := utf8.DecodeRuneInString(l.input[l.pos:])
		if !isIdentPart(r) {
			break
		}

		l.pos += size
	}

	return token{kind: tokenIdent, text: l.input[start:l.pos]}, nil
}

func (l *lexer) readNumber() (token, error) {
	start := l.pos
	if strings.HasPrefix(l.input[l.pos:], "-") {
		l.pos++
	}

	for l.pos < len(l.input) {
		r, size := utf8.DecodeRuneInString(l.input[l.pos:])
		if !unicode.IsDigit(r) {
			break
		}

		l.pos += size
	}

	if l.pos < len(l.input) && l.input[l.pos] == '.' {
		l.pos++
		for l.pos < len(l.input) {
			r, size := utf8.DecodeRuneInString(l.input[l.pos:])
			if !unicode.IsDigit(r) {
				break
			}

			l.pos += size
		}
	}

	if l.pos < len(l.input) && (l.input[l.pos] == 'e' || l.input[l.pos] == 'E') {
		l.pos++
		if l.pos < len(l.input) && (l.input[l.pos] == '+' || l.input[l.pos] == '-') {
			l.pos++
		}

		for l.pos < len(l.input) {
			r, size := utf8.DecodeRuneInString(l.input[l.pos:])
			if !unicode.IsDigit(r) {
				break
			}

			l.pos += size
		}
	}

	return token{kind: tokenNumber, text: l.input[start:l.pos]}, nil
}

func isIdentStart(r rune) bool {
	return unicode.IsLetter(r) || r == '_'
}

func isIdentPart(r rune) bool {
	return isIdentStart(r) || unicode.IsDigit(r)
}

type exprParser struct {
	lexer lexer
	cur   token
}

func parseExpression(input string) (expression, error) {
	parser := &exprParser{
		lexer: lexer{input: input, pos: 0},
		cur:   token{kind: tokenEOF, text: ""},
	}
	if err := parser.advance(); err != nil {
		return nil, err
	}

	expr, err := parser.parseExpr(0)
	if err != nil {
		return nil, err
	}

	if parser.cur.kind != tokenEOF {
		return nil, fmt.Errorf("unexpected token %q", parser.cur.text)
	}

	return expr, nil
}

func (p *exprParser) advance() error {
	next, err := p.lexer.next()
	if err != nil {
		return err
	}

	p.cur = next

	return nil
}

func (p *exprParser) parseExpr(minPrecedence int) (expression, error) {
	left, err := p.parsePrefix()
	if err != nil {
		return nil, err
	}

	for {
		precedence, rightAssoc, ok := binaryPrecedence(p.cur.kind)
		if !ok || precedence < minPrecedence {
			return left, nil
		}

		op := p.cur.kind
		if err := p.advance(); err != nil {
			return nil, err
		}

		nextPrecedence := precedence + 1
		if rightAssoc {
			nextPrecedence = precedence
		}

		right, err := p.parseExpr(nextPrecedence)
		if err != nil {
			return nil, err
		}

		left = binaryExpr{op: op, left: left, right: right}
	}
}

func binaryPrecedence(kind tokenKind) (int, bool, bool) {
	switch kind {
	case tokenNullCoalesce:
		return 1, true, true
	case tokenOr:
		return 2, false, true
	case tokenAnd:
		return 3, false, true
	case tokenEqual, tokenNotEqual:
		return 4, false, true
	case tokenLess, tokenLessEqual, tokenGreater, tokenGreaterEqual:
		return 5, false, true
	case tokenPlus, tokenMinus:
		return 6, false, true
	default:
		return 0, false, false
	}
}

func (p *exprParser) parsePrefix() (expression, error) {
	var expr expression

	switch p.cur.kind {
	case tokenString:
		expr = literalExpr{value: p.cur.text}
		if err := p.advance(); err != nil {
			return nil, err
		}
	case tokenNumber:
		value, err := strconv.ParseFloat(p.cur.text, 64)
		if err != nil {
			return nil, fmt.Errorf("parsing number %q: %w", p.cur.text, err)
		}

		expr = literalExpr{value: value}

		if err := p.advance(); err != nil {
			return nil, err
		}
	case tokenIdent:
		switch p.cur.text {
		case "true":
			expr = literalExpr{value: true}

			if err := p.advance(); err != nil {
				return nil, err
			}
		case "false":
			expr = literalExpr{value: false}

			if err := p.advance(); err != nil {
				return nil, err
			}
		case "null", "Null":
			expr = literalExpr{value: nil}

			if err := p.advance(); err != nil {
				return nil, err
			}
		default:
			name := p.cur.text
			if err := p.advance(); err != nil {
				return nil, err
			}

			if p.cur.kind == tokenLParen {
				parsed, err := p.parseCall(name)
				if err != nil {
					return nil, err
				}

				expr = parsed
			} else {
				expr = variableExpr{name: name}
			}
		}
	case tokenVariable:
		expr = variableExpr{name: p.cur.text}
		if err := p.advance(); err != nil {
			return nil, err
		}
	case tokenLBracket:
		parsed, err := p.parseArray()
		if err != nil {
			return nil, err
		}

		expr = parsed
	case tokenLBrace:
		parsed, err := p.parseObject()
		if err != nil {
			return nil, err
		}

		expr = parsed
	case tokenLParen:
		if err := p.advance(); err != nil {
			return nil, err
		}

		parsed, err := p.parseExpr(0)
		if err != nil {
			return nil, err
		}

		if p.cur.kind != tokenRParen {
			return nil, fmt.Errorf("expected ), got %q", p.cur.text)
		}

		if err := p.advance(); err != nil {
			return nil, err
		}

		expr = parsed
	case tokenDot:
		if err := p.advance(); err != nil {
			return nil, err
		}

		if p.cur.kind != tokenIdent {
			return nil, errors.New("expected field name after leading dot")
		}

		expr = pathExpr{
			target: variableExpr{name: "body"},
			selectors: []selector{
				fieldSelector{key: p.cur.text, optional: false},
			},
		}
		if err := p.advance(); err != nil {
			return nil, err
		}
	case tokenBang:
		if err := p.advance(); err != nil {
			return nil, err
		}

		operand, err := p.parseExpr(7)
		if err != nil {
			return nil, err
		}

		expr = unaryExpr{op: tokenBang, operand: operand}
	case tokenMinus:
		if err := p.advance(); err != nil {
			return nil, err
		}

		operand, err := p.parseExpr(7)
		if err != nil {
			return nil, err
		}

		expr = unaryExpr{op: tokenMinus, operand: operand}
	default:
		return nil, fmt.Errorf("unexpected token %q", p.cur.text)
	}

	return p.parsePostfix(expr)
}

func (p *exprParser) parseCall(name string) (expression, error) {
	if p.cur.kind != tokenLParen {
		return nil, errors.New("expected function call")
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	args := []expression{}
	if p.cur.kind != tokenRParen {
		for {
			arg, err := p.parseExpr(0)
			if err != nil {
				return nil, err
			}

			args = append(args, arg)

			if p.cur.kind != tokenComma {
				break
			}

			if err := p.advance(); err != nil {
				return nil, err
			}
		}
	}

	if p.cur.kind != tokenRParen {
		return nil, fmt.Errorf("expected ), got %q", p.cur.text)
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	return callExpr{name: name, args: args}, nil
}

func (p *exprParser) parseArray() (expression, error) {
	if err := p.advance(); err != nil {
		return nil, err
	}

	items := []expression{}
	if p.cur.kind != tokenRBracket {
		for {
			item, err := p.parseExpr(0)
			if err != nil {
				return nil, err
			}

			items = append(items, item)

			if p.cur.kind != tokenComma {
				break
			}

			if err := p.advance(); err != nil {
				return nil, err
			}
		}
	}

	if p.cur.kind != tokenRBracket {
		return nil, fmt.Errorf("expected ], got %q", p.cur.text)
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	return arrayExpr{items: items}, nil
}

func (p *exprParser) parseObject() (expression, error) {
	if err := p.advance(); err != nil {
		return nil, err
	}

	fields := []objectField{}
	if p.cur.kind != tokenRBrace {
		for {
			var key string
			switch p.cur.kind {
			case tokenString, tokenIdent:
				key = p.cur.text
			default:
				return nil, fmt.Errorf("expected object key, got %q", p.cur.text)
			}

			if err := p.advance(); err != nil {
				return nil, err
			}

			if p.cur.kind != tokenColon {
				return nil, fmt.Errorf("expected : after object key %q", key)
			}

			if err := p.advance(); err != nil {
				return nil, err
			}

			value, err := p.parseExpr(0)
			if err != nil {
				return nil, err
			}

			fields = append(fields, objectField{key: key, value: value})

			if p.cur.kind != tokenComma {
				break
			}

			if err := p.advance(); err != nil {
				return nil, err
			}
		}
	}

	if p.cur.kind != tokenRBrace {
		return nil, fmt.Errorf("expected }, got %q", p.cur.text)
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	return objectExpr{fields: fields}, nil
}

func (p *exprParser) parsePostfix(expr expression) (expression, error) {
	selectors := []selector{}

	for {
		switch p.cur.kind {
		case tokenDot:
			if err := p.advance(); err != nil {
				return nil, err
			}

			if p.cur.kind != tokenIdent {
				return nil, errors.New("expected field name after dot")
			}

			selectors = append(selectors, fieldSelector{key: p.cur.text, optional: false})
			if err := p.advance(); err != nil {
				return nil, err
			}
		case tokenQuestionDot:
			if err := p.advance(); err != nil {
				return nil, err
			}

			if p.cur.kind != tokenIdent {
				return nil, errors.New("expected field name after optional dot")
			}

			selectors = append(selectors, fieldSelector{key: p.cur.text, optional: true})
			if err := p.advance(); err != nil {
				return nil, err
			}
		case tokenLBracket:
			selector, err := p.parseIndexSelector(false)
			if err != nil {
				return nil, err
			}

			selectors = append(selectors, selector)
		case tokenQuestion:
			if err := p.advance(); err != nil {
				return nil, err
			}

			if p.cur.kind != tokenLBracket {
				return nil, errors.New("expected [ after ?")
			}

			selector, err := p.parseIndexSelector(true)
			if err != nil {
				return nil, err
			}

			selectors = append(selectors, selector)
		default:
			if len(selectors) == 0 {
				return expr, nil
			}

			return pathExpr{target: expr, selectors: selectors}, nil
		}
	}
}

func (p *exprParser) parseIndexSelector(optional bool) (selector, error) {
	if p.cur.kind != tokenLBracket {
		return nil, errors.New("expected [")
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	index, err := p.parseExpr(0)
	if err != nil {
		return nil, err
	}

	if p.cur.kind != tokenRBracket {
		return nil, fmt.Errorf("expected ], got %q", p.cur.text)
	}

	if err := p.advance(); err != nil {
		return nil, err
	}

	return indexSelector{index: index, optional: optional}, nil
}

type evalContext struct {
	values map[string]any
}

func (c *evalContext) child(overrides map[string]any) *evalContext {
	values := make(map[string]any, len(c.values)+len(overrides))
	maps.Copy(values, c.values)
	maps.Copy(values, overrides)

	return &evalContext{values: values}
}

type expression interface {
	eval(ctx *evalContext) (any, error)
}

type literalExpr struct {
	value any
}

func (e literalExpr) eval(*evalContext) (any, error) {
	return e.value, nil
}

type variableExpr struct {
	name string
}

func (e variableExpr) eval(ctx *evalContext) (any, error) {
	value, ok := ctx.values[e.name]
	if !ok {
		return nil, fmt.Errorf("unknown variable %q", e.name)
	}

	return value, nil
}

type arrayExpr struct {
	items []expression
}

func (e arrayExpr) eval(ctx *evalContext) (any, error) {
	out := make([]any, 0, len(e.items))
	for _, item := range e.items {
		value, err := item.eval(ctx)
		if err != nil {
			return nil, err
		}

		out = append(out, value)
	}

	return out, nil
}

type objectField struct {
	key   string
	value expression
}

type objectExpr struct {
	fields []objectField
}

func (e objectExpr) eval(ctx *evalContext) (any, error) {
	out := make(map[string]any, len(e.fields))
	for _, field := range e.fields {
		value, err := field.value.eval(ctx)
		if err != nil {
			return nil, err
		}

		out[field.key] = value
	}

	return out, nil
}

type unaryExpr struct {
	op      tokenKind
	operand expression
}

func (e unaryExpr) eval(ctx *evalContext) (any, error) {
	value, err := e.operand.eval(ctx)
	if err != nil {
		return nil, err
	}

	switch e.op {
	case tokenBang:
		return !truthy(value), nil
	case tokenMinus:
		number, ok := numberValue(value)
		if !ok {
			return nil, fmt.Errorf("unary - expects number, got %T", value)
		}

		return -number, nil
	default:
		return nil, errors.New("unsupported unary operator")
	}
}

type binaryExpr struct {
	op          tokenKind
	left, right expression
}

func (e binaryExpr) eval(ctx *evalContext) (any, error) {
	left, err := e.left.eval(ctx)
	if err != nil {
		return nil, err
	}

	switch e.op {
	case tokenNullCoalesce:
		if left != nil {
			return left, nil
		}

		return e.right.eval(ctx)
	case tokenOr:
		if truthy(left) {
			return true, nil
		}

		right, err := e.right.eval(ctx)
		if err != nil {
			return nil, err
		}

		return truthy(right), nil
	case tokenAnd:
		if !truthy(left) {
			return false, nil
		}

		right, err := e.right.eval(ctx)
		if err != nil {
			return nil, err
		}

		return truthy(right), nil
	}

	right, err := e.right.eval(ctx)
	if err != nil {
		return nil, err
	}

	switch e.op {
	case tokenEqual:
		return equalValues(left, right), nil
	case tokenNotEqual:
		return !equalValues(left, right), nil
	case tokenLess, tokenLessEqual, tokenGreater, tokenGreaterEqual:
		return compareValues(e.op, left, right)
	case tokenPlus:
		return plusValues(left, right)
	case tokenMinus:
		leftNumber, leftOK := numberValue(left)

		rightNumber, rightOK := numberValue(right)
		if !leftOK || !rightOK {
			return nil, fmt.Errorf("- expects numbers, got %T and %T", left, right)
		}

		return leftNumber - rightNumber, nil
	default:
		return nil, errors.New("unsupported binary operator")
	}
}

type selector interface {
	selectValue(value any, ctx *evalContext) (any, error)
}

type fieldSelector struct {
	key      string
	optional bool
}

func (s fieldSelector) selectValue(value any, _ *evalContext) (any, error) {
	return lookupValue(value, s.key, s.optional)
}

type indexSelector struct {
	index    expression
	optional bool
}

func (s indexSelector) selectValue(value any, ctx *evalContext) (any, error) {
	index, err := s.index.eval(ctx)
	if err != nil {
		return nil, err
	}

	return lookupValue(value, index, s.optional)
}

type pathExpr struct {
	target    expression
	selectors []selector
}

func (e pathExpr) eval(ctx *evalContext) (any, error) {
	value, err := e.target.eval(ctx)
	if err != nil {
		return nil, err
	}

	for _, selector := range e.selectors {
		value, err = selector.selectValue(value, ctx)
		if err != nil {
			return nil, err
		}
	}

	return value, nil
}

type callExpr struct {
	name string
	args []expression
}

func (e callExpr) eval(ctx *evalContext) (any, error) {
	args := make([]any, 0, len(e.args))
	for _, arg := range e.args {
		value, err := arg.eval(ctx)
		if err != nil {
			return nil, err
		}

		args = append(args, value)
	}

	return callFunction(ctx, e.name, args)
}

func lookupValue(value any, key any, optional bool) (any, error) {
	if value == nil {
		if optional {
			return nil, nil
		}

		return nil, fmt.Errorf("cannot access %v on null", key)
	}

	switch typed := value.(type) {
	case map[string]any:
		keyString, ok := stringKey(key)
		if !ok {
			return nil, fmt.Errorf("object key must be string, got %T", key)
		}

		out, ok := typed[keyString]
		if !ok {
			if optional {
				return nil, nil
			}

			return nil, fmt.Errorf("field %q not found", keyString)
		}

		return out, nil
	case []any:
		index, ok := intIndex(key)
		if !ok {
			return nil, fmt.Errorf("array index must be a number, got %T", key)
		}

		if index < 0 || index >= len(typed) {
			if optional {
				return nil, nil
			}

			return nil, fmt.Errorf("array index %d out of range", index)
		}

		return typed[index], nil
	case map[string]string:
		keyString, ok := stringKey(key)
		if !ok {
			return nil, fmt.Errorf("object key must be string, got %T", key)
		}

		out, ok := typed[keyString]
		if !ok {
			if optional {
				return nil, nil
			}

			return nil, fmt.Errorf("field %q not found", keyString)
		}

		return out, nil
	default:
		return nil, fmt.Errorf("cannot access %v on %T", key, value)
	}
}

func stringKey(key any) (string, bool) {
	value, ok := key.(string)
	return value, ok
}

func intIndex(key any) (int, bool) {
	number, ok := numberValue(key)
	if !ok || math.Trunc(number) != number {
		return 0, false
	}

	return int(number), true
}

func truthy(value any) bool {
	switch typed := value.(type) {
	case nil:
		return false
	case bool:
		return typed
	case string:
		return typed != ""
	case []any:
		return len(typed) > 0
	case map[string]any:
		return len(typed) > 0
	default:
		if number, ok := numberValue(value); ok {
			return number != 0
		}

		return true
	}
}

func numberValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int8:
		return float64(typed), true
	case int16:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint8:
		return float64(typed), true
	case uint16:
		return float64(typed), true
	case uint32:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	default:
		return 0, false
	}
}

func equalValues(left any, right any) bool {
	leftNumber, leftOK := numberValue(left)

	rightNumber, rightOK := numberValue(right)
	if leftOK && rightOK {
		return leftNumber == rightNumber
	}

	return reflect.DeepEqual(left, right)
}

func compareValues(op tokenKind, left any, right any) (bool, error) {
	leftNumber, leftOK := numberValue(left)

	rightNumber, rightOK := numberValue(right)
	if leftOK && rightOK {
		switch op {
		case tokenLess:
			return leftNumber < rightNumber, nil
		case tokenLessEqual:
			return leftNumber <= rightNumber, nil
		case tokenGreater:
			return leftNumber > rightNumber, nil
		case tokenGreaterEqual:
			return leftNumber >= rightNumber, nil
		}
	}

	leftString, leftOK := left.(string)

	rightString, rightOK := right.(string)
	if leftOK && rightOK {
		switch op {
		case tokenLess:
			return leftString < rightString, nil
		case tokenLessEqual:
			return leftString <= rightString, nil
		case tokenGreater:
			return leftString > rightString, nil
		case tokenGreaterEqual:
			return leftString >= rightString, nil
		}
	}

	return false, fmt.Errorf(
		"comparison expects matching numbers or strings, got %T and %T",
		left,
		right,
	)
}

func plusValues(left any, right any) (any, error) {
	leftNumber, leftNumberOK := numberValue(left)

	rightNumber, rightNumberOK := numberValue(right)
	if leftNumberOK && rightNumberOK {
		return leftNumber + rightNumber, nil
	}

	leftString, leftStringOK := left.(string)

	rightString, rightStringOK := right.(string)
	if leftStringOK && rightStringOK {
		return leftString + rightString, nil
	}

	return nil, fmt.Errorf("+ expects matching numbers or strings, got %T and %T", left, right)
}

func callFunction(ctx *evalContext, name string, args []any) (any, error) {
	switch name {
	case "empty":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return emptyValue(args[0])
	case "size":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return sizeValue(args[0])
	case "inverse":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return inverseValue(args[0])
	case "head":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return headValue(args[0])
	case "tail":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return tailValue(args[0])
	case "toCaseFold":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		value, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		return strings.ToLower(value), nil
	case "toLower":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		value, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		return strings.ToLower(value), nil
	case "toUpper":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		value, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		return strings.ToUpper(value), nil
	case "toTitle":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		value, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		if value == "" {
			return "", nil
		}

		r, size := utf8.DecodeRuneInString(value)

		return strings.ToUpper(string(r)) + strings.ToLower(value[size:]), nil
	case "fromPairs":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return fromPairs(args[0])
	case "toPairs":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return toPairs(args[0])
	case "removeNulls":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return removeNulls(args[0])
	case "concat":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		return concatValues(args[0])
	case "escapeUri":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		value, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		return escapeURI(value), nil
	case "getSessionVariable":
		if err := expectArgCount(name, args, 1); err != nil {
			return nil, err
		}

		key, err := stringArg(name, args[0])
		if err != nil {
			return nil, err
		}

		return getSessionVariable(ctx, key), nil
	default:
		return nil, fmt.Errorf("unknown function %q", name)
	}
}

func expectArgCount(name string, args []any, want int) error {
	if len(args) != want {
		return fmt.Errorf("%s expects %d argument(s), got %d", name, want, len(args))
	}

	return nil
}

func stringArg(name string, value any) (string, error) {
	out, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("%s expects string, got %T", name, value)
	}

	return out, nil
}

func escapeURI(value string) string {
	const upperHex = "0123456789ABCDEF"

	var out strings.Builder
	for i := range len(value) {
		char := value[i]
		if isURIUnreserved(char) {
			out.WriteByte(char)

			continue
		}

		out.WriteByte('%')
		out.WriteByte(upperHex[char>>4])
		out.WriteByte(upperHex[char&0x0f])
	}

	return out.String()
}

func isURIUnreserved(char byte) bool {
	switch {
	case char >= 'A' && char <= 'Z':
		return true
	case char >= 'a' && char <= 'z':
		return true
	case char >= '0' && char <= '9':
		return true
	case char == '-' || char == '.' || char == '_' || char == '~':
		return true
	default:
		return false
	}
}

func emptyValue(value any) (bool, error) {
	switch typed := value.(type) {
	case nil:
		return true, nil
	case map[string]any:
		return len(typed) == 0, nil
	case []any:
		return len(typed) == 0, nil
	case string:
		return typed == "", nil
	case bool:
		return false, errors.New("empty expects object, array, string, number, or null")
	default:
		number, ok := numberValue(value)
		if !ok {
			return false, fmt.Errorf(
				"empty expects object, array, string, number, or null, got %T",
				value,
			)
		}

		return number == 0, nil
	}
}

func sizeValue(value any) (any, error) {
	switch typed := value.(type) {
	case nil:
		return float64(0), nil
	case map[string]any:
		return float64(len(typed)), nil
	case []any:
		return float64(len(typed)), nil
	case string:
		return float64(utf8.RuneCountInString(typed)), nil
	case bool:
		if typed {
			return float64(1), nil
		}

		return float64(0), nil
	default:
		number, ok := numberValue(value)
		if !ok {
			return nil, fmt.Errorf(
				"size expects object, array, string, number, boolean, or null, got %T",
				value,
			)
		}

		return number, nil
	}
}

func inverseValue(value any) (any, error) {
	switch typed := value.(type) {
	case nil:
		return nil, nil
	case map[string]any:
		return typed, nil
	case []any:
		out := slices.Clone(typed)
		slices.Reverse(out)

		return out, nil
	case string:
		runes := []rune(typed)
		slices.Reverse(runes)

		return string(runes), nil
	case bool:
		return !typed, nil
	default:
		number, ok := numberValue(value)
		if !ok {
			return nil, fmt.Errorf(
				"inverse expects object, array, string, number, boolean, or null, got %T",
				value,
			)
		}

		return 1 / number, nil
	}
}

func headValue(value any) (any, error) {
	switch typed := value.(type) {
	case []any:
		if len(typed) == 0 {
			return nil, errors.New("head expects a non-empty array")
		}

		return typed[0], nil
	case string:
		r, _ := utf8.DecodeRuneInString(typed)
		if r == utf8.RuneError {
			return nil, errors.New("head expects a non-empty string")
		}

		return string(r), nil
	default:
		return nil, fmt.Errorf("head expects array or string, got %T", value)
	}
}

func tailValue(value any) (any, error) {
	switch typed := value.(type) {
	case []any:
		if len(typed) == 0 {
			return []any{}, nil
		}

		return slices.Clone(typed[1:]), nil
	case string:
		_, size := utf8.DecodeRuneInString(typed)
		if size == 0 {
			return "", nil
		}

		return typed[size:], nil
	default:
		return nil, fmt.Errorf("tail expects array or string, got %T", value)
	}
}

func fromPairs(value any) (any, error) {
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("fromPairs expects array, got %T", value)
	}

	out := make(map[string]any, len(items))
	for _, item := range items {
		pair, ok := item.([]any)
		if !ok || len(pair) != 2 {
			return nil, errors.New("fromPairs expects array pairs")
		}

		key, ok := pair[0].(string)
		if !ok {
			return nil, errors.New("fromPairs keys must be strings")
		}

		out[key] = pair[1]
	}

	return out, nil
}

func toPairs(value any) (any, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("toPairs expects object, got %T", value)
	}

	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}

	slices.Sort(keys)

	out := make([]any, 0, len(keys))
	for _, key := range keys {
		out = append(out, []any{key, object[key]})
	}

	return out, nil
}

func removeNulls(value any) (any, error) {
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("removeNulls expects array, got %T", value)
	}

	out := make([]any, 0, len(items))
	for _, item := range items {
		if item != nil {
			out = append(out, item)
		}
	}

	return out, nil
}

func concatValues(value any) (any, error) {
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("concat expects array, got %T", value)
	}

	if len(items) == 0 {
		return "", nil
	}

	switch items[0].(type) {
	case string:
		var builder strings.Builder
		for _, item := range items {
			value, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("concat string mode got %T", item)
			}

			builder.WriteString(value)
		}

		return builder.String(), nil
	case []any:
		out := []any{}
		for _, item := range items {
			values, ok := item.([]any)
			if !ok {
				return nil, fmt.Errorf("concat array mode got %T", item)
			}

			out = append(out, values...)
		}

		return out, nil
	case map[string]any:
		out := map[string]any{}
		for _, item := range items {
			object, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("concat object mode got %T", item)
			}

			maps.Copy(out, object)
		}

		return out, nil
	default:
		return nil, errors.New("concat expects strings, arrays, or objects")
	}
}

func getSessionVariable(ctx *evalContext, key string) any {
	session, ok := ctx.values["session_variables"].(map[string]any)
	if !ok {
		return nil
	}

	for name, value := range session {
		if strings.EqualFold(name, key) {
			return value
		}
	}

	return nil
}
