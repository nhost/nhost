//nolint:err113,funlen,goconst,mnd // grammar-shaped template parser
package transform

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

type template struct {
	nodes []templateNode
}

func parseTemplate(source string) (*template, error) {
	parser := templateParser{source: source, pos: 0}

	nodes, stop, err := parser.parseNodes(map[string]struct{}{})
	if err != nil {
		return nil, err
	}

	if stop != "" {
		return nil, fmt.Errorf("unexpected %q", stop)
	}

	return &template{nodes: nodes}, nil
}

func (t *template) renderString(values map[string]any) (string, error) {
	state := newRenderState(renderModeString, values)
	if err := t.render(state); err != nil {
		return "", err
	}

	return state.out.String(), nil
}

func (t *template) renderNullableString(values map[string]any) (string, bool, error) {
	value, ok, err := t.singleExpressionValue(values)
	if err != nil {
		return "", false, err
	}

	if ok && value == nil {
		return "", true, nil
	}

	if ok {
		return stringifyTemplateValue(value), false, nil
	}

	rendered, err := t.renderString(values)

	return rendered, false, err
}

func (t *template) renderJSON(values map[string]any) ([]byte, error) {
	state := newRenderState(renderModeJSON, values)
	if err := t.render(state); err != nil {
		return nil, err
	}

	out := []byte(strings.TrimSpace(state.out.String()))
	if len(out) == 0 {
		return nil, errRenderedTemplateEmpty
	}

	var decoded any
	if err := json.Unmarshal(out, &decoded); err != nil {
		return nil, fmt.Errorf("rendered template is not valid JSON: %w", err)
	}

	return out, nil
}

func (t *template) render(state *renderState) error {
	for _, node := range t.nodes {
		if err := node.render(state); err != nil {
			return err
		}
	}

	return nil
}

func (t *template) singleExpressionValue(values map[string]any) (any, bool, error) {
	var expr expression
	for _, node := range t.nodes {
		switch typed := node.(type) {
		case textTemplateNode:
			if strings.TrimSpace(typed.text) != "" {
				return nil, false, nil
			}
		case exprTemplateNode:
			if expr != nil {
				return nil, false, nil
			}

			expr = typed.expr
		default:
			return nil, false, nil
		}
	}

	if expr == nil {
		return nil, false, nil
	}

	value, err := expr.eval(&evalContext{values: values})
	if err != nil {
		return nil, false, err
	}

	return value, true, nil
}

type templateParser struct {
	source string
	pos    int
}

func (p *templateParser) parseNodes(stops map[string]struct{}) ([]templateNode, string, error) {
	nodes := []templateNode{}

	for p.pos < len(p.source) {
		start := strings.Index(p.source[p.pos:], "{{")
		if start < 0 {
			nodes = appendTextNode(nodes, p.source[p.pos:])
			p.pos = len(p.source)

			break
		}

		start += p.pos
		nodes = appendTextNode(nodes, p.source[p.pos:start])

		end := strings.Index(p.source[start+2:], "}}")
		if end < 0 {
			return nil, "", errors.New("unterminated Kriti tag")
		}

		end += start + 2
		tag := strings.TrimSpace(p.source[start+2 : end])
		p.pos = end + 2

		keyword := tagKeyword(tag)
		if _, ok := stops[keyword]; ok {
			return nodes, tag, nil
		}

		switch keyword {
		case "if":
			node, err := p.parseIf(tag)
			if err != nil {
				return nil, "", err
			}

			nodes = append(nodes, node)
		case "range":
			node, err := p.parseRange(tag)
			if err != nil {
				return nil, "", err
			}

			nodes = append(nodes, node)
		case "elif", "else", "end":
			return nil, "", fmt.Errorf("unexpected %q", tag)
		default:
			expr, err := parseExpression(tag)
			if err != nil {
				return nil, "", fmt.Errorf("parsing interpolation %q: %w", tag, err)
			}

			nodes = append(nodes, exprTemplateNode{expr: expr})
		}
	}

	if len(stops) > 0 {
		want := make([]string, 0, len(stops))
		for stop := range stops {
			want = append(want, stop)
		}

		slices.Sort(want)

		return nil, "", fmt.Errorf("expected one of %s", strings.Join(want, ", "))
	}

	return nodes, "", nil
}

func appendTextNode(nodes []templateNode, text string) []templateNode {
	if text == "" {
		return nodes
	}

	return append(nodes, textTemplateNode{text: text})
}

func tagKeyword(tag string) string {
	trimmed := strings.TrimSpace(tag)
	if trimmed == "" {
		return ""
	}

	for i, r := range trimmed {
		if unicode.IsSpace(r) {
			return trimmed[:i]
		}
	}

	return trimmed
}

func (p *templateParser) parseIf(tag string) (templateNode, error) {
	conditionSource := strings.TrimSpace(strings.TrimPrefix(tag, "if"))

	condition, err := parseExpression(conditionSource)
	if err != nil {
		return nil, fmt.Errorf("parsing if condition %q: %w", conditionSource, err)
	}

	branches := []ifTemplateBranch{}

	nodes, stop, err := p.parseNodes(map[string]struct{}{
		"elif": {},
		"else": {},
		"end":  {},
	})
	if err != nil {
		return nil, err
	}

	branches = append(branches, ifTemplateBranch{condition: condition, nodes: nodes})

	for tagKeyword(stop) == "elif" {
		conditionSource = strings.TrimSpace(strings.TrimPrefix(stop, "elif"))

		condition, err = parseExpression(conditionSource)
		if err != nil {
			return nil, fmt.Errorf("parsing elif condition %q: %w", conditionSource, err)
		}

		nodes, stop, err = p.parseNodes(map[string]struct{}{
			"elif": {},
			"else": {},
			"end":  {},
		})
		if err != nil {
			return nil, err
		}

		branches = append(branches, ifTemplateBranch{condition: condition, nodes: nodes})
	}

	var elseNodes []templateNode
	if tagKeyword(stop) == "else" {
		elseNodes, stop, err = p.parseNodes(map[string]struct{}{"end": {}})
		if err != nil {
			return nil, err
		}
	}

	if tagKeyword(stop) != "end" {
		return nil, errors.New("expected end for if block")
	}

	return ifTemplateNode{branches: branches, elseNodes: elseNodes}, nil
}

func (p *templateParser) parseRange(tag string) (templateNode, error) {
	spec := strings.TrimSpace(strings.TrimPrefix(tag, "range"))

	left, right, ok := strings.Cut(spec, ":=")
	if !ok {
		return nil, errors.New("range expects :=")
	}

	names := strings.Split(left, ",")
	for i := range names {
		names[i] = strings.TrimSpace(names[i])
		if names[i] == "" {
			return nil, errors.New("range variable name is empty")
		}
	}

	if len(names) > 2 {
		return nil, errors.New("range supports at most index and value variables")
	}

	expr, err := parseExpression(strings.TrimSpace(right))
	if err != nil {
		return nil, fmt.Errorf("parsing range expression: %w", err)
	}

	nodes, stop, err := p.parseNodes(map[string]struct{}{"end": {}})
	if err != nil {
		return nil, err
	}

	if tagKeyword(stop) != "end" {
		return nil, errors.New("expected end for range block")
	}

	node := rangeTemplateNode{
		indexName: "",
		valueName: names[0],
		expr:      expr,
		nodes:     nodes,
	}
	if len(names) == 2 {
		node.indexName = names[0]
		node.valueName = names[1]
	}

	return node, nil
}

type templateNode interface {
	render(state *renderState) error
}

type textTemplateNode struct {
	text string
}

func (n textTemplateNode) render(state *renderState) error {
	state.out.WriteString(n.text)

	return nil
}

type exprTemplateNode struct {
	expr expression
}

func (n exprTemplateNode) render(state *renderState) error {
	value, err := n.expr.eval(state.ctx)
	if err != nil {
		return err
	}

	state.writeValue(value)

	return nil
}

type ifTemplateBranch struct {
	condition expression
	nodes     []templateNode
}

type ifTemplateNode struct {
	branches  []ifTemplateBranch
	elseNodes []templateNode
}

func (n ifTemplateNode) render(state *renderState) error {
	for _, branch := range n.branches {
		value, err := branch.condition.eval(state.ctx)
		if err != nil {
			return err
		}

		if !truthy(value) {
			continue
		}

		return renderTemplateNodes(branch.nodes, state)
	}

	return renderTemplateNodes(n.elseNodes, state)
}

type rangeTemplateNode struct {
	indexName string
	valueName string
	expr      expression
	nodes     []templateNode
}

func (n rangeTemplateNode) render(state *renderState) error {
	value, err := n.expr.eval(state.ctx)
	if err != nil {
		return err
	}

	switch typed := value.(type) {
	case []any:
		for i, item := range typed {
			if err := n.renderIteration(state, float64(i), item); err != nil {
				return err
			}
		}
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}

		slices.Sort(keys)

		for _, key := range keys {
			if err := n.renderIteration(state, key, typed[key]); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("range expects array or object, got %T", value)
	}

	return nil
}

func (n rangeTemplateNode) renderIteration(state *renderState, index any, value any) error {
	overrides := map[string]any{n.valueName: value}
	if n.indexName != "" {
		overrides[n.indexName] = index
	}

	originalContext := state.ctx

	state.ctx = state.ctx.child(overrides)
	defer func() {
		state.ctx = originalContext
	}()

	return renderTemplateNodes(n.nodes, state)
}

func renderTemplateNodes(nodes []templateNode, state *renderState) error {
	for _, node := range nodes {
		if err := node.render(state); err != nil {
			return err
		}
	}

	return nil
}

type renderMode int

const (
	renderModeJSON renderMode = iota
	renderModeString
)

type renderState struct {
	mode renderMode
	ctx  *evalContext
	out  strings.Builder
}

func newRenderState(mode renderMode, values map[string]any) *renderState {
	return &renderState{
		mode: mode,
		ctx:  &evalContext{values: values},
		out:  strings.Builder{},
	}
}

func (s *renderState) writeValue(value any) {
	if s.mode == renderModeString {
		s.out.WriteString(stringifyTemplateValue(value))

		return
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		s.out.WriteString("null")

		return
	}

	if s.insideJSONString() {
		s.out.WriteString(escapeJSONStringContent(stringifyTemplateValue(value)))

		return
	}

	s.out.Write(encoded)
}

func (s *renderState) insideJSONString() bool {
	inString := false

	escaped := false
	for _, r := range s.out.String() {
		if escaped {
			escaped = false
			continue
		}

		if r == '\\' {
			escaped = true
			continue
		}

		if r == '"' {
			inString = !inString
		}
	}

	return inString
}

func stringifyTemplateValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case bool:
		return strconv.FormatBool(typed)
	default:
		if number, ok := numberValue(value); ok {
			return strconv.FormatFloat(number, 'f', -1, 64)
		}

		encoded, err := json.Marshal(value)
		if err != nil {
			return ""
		}

		return string(encoded)
	}
}

func escapeJSONStringContent(value string) string {
	quoted := strconv.Quote(value)
	return quoted[1 : len(quoted)-1]
}
