// Package parser builds jsontmpl ASTs from token streams. Hand-rolled
// recursive descent that mirrors the Happy grammar in upstream's
// src/Kriti/Parser/Grammar.y.
//
// Grammar (transcribed from Grammar.y:71-251):
//
//	expr        := atom OP atom | ap | '{{' expr '}}'
//	OP          := '>' '<' '>=' '<=' '!=' '==' '&&' '||' 'in' '??'
//	ap          := ident '(' expr ')' | 'not' expr | atom
//	atom        := var | requiredField | optionalFields | range | iff
//	             | json | '(' expr ')'
//	requiredField := atom '.' ident | atom '[' STR ']' | atom '[' atom ']'
//	optionalFields := atom '?' field+   (greedy via %shift)
//	field       := '.' ident | '[' STR ']' | '[' atom ']'
//	range       := '{{' 'range' mident ',' ident ':=' expr '}}'
//	                  expr '{{' 'end' '}}'
//	mident      := '_' | ident
//	iff         := '{{' 'if' expr '}}' expr elif* '{{' 'else' '}}' expr
//	                  '{{' 'end' '}}'
//
// Binops are non-associative and do not chain (Grammar.y:60-63). The
// binop production is `atom OP atom`: both operands of an OP are
// atoms, so an unparenthesised `not`/function call is never a binop
// operand. Instead parseExpr matches `not` and function calls *before*
// the binop branch. `not` recurses into a full `expr` and so binds
// looser than OP: `not x && y` parses as `not (x && y)` and
// `not(true) && false` as `Function "not" (And true false)`, matching
// upstream's operators.kriti golden. Parenthesise to restrict `not`'s
// scope. A function call returns immediately without consuming a
// trailing OP, so `f(x) && y` is a parse error; parenthesise the call.
package parser

import (
	"fmt"

	"github.com/nhost/nhost/internal/lib/jsontmpl/ast"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// Error is a typed parser failure carrying a span.
type Error struct {
	Msg  string
	Span token.Span
}

func (e *Error) Error() string {
	return fmt.Sprintf("parse error at %d:%d: %s",
		e.Span.Start.Line, e.Span.Start.Column, e.Msg)
}

// Parse consumes the token stream and returns an AST node. The token
// slice must end in a KindEOF sentinel (as produced by lexer.Lex).
func Parse(toks []token.Token) (ast.Node, error) {
	p := &parser{toks: toks}
	n, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if p.peek().Kind != token.KindEOF {
		return nil, p.errAt(
			p.peek().Span,
			fmt.Sprintf("unexpected token %s after expression", p.peek()),
		)
	}
	return n, nil
}

type parser struct {
	toks  []token.Token
	pos   int
	depth int
}

// maxParseDepth bounds the mutually-recursive descent (parseExpr / parseAtom
// and the array/object/paren/curly/index forms they reach). Without it a
// pathological or machine-generated template such as strings.Repeat("[", N) +
// strings.Repeat("]", N) overflows the goroutine stack, which in Go is an
// uncatchable fatal error (not a panic recover() can absorb) that crashes the
// whole process. The limit is far above any realistic admin template and well
// below the overflow threshold; exceeding it yields a typed CodeParseError that
// flows through wrapParseErr like any other parse failure.
const maxParseDepth = 4000

// enter increments the recursion depth and reports an error once the bound is
// exceeded. Every mutually-recursive descent function calls enter on entry and
// defers leave, converting unbounded recursion into a typed parse error.
func (p *parser) enter() error {
	p.depth++
	if p.depth > maxParseDepth {
		return p.errAt(p.peek().Span, "expression nesting too deep")
	}

	return nil
}

func (p *parser) leave() { p.depth-- }

func (p *parser) peek() token.Token { return p.peekAt(0) }
func (p *parser) peekAt(i int) token.Token {
	idx := p.pos + i
	if idx >= len(p.toks) {
		return token.Token{Kind: token.KindEOF}
	}
	return p.toks[idx]
}

func (p *parser) advance() token.Token {
	t := p.peek()
	if t.Kind != token.KindEOF {
		p.pos++
	}
	return t
}

func (p *parser) errAt(s token.Span, msg string) error {
	return &Error{Msg: msg, Span: s}
}

func (p *parser) expect(k token.Kind) (token.Token, error) {
	t := p.peek()
	if t.Kind != k {
		return t, p.errAt(t.Span, fmt.Sprintf("expected %s, got %s", k, t))
	}
	return p.advance(), nil
}

// expectIdent asserts the current token is an identifier with the
// given text and consumes it.
func (p *parser) expectIdent(name string) (token.Token, error) {
	t := p.peek()
	if t.Kind != token.KindIdentifier || t.Text != name {
		return t, p.errAt(t.Span, fmt.Sprintf("expected identifier %q, got %s", name, t))
	}
	return p.advance(), nil
}

func (p *parser) isIdent(name string) bool {
	t := p.peek()
	return t.Kind == token.KindIdentifier && t.Text == name
}

// span returns a span covering [a, b].
func spanOf(a, b token.Span) token.Span {
	return token.Span{Start: a.Start, End: b.End}
}

// --- expr -------------------------------------------------------------------

func (p *parser) parseExpr() (ast.Node, error) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	defer p.leave()

	// expr → '{{' expr '}}' — only when {{ is followed by something
	// other than a control-flow keyword. Control flow (range, if) is
	// parsed inside parseAtom, which also handles {{ ... }} wrappers.
	// To avoid ambiguity we just defer the {{ branch to parseAtom.
	//
	// The remaining options are: 'not' expr, ident '(' expr ')', or
	// atom (binop atom)?.
	if p.isIdent("not") {
		notTok := p.advance()
		arg, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		return ast.Function{Span: spanOf(notTok.Span, arg.GetSpan()), Name: "not", Arg: arg}, nil
	}
	if p.peek().Kind == token.KindIdentifier && p.peekAt(1).Kind == token.KindParenOpen &&
		!isReservedIdent(p.peek().Text) {
		return p.parseFunctionCall()
	}

	left, err := p.parseAtom()
	if err != nil {
		return nil, err
	}
	if op, ok := p.binopKind(); ok {
		opTok := p.advance()
		right, err := p.parseAtom()
		if err != nil {
			return nil, err
		}
		return buildBinop(op, opTok, left, right), nil
	}
	return left, nil
}

// binopKind reports whether the current token is a binary operator,
// returning the canonical kind ("==", "!=", ..., "in", "??").
func (p *parser) binopKind() (token.Kind, bool) {
	t := p.peek()
	switch t.Kind {
	case token.KindEq, token.KindNotEq, token.KindGt, token.KindGte,
		token.KindLt, token.KindLte, token.KindAnd, token.KindOr,
		token.KindDoubleQuestionMark:
		return t.Kind, true
	}
	if t.Kind == token.KindIdentifier && t.Text == "in" {
		return token.KindIdentifier, true
	}
	return 0, false
}

func buildBinop(k token.Kind, opTok token.Token, left, right ast.Node) ast.Node {
	sp := spanOf(left.GetSpan(), right.GetSpan())
	switch k {
	case token.KindEq:
		return ast.Eq{Span: sp, Left: left, Right: right}
	case token.KindNotEq:
		return ast.NotEq{Span: sp, Left: left, Right: right}
	case token.KindGt:
		return ast.Gt{Span: sp, Left: left, Right: right}
	case token.KindGte:
		return ast.Gte{Span: sp, Left: left, Right: right}
	case token.KindLt:
		return ast.Lt{Span: sp, Left: left, Right: right}
	case token.KindLte:
		return ast.Lte{Span: sp, Left: left, Right: right}
	case token.KindAnd:
		return ast.And{Span: sp, Left: left, Right: right}
	case token.KindOr:
		return ast.Or{Span: sp, Left: left, Right: right}
	case token.KindDoubleQuestionMark:
		return ast.Defaulting{Span: sp, Left: left, Right: right}
	case token.KindIdentifier: // "in"
		return ast.In{Span: sp, Left: left, Right: right}
	}
	panic("unreachable binop kind: " + opTok.String())
}

// isReservedIdent reports whether the identifier is a keyword the
// parser matches by name and must NOT be treated as a function name.
// Per Grammar.y:38-44, these are 'if', 'elif', 'else', 'end', 'null',
// 'range', 'in', 'not'. (Booleans true/false are a separate token kind.)
func isReservedIdent(s string) bool {
	switch s {
	case "if", "elif", "else", "end", "null", "range", "in", "not":
		return true
	}
	return false
}

func (p *parser) parseFunctionCall() (ast.Node, error) {
	name := p.advance()
	if _, err := p.expect(token.KindParenOpen); err != nil {
		return nil, err
	}
	arg, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	close, err := p.expect(token.KindParenClose)
	if err != nil {
		return nil, err
	}
	return ast.Function{
		Span: spanOf(name.Span, close.Span),
		Name: name.Text,
		Arg:  arg,
	}, nil
}

// --- atom -------------------------------------------------------------------

func (p *parser) parseAtom() (ast.Node, error) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	defer p.leave()

	base, err := p.parseAtomBase()
	if err != nil {
		return nil, err
	}
	// Field-access chain: any mix of `.ident`, `[expr]`, `?field*`.
	// `?` is greedy on its trailing field list (matches the
	// optionalFields %shift in Grammar.y:131), but a subsequent `?`
	// starts a new OptionalFieldAccess layer.
	for {
		t := p.peek()
		if t.Kind == token.KindDot {
			p.advance()
			id, err := p.expect(token.KindIdentifier)
			if err != nil {
				return nil, err
			}
			base = ast.RequiredFieldAccess{
				Span: spanOf(base.GetSpan(), id.Span),
				Root: base,
				Field: ast.FieldKey{
					Span:   id.Span,
					IsName: true,
					Name:   id.Text,
				},
			}
			continue
		}
		if t.Kind == token.KindSquareOpen {
			p.advance()
			key, err := p.parseBracketSubscript()
			if err != nil {
				return nil, err
			}
			closeTok, err := p.expect(token.KindSquareClose)
			if err != nil {
				return nil, err
			}
			base = ast.RequiredFieldAccess{
				Span:  spanOf(base.GetSpan(), closeTok.Span),
				Root:  base,
				Field: key,
			}
			continue
		}
		if t.Kind == token.KindQuestionMark {
			qTok := p.advance()
			fields, err := p.parseOptionalFieldChain()
			if err != nil {
				return nil, err
			}
			end := qTok.Span
			if len(fields) > 0 {
				end = fields[len(fields)-1].Span
			}
			base = ast.OptionalFieldAccess{
				Span:   spanOf(base.GetSpan(), end),
				Root:   base,
				Fields: fields,
			}
			continue
		}
		break
	}
	return base, nil
}

// parseBracketSubscript returns the FieldKey for a `[ ... ]` subscript.
// Two forms: `['name']` (StringLit-only) and `[ expr ]`.
func (p *parser) parseBracketSubscript() (ast.FieldKey, error) {
	if p.peek().Kind == token.KindSingleQuote {
		open := p.advance()
		var name string
		// String content can be one or more KindStringLit tokens in
		// modeLiteral. Concatenate.
		for p.peek().Kind == token.KindStringLit {
			name += p.advance().Text
		}
		closeQ, err := p.expect(token.KindSingleQuote)
		if err != nil {
			return ast.FieldKey{}, err
		}
		return ast.FieldKey{
			Span:   spanOf(open.Span, closeQ.Span),
			IsName: false,
			Expr: ast.String{
				Span:  spanOf(open.Span, closeQ.Span),
				Value: name,
			},
		}, nil
	}
	// Otherwise an atom expression.
	startSpan := p.peek().Span
	e, err := p.parseAtom()
	if err != nil {
		return ast.FieldKey{}, err
	}
	return ast.FieldKey{
		Span:   spanOf(startSpan, e.GetSpan()),
		IsName: false,
		Expr:   e,
	}, nil
}

// parseOptionalFieldChain consumes the trailing field list after a
// `?`. The grammar (Grammar.y:131) is `atom '?' many(field) %shift`,
// and many() allows empty — so `$bar?` standalone parses with no
// fields. The `%shift` directive makes the chain greedy: as long as
// the next token is `.` or `[`, keep extending.
func (p *parser) parseOptionalFieldChain() ([]ast.FieldKey, error) {
	var out []ast.FieldKey
	for {
		t := p.peek()
		if t.Kind == token.KindDot {
			p.advance()
			id, err := p.expect(token.KindIdentifier)
			if err != nil {
				return nil, err
			}
			out = append(out, ast.FieldKey{Span: id.Span, IsName: true, Name: id.Text})
			continue
		}
		if t.Kind == token.KindSquareOpen {
			p.advance()
			f, err := p.parseBracketSubscript()
			if err != nil {
				return nil, err
			}
			if _, err := p.expect(token.KindSquareClose); err != nil {
				return nil, err
			}
			out = append(out, f)
			continue
		}
		break
	}
	return out, nil
}

// parseAtomBase consumes the leftmost terminal of an atom: a JSON
// literal, a `(` expr `)`, a Var, or one of the `{{`-prefixed
// constructs (range, iff, or a bare `{{ expr }}`).
func (p *parser) parseAtomBase() (ast.Node, error) {
	t := p.peek()
	switch t.Kind {
	case token.KindParenOpen:
		p.advance()
		e, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(token.KindParenClose); err != nil {
			return nil, err
		}
		return e, nil
	case token.KindDoubleCurlyOpen:
		return p.parseCurlyExpr()
	case token.KindSquareOpen:
		return p.parseArray()
	case token.KindCurlyOpen:
		return p.parseObject()
	case token.KindStringBegin:
		return p.parseStringTem()
	case token.KindIntLit:
		p.advance()
		return ast.Number{Span: t.Span, Text: t.Text}, nil
	case token.KindNumLit:
		p.advance()
		return ast.Number{Span: t.Span, Text: t.Text}, nil
	case token.KindBoolLit:
		p.advance()
		return ast.Boolean{Span: t.Span, Value: t.Bool}, nil
	case token.KindIdentifier:
		// `null` literal is an identifier per Grammar.y:42.
		if t.Text == "null" {
			p.advance()
			return ast.Null{Span: t.Span}, nil
		}
		// Plain variable.
		p.advance()
		return ast.Var{Span: t.Span, Name: t.Text}, nil
	}
	return nil, p.errAt(t.Span, fmt.Sprintf("unexpected token %s in atom", t))
}

// parseCurlyExpr handles `{{ ... }}` after the opening `{{` has been
// peeked but not consumed. The branch is determined by the token
// following `{{`: 'range', 'if', or anything else (a bare-expr wrap).
func (p *parser) parseCurlyExpr() (ast.Node, error) {
	open := p.advance() // consume {{
	if p.isIdent("range") {
		return p.parseRange(open)
	}
	if p.isIdent("if") {
		return p.parseIff(open)
	}
	e, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
		return nil, err
	}
	return e, nil
}

// parseRange: '{{' 'range' mident ',' ident ':=' expr '}}' expr '{{'
// 'end' '}}'. `{{` was already consumed by the caller.
func (p *parser) parseRange(open token.Token) (ast.Node, error) {
	if _, err := p.expectIdent("range"); err != nil {
		return nil, err
	}
	idxName, err := p.parseMident()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindComma); err != nil {
		return nil, err
	}
	bndr, err := p.expect(token.KindIdentifier)
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindAssignment); err != nil {
		return nil, err
	}
	source, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
		return nil, err
	}
	body, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyOpen); err != nil {
		return nil, err
	}
	if _, err := p.expectIdent("end"); err != nil {
		return nil, err
	}
	close, err := p.expect(token.KindDoubleCurlyClose)
	if err != nil {
		return nil, err
	}
	return ast.Range{
		Span:       spanOf(open.Span, close.Span),
		IdxName:    idxName,
		BinderName: bndr.Text,
		Source:     source,
		Body:       body,
	}, nil
}

// parseMident: '_' | ident. Returns "" for the underscore form.
func (p *parser) parseMident() (string, error) {
	t := p.peek()
	if t.Kind == token.KindUnderscore {
		p.advance()
		return "", nil
	}
	if t.Kind == token.KindIdentifier {
		p.advance()
		return t.Text, nil
	}
	return "", p.errAt(t.Span, fmt.Sprintf("expected identifier or '_', got %s", t))
}

// parseIff: '{{' 'if' expr '}}' expr elif* '{{' 'else' '}}' expr '{{'
// 'end' '}}'. `{{` was already consumed by the caller.
func (p *parser) parseIff(open token.Token) (ast.Node, error) {
	if _, err := p.expectIdent("if"); err != nil {
		return nil, err
	}
	cond, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
		return nil, err
	}
	thenBranch, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	// Zero or more elifs.
	var elifs []ast.Elif
	for p.peek().Kind == token.KindDoubleCurlyOpen && p.peekAt(1).Kind == token.KindIdentifier && p.peekAt(1).Text == "elif" {
		elifOpen := p.advance() // {{
		p.advance()             // elif
		c, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
			return nil, err
		}
		t, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		elifs = append(elifs, ast.Elif{
			Span: spanOf(elifOpen.Span, t.GetSpan()),
			Cond: c,
			Then: t,
		})
	}
	if _, err := p.expect(token.KindDoubleCurlyOpen); err != nil {
		return nil, err
	}
	if _, err := p.expectIdent("else"); err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
		return nil, err
	}
	elseBranch, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(token.KindDoubleCurlyOpen); err != nil {
		return nil, err
	}
	if _, err := p.expectIdent("end"); err != nil {
		return nil, err
	}
	close, err := p.expect(token.KindDoubleCurlyClose)
	if err != nil {
		return nil, err
	}
	return ast.Iff{
		Span:  spanOf(open.Span, close.Span),
		Cond:  cond,
		Then:  thenBranch,
		Elifs: elifs,
		Else:  elseBranch,
	}, nil
}

// --- JSON literals ----------------------------------------------------------

func (p *parser) parseArray() (ast.Node, error) {
	open, err := p.expect(token.KindSquareOpen)
	if err != nil {
		return nil, err
	}
	if p.peek().Kind == token.KindSquareClose {
		close := p.advance()
		return ast.Array{Span: spanOf(open.Span, close.Span)}, nil
	}
	var elems []ast.Node
	for {
		e, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		elems = append(elems, e)
		if p.peek().Kind == token.KindComma {
			p.advance()
			continue
		}
		break
	}
	close, err := p.expect(token.KindSquareClose)
	if err != nil {
		return nil, err
	}
	return ast.Array{Span: spanOf(open.Span, close.Span), Elems: elems}, nil
}

func (p *parser) parseObject() (ast.Node, error) {
	open, err := p.expect(token.KindCurlyOpen)
	if err != nil {
		return nil, err
	}
	if p.peek().Kind == token.KindCurlyClose {
		close := p.advance()
		return ast.Object{Span: spanOf(open.Span, close.Span)}, nil
	}
	var fields []ast.ObjectField
	for {
		key, err := p.parseObjectKey()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(token.KindColon); err != nil {
			return nil, err
		}
		value, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		fields = append(fields, ast.ObjectField{Key: key, Value: value})
		if p.peek().Kind == token.KindComma {
			p.advance()
			continue
		}
		break
	}
	close, err := p.expect(token.KindCurlyClose)
	if err != nil {
		return nil, err
	}
	return ast.Object{Span: spanOf(open.Span, close.Span), Fields: fields}, nil
}

// parseObjectKey: a string-literal-only key. Upstream's object_key
// (Grammar.y:248) concatenates adjacent StringLit tokens but does NOT
// allow embedded {{ expr }}.
func (p *parser) parseObjectKey() (string, error) {
	begin := p.peek()
	if begin.Kind != token.KindStringBegin {
		return "", p.errAt(begin.Span, fmt.Sprintf("expected string key, got %s", begin))
	}
	p.advance()
	var key string
	for {
		t := p.peek()
		if t.Kind == token.KindStringLit {
			key += t.Text
			p.advance()
			continue
		}
		break
	}
	if _, err := p.expect(token.KindStringEnd); err != nil {
		return "", err
	}
	return key, nil
}

// parseStringTem consumes a string with possible embedded {{ expr }}
// segments. Adjacent literal fragments are merged into a single
// String node, matching upstream's behaviour (Grammar.y:198-205).
func (p *parser) parseStringTem() (ast.Node, error) {
	begin, err := p.expect(token.KindStringBegin)
	if err != nil {
		return nil, err
	}
	var parts []ast.Node
	// Accumulate adjacent string fragments into one String node.
	var litStart token.Span
	var litText string
	var litActive bool
	flush := func() {
		if litActive {
			parts = append(parts, ast.String{Span: litStart, Value: litText})
			litActive = false
			litText = ""
		}
	}
	for {
		t := p.peek()
		if t.Kind == token.KindStringLit {
			if !litActive {
				litStart = t.Span
				litActive = true
			} else {
				litStart.End = t.Span.End
			}
			litText += t.Text
			p.advance()
			continue
		}
		if t.Kind == token.KindDoubleCurlyOpen {
			flush()
			p.advance()
			e, err := p.parseExpr()
			if err != nil {
				return nil, err
			}
			if _, err := p.expect(token.KindDoubleCurlyClose); err != nil {
				return nil, err
			}
			parts = append(parts, e)
			continue
		}
		break
	}
	flush()
	end, err := p.expect(token.KindStringEnd)
	if err != nil {
		return nil, err
	}
	// A single literal-only string template gets collapsed into a plain
	// String to keep evaluator paths simple. Templates with any embedded
	// expression stay as StringTem.
	if len(parts) == 1 {
		if s, ok := parts[0].(ast.String); ok {
			return ast.String{Span: spanOf(begin.Span, end.Span), Value: s.Value}, nil
		}
	}
	if len(parts) == 0 {
		return ast.String{Span: spanOf(begin.Span, end.Span), Value: ""}, nil
	}
	return ast.StringTem{Span: spanOf(begin.Span, end.Span), Parts: parts}, nil
}
