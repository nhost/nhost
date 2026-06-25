package parser_test

// readGolden parses GHC `show` output for kriti-lang's ValueExt into a
// normalized gnode tree. The format is curried constructor application
// with parenthesised arguments, records (`{ field = term, ... }`),
// lists (`[ a, b ]`), tuples (`( a, b )`), string and number literals,
// and the bare symbols True/False/Nothing. We first parse it into a
// generic term, then interpret terms into gnodes.

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// --- generic term ----------------------------------------------------------

const (
	tApp   = 'a' // constructor/ident applied to zero or more args
	tStr   = 's'
	tNum   = 'n'
	tList  = 'l'
	tTuple = 't'
	tRec   = 'r'
)

type term struct {
	kind  byte
	head  string           // tApp head ident
	args  []*term          // tApp args
	str   string           // tStr
	num   float64          // tNum
	items []*term          // tList / tTuple
	rec   map[string]*term // tRec
}

// --- tokenizer --------------------------------------------------------------

type gtok struct {
	kind byte // ( ) [ ] { } , =  or  s(tring) n(umber) i(dent)
	text string
}

func isIdentRune(r rune) bool {
	return r == '_' || r == '\'' ||
		(r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
}

//nolint:cyclop // flat scanner over the show grammar's lexemes.
func gtokenize(s string) []gtok {
	rs := []rune(s)
	out := []gtok{}
	i := 0

	for i < len(rs) {
		c := rs[i]

		switch {
		case c == ' ' || c == '\n' || c == '\t' || c == '\r':
			i++
		case strings.ContainsRune("()[]{},=", c):
			out = append(out, gtok{byte(c), string(c)})
			i++
		case c == '"':
			i++

			var sb strings.Builder

			for i < len(rs) && rs[i] != '"' {
				if rs[i] == '\\' && i+1 < len(rs) {
					i++
					sb.WriteRune(unescape(rs[i]))
				} else {
					sb.WriteRune(rs[i])
				}

				i++
			}

			i++ // closing quote

			out = append(out, gtok{tStr, sb.String()})
		case (c >= '0' && c <= '9') ||
			(c == '-' && i+1 < len(rs) && rs[i+1] >= '0' && rs[i+1] <= '9'):
			// Include a leading '-' so negative Number literals keep their
			// sign; GHC `show` emits negatives bare (e.g. `Number ... -1.5`).
			j := i + 1
			for j < len(rs) && (rs[j] >= '0' && rs[j] <= '9' || rs[j] == '.' ||
				rs[j] == 'e' || rs[j] == 'E' || rs[j] == '+' || rs[j] == '-') {
				j++
			}

			out = append(out, gtok{tNum, string(rs[i:j])})
			i = j
		default:
			j := i
			for j < len(rs) && isIdentRune(rs[j]) {
				j++
			}

			if j == i { // unknown rune; skip
				i++
				continue
			}

			out = append(out, gtok{'i', string(rs[i:j])})
			i = j
		}
	}

	return out
}

func unescape(r rune) rune {
	switch r {
	case 'n':
		return '\n'
	case 't':
		return '\t'
	case 'r':
		return '\r'
	default:
		return r // \" \\ and the literal escaped char
	}
}

// --- term parser ------------------------------------------------------------

type gparser struct {
	toks []gtok
	pos  int
}

func (p *gparser) peek() gtok {
	if p.pos < len(p.toks) {
		return p.toks[p.pos]
	}

	return gtok{0, ""}
}

func (p *gparser) next() gtok {
	t := p.peek()
	p.pos++

	return t
}

func (p *gparser) startsAtom() bool {
	switch p.peek().kind {
	case '(', '[', '{', tStr, tNum, 'i':
		return true
	default:
		return false
	}
}

// parseApp parses an atom and, if it is an ident, greedily collects the
// following atoms as its arguments (Haskell juxtaposition). Arguments
// that are themselves applications are always parenthesised in the show
// output, so collecting bare atoms here is unambiguous.
func (p *gparser) parseApp() (*term, error) {
	head, err := p.parseAtom()
	if err != nil {
		return nil, err
	}

	if head.kind == tApp {
		for p.startsAtom() {
			arg, err := p.parseAtom()
			if err != nil {
				return nil, err
			}

			head.args = append(head.args, arg)
		}
	}

	return head, nil
}

func (p *gparser) parseAtom() (*term, error) {
	tk := p.peek()

	switch tk.kind {
	case '(':
		return p.parseParenOrTuple()
	case '[':
		return p.parseList()
	case '{':
		return p.parseRecord()
	case tStr:
		p.next()
		return &term{kind: tStr, str: tk.text}, nil
	case tNum:
		p.next()

		f, err := strconv.ParseFloat(tk.text, 64)
		if err != nil {
			return nil, fmt.Errorf("golden: parse number %q: %w", tk.text, err)
		}

		return &term{kind: tNum, num: f}, nil
	case 'i':
		p.next()
		return &term{kind: tApp, head: tk.text}, nil
	default:
		return nil, fmt.Errorf("unexpected token %q", tk.text)
	}
}

func (p *gparser) parseParenOrTuple() (*term, error) {
	p.next() // (

	first, err := p.parseApp()
	if err != nil {
		return nil, err
	}

	if p.peek().kind != ',' {
		if p.next().kind != ')' {
			return nil, errors.New("expected ) after group")
		}

		return first, nil
	}

	items := []*term{first}

	for p.peek().kind == ',' {
		p.next()

		it, err := p.parseApp()
		if err != nil {
			return nil, err
		}

		items = append(items, it)
	}

	if p.next().kind != ')' {
		return nil, errors.New("expected ) after tuple")
	}

	return &term{kind: tTuple, items: items}, nil
}

func (p *gparser) parseList() (*term, error) {
	p.next() // [

	items := []*term{}

	if p.peek().kind != ']' {
		for {
			it, err := p.parseApp()
			if err != nil {
				return nil, err
			}

			items = append(items, it)

			if p.peek().kind != ',' {
				break
			}

			p.next()
		}
	}

	if p.next().kind != ']' {
		return nil, errors.New("expected ] after list")
	}

	return &term{kind: tList, items: items}, nil
}

func (p *gparser) parseRecord() (*term, error) {
	p.next() // {

	rec := map[string]*term{}

	if p.peek().kind != '}' {
		for {
			name := p.next()
			if name.kind != 'i' {
				return nil, fmt.Errorf("expected record field name, got %q", name.text)
			}

			if p.next().kind != '=' {
				return nil, fmt.Errorf("expected = after field %q", name.text)
			}

			val, err := p.parseApp()
			if err != nil {
				return nil, err
			}

			rec[name.text] = val

			if p.peek().kind != ',' {
				break
			}

			p.next()
		}
	}

	if p.next().kind != '}' {
		return nil, errors.New("expected } after record")
	}

	return &term{kind: tRec, rec: rec}, nil
}

// --- interpret terms into gnodes -------------------------------------------

func readGolden(s string) (*gnode, error) {
	p := &gparser{toks: gtokenize(s)}

	root, err := p.parseApp()
	if err != nil {
		return nil, err
	}

	return interp(root)
}

func ival(t *term) int { return int(t.num) }

func termSpan(t *term) gspan {
	// t is the `Span { start = AlexSourcePos {..}, end = AlexSourcePos {..} }`
	// application: head "Span", one record argument.
	rec := t.args[0].rec
	start := rec["start"].args[0].rec
	end := rec["end"].args[0].rec

	return gspan{ival(start["line"]), ival(start["col"]), ival(end["line"]), ival(end["col"])}
}

//nolint:cyclop // flat dispatch over the upstream constructors.
func interp(t *term) (*gnode, error) {
	if t.kind != tApp {
		return nil, fmt.Errorf("expected constructor application, got kind %c", t.kind)
	}

	g := &gnode{kind: t.head}

	switch t.head {
	case "Array", "StringTem":
		g.span = termSpan(t.args[0])

		kids, err := interpList(t.args[1])
		if err != nil {
			return nil, err
		}

		g.kids = kids
	case "Object":
		g.span = termSpan(t.args[0])

		obj, err := interpFromList(t.args[1])
		if err != nil {
			return nil, err
		}

		g.obj = obj
	case "String", "Var":
		g.span = termSpan(t.args[0])
		g.str = t.args[1].str
	case "Number":
		g.span = termSpan(t.args[0])
		g.num = t.args[1].num
	case "Boolean":
		g.span = termSpan(t.args[0])
		g.b = t.args[1].head == "True"
	case "Null":
		g.span = termSpan(t.args[0])
	case "Function":
		g.span = termSpan(t.args[0])
		g.str = t.args[1].str

		arg, err := interp(t.args[2])
		if err != nil {
			return nil, err
		}

		g.kids = []*gnode{arg}
	case "Iff":
		return interpIff(t)
	case "Range":
		return interpRange(t)
	case "RequiredFieldAccess":
		return interpReq(t)
	case "OptionalFieldAccess":
		return interpOpt(t)
	default:
		return interpBinop(t)
	}

	return g, nil
}

func interpBinop(t *term) (*gnode, error) {
	switch t.head {
	case "Eq", "NotEq", "Gt", "Gte", "Lt", "Lte", "And", "Or", "In", "Defaulting", "Elif":
		l, err := interp(t.args[1])
		if err != nil {
			return nil, err
		}

		r, err := interp(t.args[2])
		if err != nil {
			return nil, err
		}

		return &gnode{kind: t.head, span: termSpan(t.args[0]), kids: []*gnode{l, r}}, nil
	default:
		return nil, fmt.Errorf("unknown constructor %q", t.head)
	}
}

func interpIff(t *term) (*gnode, error) {
	cond, err := interp(t.args[1])
	if err != nil {
		return nil, err
	}

	then, err := interp(t.args[2])
	if err != nil {
		return nil, err
	}

	elifTerms, err := interpList(t.args[3])
	if err != nil {
		return nil, err
	}

	els, err := interp(t.args[4])
	if err != nil {
		return nil, err
	}

	return &gnode{
		kind:  "Iff",
		span:  termSpan(t.args[0]),
		kids:  []*gnode{cond, then, els},
		elifs: elifTerms,
	}, nil
}

func interpRange(t *term) (*gnode, error) {
	src, err := interp(t.args[3])
	if err != nil {
		return nil, err
	}

	body, err := interp(t.args[4])
	if err != nil {
		return nil, err
	}

	g := &gnode{
		kind:   "Range",
		span:   termSpan(t.args[0]),
		binder: t.args[2].str,
		kids:   []*gnode{src, body},
	}

	// args[1] is `Just "i"` or `Nothing`.
	if idx := t.args[1]; idx.head == "Just" {
		g.hasIdx = true
		g.idx = idx.args[0].str
	}

	return g, nil
}

func interpReq(t *term) (*gnode, error) {
	root, err := interp(t.args[1])
	if err != nil {
		return nil, err
	}

	key, err := interpKey(t.args[2])
	if err != nil {
		return nil, err
	}

	return &gnode{
		kind: "Req",
		span: termSpan(t.args[0]),
		kids: []*gnode{root},
		keys: []gkey{key},
	}, nil
}

func interpOpt(t *term) (*gnode, error) {
	root, err := interp(t.args[1])
	if err != nil {
		return nil, err
	}

	keys := []gkey{}

	for _, kt := range t.args[2].items {
		k, err := interpKey(kt)
		if err != nil {
			return nil, err
		}

		keys = append(keys, k)
	}

	return &gnode{kind: "Opt", span: termSpan(t.args[0]), kids: []*gnode{root}, keys: keys}, nil
}

func interpKey(t *term) (gkey, error) {
	switch t.head {
	case "Left":
		return gkey{isName: true, name: t.args[0].str}, nil
	case "Right":
		expr, err := interp(t.args[0])
		if err != nil {
			return gkey{}, err
		}

		return gkey{isName: false, expr: expr}, nil
	default:
		return gkey{}, fmt.Errorf("expected Left/Right field key, got %q", t.head)
	}
}

func interpList(t *term) ([]*gnode, error) {
	out := make([]*gnode, 0, len(t.items))

	for _, it := range t.items {
		g, err := interp(it)
		if err != nil {
			return nil, err
		}

		out = append(out, g)
	}

	return out, nil
}

func interpFromList(t *term) (map[string]*gnode, error) {
	// t is `fromList [ ( "k", v ), ... ]`.
	list := t.args[0]
	out := make(map[string]*gnode, len(list.items))

	for _, pair := range list.items {
		v, err := interp(pair.items[1])
		if err != nil {
			return nil, err
		}

		out[pair.items[0].str] = v
	}

	return out, nil
}
