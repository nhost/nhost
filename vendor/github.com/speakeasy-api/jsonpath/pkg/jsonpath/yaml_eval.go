package jsonpath

import (
	"fmt"
	"gopkg.in/yaml.v3"
	"reflect"
	"regexp"
	"strconv"
	"unicode/utf8"
)

func (l literal) Equals(value literal) bool {
	if l.integer != nil && value.integer != nil {
		return *l.integer == *value.integer
	}
	if l.float64 != nil && value.float64 != nil {
		return *l.float64 == *value.float64
	}
	if l.integer != nil && value.float64 != nil {
		return float64(*l.integer) == *value.float64
	}
	if l.float64 != nil && value.integer != nil {
		return *l.float64 == float64(*value.integer)
	}
	if l.string != nil && value.string != nil {
		return *l.string == *value.string
	}
	if l.bool != nil && value.bool != nil {
		return *l.bool == *value.bool
	}
	if l.null != nil && value.null != nil {
		return *l.null == *value.null
	}
	if l.node != nil && value.node != nil {
		return equalsNode(l.node, value.node)
	}
	if reflect.ValueOf(l).IsZero() && reflect.ValueOf(value).IsZero() {
		return true
	}
	return false
}

func equalsNode(a *yaml.Node, b *yaml.Node) bool {
	// decode into interfaces, then compare
	if a.Tag != b.Tag {
		return false
	}
	switch a.Tag {
	case "!!str":
		return a.Value == b.Value
	case "!!int":
		return a.Value == b.Value
	case "!!float":
		return a.Value == b.Value
	case "!!bool":
		return a.Value == b.Value
	case "!!null":
		return a.Value == b.Value
	case "!!seq":
		if len(a.Content) != len(b.Content) {
			return false
		}
		for i := 0; i < len(a.Content); i++ {
			if !equalsNode(a.Content[i], b.Content[i]) {
				return false
			}
		}
	case "!!map":
		if len(a.Content) != len(b.Content) {
			return false
		}
		for i := 0; i < len(a.Content); i += 2 {
			if !equalsNode(a.Content[i], b.Content[i]) {
				return false
			}
			if !equalsNode(a.Content[i+1], b.Content[i+1]) {
				return false
			}
		}
	}
	return true
}

func (l literal) LessThan(value literal) bool {
	if l.integer != nil && value.integer != nil {
		return *l.integer < *value.integer
	}
	if l.float64 != nil && value.float64 != nil {
		return *l.float64 < *value.float64
	}
	if l.integer != nil && value.float64 != nil {
		return float64(*l.integer) < *value.float64
	}
	if l.float64 != nil && value.integer != nil {
		return *l.float64 < float64(*value.integer)
	}
	if l.string != nil && value.string != nil {
		return *l.string < *value.string
	}
	return false
}

func (l literal) LessThanOrEqual(value literal) bool {
	return l.LessThan(value) || l.Equals(value)
}

func (c comparable) Evaluate(idx index, node *yaml.Node, root *yaml.Node) literal {
	if c.literal != nil {
		return *c.literal
	}
	if c.singularQuery != nil {
		return c.singularQuery.Evaluate(idx, node, root)
	}
	if c.functionExpr != nil {
		return c.functionExpr.Evaluate(idx, node, root)
	}
	return literal{}
}

func (e functionExpr) length(idx index, node *yaml.Node, root *yaml.Node) literal {
	args := e.args[0].Eval(idx, node, root)
	if args.kind != functionArgTypeLiteral {
		return literal{}
	}
	//*  If the argument value is a string, the result is the number of
	//Unicode scalar values in the string.
	if args.literal != nil && args.literal.string != nil {
		res := utf8.RuneCountInString(*args.literal.string)
		return literal{integer: &res}
	}
	//*  If the argument value is an array, the result is the number of
	//elements in the array.
	//
	//*  If the argument value is an object, the result is the number of
	//members in the object.
	//
	//*  For any other argument value, the result is the special result
	//Nothing.

	if args.literal.node != nil {
		switch args.literal.node.Kind {
		case yaml.SequenceNode:
			res := len(args.literal.node.Content)
			return literal{integer: &res}
		case yaml.MappingNode:
			res := len(args.literal.node.Content) / 2
			return literal{integer: &res}
		}
	}
	return literal{}
}

func (e functionExpr) count(idx index, node *yaml.Node, root *yaml.Node) literal {
	args := e.args[0].Eval(idx, node, root)
	if args.kind == functionArgTypeNodes {
		res := len(args.nodes)
		return literal{integer: &res}
	}

	res := 1
	return literal{integer: &res}
}

func (e functionExpr) match(idx index, node *yaml.Node, root *yaml.Node) literal {
	arg1 := e.args[0].Eval(idx, node, root)
	arg2 := e.args[1].Eval(idx, node, root)
	if arg1.kind != functionArgTypeLiteral || arg2.kind != functionArgTypeLiteral {
		return literal{}
	}
	if arg1.literal.string == nil || arg2.literal.string == nil {
		return literal{bool: &[]bool{false}[0]}
	}
	matched, _ := regexp.MatchString(fmt.Sprintf("^(%s)$", *arg2.literal.string), *arg1.literal.string)
	return literal{bool: &matched}
}

func (e functionExpr) search(idx index, node *yaml.Node, root *yaml.Node) literal {
	arg1 := e.args[0].Eval(idx, node, root)
	arg2 := e.args[1].Eval(idx, node, root)
	if arg1.kind != functionArgTypeLiteral || arg2.kind != functionArgTypeLiteral {
		return literal{}
	}
	if arg1.literal.string == nil || arg2.literal.string == nil {
		return literal{bool: &[]bool{false}[0]}
	}
	matched, _ := regexp.MatchString(*arg2.literal.string, *arg1.literal.string)
	return literal{bool: &matched}
}

func (e functionExpr) value(idx index, node *yaml.Node, root *yaml.Node) literal {
	//	2.4.8.  value() Function Extension
	//
	//Parameters:
	//	1.  NodesType
	//
	//Result:  ValueType
	//Its only argument is an instance of NodesType (possibly taken from a
	//filter-query, as in the example above).  The result is an instance of
	//ValueType.
	//
	//*  If the argument contains a single node, the result is the value of
	//the node.
	//
	//*  If the argument is the empty nodelist or contains multiple nodes,
	//	the result is Nothing.

	nodesType := e.args[0].Eval(idx, node, root)
	if nodesType.kind == functionArgTypeLiteral {
		return *nodesType.literal
	} else if nodesType.kind == functionArgTypeNodes && len(nodesType.nodes) == 1 {
		return *nodesType.nodes[0]
	}
	return literal{}
}

func nodeToLiteral(node *yaml.Node) literal {
	switch node.Tag {
	case "!!str":
		return literal{string: &node.Value}
	case "!!int":
		i, _ := strconv.Atoi(node.Value)
		return literal{integer: &i}
	case "!!float":
		f, _ := strconv.ParseFloat(node.Value, 64)
		return literal{float64: &f}
	case "!!bool":
		b, _ := strconv.ParseBool(node.Value)
		return literal{bool: &b}
	case "!!null":
		b := true
		return literal{null: &b}
	default:
		return literal{node: node}
	}
}

func (e functionExpr) Evaluate(idx index, node *yaml.Node, root *yaml.Node) literal {
	switch e.funcType {
	case functionTypeLength:
		return e.length(idx, node, root)
	case functionTypeCount:
		return e.count(idx, node, root)
	case functionTypeMatch:
		return e.match(idx, node, root)
	case functionTypeSearch:
		return e.search(idx, node, root)
	case functionTypeValue:
		return e.value(idx, node, root)
	}
	return literal{}
}

func (q singularQuery) Evaluate(idx index, node *yaml.Node, root *yaml.Node) literal {
	if q.relQuery != nil {
		return q.relQuery.Evaluate(idx, node, root)
	}
	if q.absQuery != nil {
		return q.absQuery.Evaluate(idx, node, root)
	}
	return literal{}
}

func (q relQuery) Evaluate(idx index, node *yaml.Node, root *yaml.Node) literal {
	result := q.Query(idx, node, root)
	if len(result) == 1 {
		return nodeToLiteral(result[0])
	}
	return literal{}

}

func (q absQuery) Evaluate(idx index, node *yaml.Node, root *yaml.Node) literal {
	result := q.Query(idx, root, root)
	if len(result) == 1 {
		return nodeToLiteral(result[0])
	}
	return literal{}
}
