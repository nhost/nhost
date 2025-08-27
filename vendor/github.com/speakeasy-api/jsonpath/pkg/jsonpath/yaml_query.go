package jsonpath

import (
	"gopkg.in/yaml.v3"
)

type Evaluator interface {
	Query(current *yaml.Node, root *yaml.Node) []*yaml.Node
}

type index interface {
	setPropertyKey(key *yaml.Node, value *yaml.Node)
	getPropertyKey(key *yaml.Node) *yaml.Node
}

type _index struct {
	propertyKeys map[*yaml.Node]*yaml.Node
}

func (i *_index) setPropertyKey(key *yaml.Node, value *yaml.Node) {
	if i != nil && i.propertyKeys != nil {
		i.propertyKeys[key] = value
	}
}

func (i *_index) getPropertyKey(key *yaml.Node) *yaml.Node {
	if i != nil {
		return i.propertyKeys[key]
	}
	return nil
}

// jsonPathAST can be Evaluated
var _ Evaluator = jsonPathAST{}

func (q jsonPathAST) Query(current *yaml.Node, root *yaml.Node) []*yaml.Node {
	idx := _index{
		propertyKeys: map[*yaml.Node]*yaml.Node{},
	}
	result := make([]*yaml.Node, 0)
	// If the top level node is a documentnode, unwrap it
	if root.Kind == yaml.DocumentNode && len(root.Content) == 1 {
		root = root.Content[0]
	}
	result = append(result, root)

	for _, segment := range q.segments {
		newValue := []*yaml.Node{}
		for _, value := range result {
			newValue = append(newValue, segment.Query(&idx, value, root)...)
		}
		result = newValue
	}
	return result
}

func (s segment) Query(idx index, value *yaml.Node, root *yaml.Node) []*yaml.Node {
	switch s.kind {
	case segmentKindChild:
		return s.child.Query(idx, value, root)
	case segmentKindDescendant:
		// run the inner segment against this node
		var result = []*yaml.Node{}
		children := descend(value, root)
		for _, child := range children {
			result = append(result, s.descendant.Query(idx, child, root)...)
		}
		// make children unique by pointer value
		result = unique(result)
		return result
	case segmentKindProperyName:
		found := idx.getPropertyKey(value)
		if found != nil {
			return []*yaml.Node{found}
		}
		return []*yaml.Node{}
	}
	panic("no segment type")
}

func unique(nodes []*yaml.Node) []*yaml.Node {
	// stably returns a new slice containing only the unique elements from nodes
	res := make([]*yaml.Node, 0)
	seen := make(map[*yaml.Node]bool)
	for _, node := range nodes {
		if _, ok := seen[node]; !ok {
			res = append(res, node)
			seen[node] = true
		}
	}
	return res
}

func (s innerSegment) Query(idx index, value *yaml.Node, root *yaml.Node) []*yaml.Node {
	result := []*yaml.Node{}

	switch s.kind {
	case segmentDotWildcard:
		// Handle wildcard - get all children
		switch value.Kind {
		case yaml.MappingNode:
			// in a mapping node, keys and values alternate
			// we just want to return the values
			for i, child := range value.Content {
				if i%2 == 1 {
					idx.setPropertyKey(value.Content[i-1], value)
					idx.setPropertyKey(child, value.Content[i-1])
					result = append(result, child)
				}
			}
		case yaml.SequenceNode:
			for _, child := range value.Content {
				result = append(result, child)
			}
		}
		return result
	case segmentDotMemberName:
		// Handle member access
		if value.Kind == yaml.MappingNode {
			// In YAML mapping nodes, keys and values alternate

			for i := 0; i < len(value.Content); i += 2 {
				key := value.Content[i]
				val := value.Content[i+1]

				if key.Value == s.dotName {
					idx.setPropertyKey(key, value)
					idx.setPropertyKey(val, key)
					result = append(result, val)
					break
				}
			}
		}

	case segmentLongHand:
		// Handle long hand selectors
		for _, selector := range s.selectors {
			result = append(result, selector.Query(idx, value, root)...)
		}
	default:
		panic("unknown child segment kind")
	}

	return result

}

func (s selector) Query(idx index, value *yaml.Node, root *yaml.Node) []*yaml.Node {
	switch s.kind {
	case selectorSubKindName:
		if value.Kind != yaml.MappingNode {
			return nil
		}
		// MappingNode children is a list of alternating keys and values
		var key string
		for i, child := range value.Content {
			if i%2 == 0 {
				key = child.Value
				continue
			}
			if key == s.name && i%2 == 1 {
				idx.setPropertyKey(value.Content[i], value.Content[i-1])
				idx.setPropertyKey(value.Content[i-1], value)
				return []*yaml.Node{child}
			}
		}
	case selectorSubKindArrayIndex:
		if value.Kind != yaml.SequenceNode {
			return nil
		}
		// if out of bounds, return nothing
		if s.index >= int64(len(value.Content)) || s.index < -int64(len(value.Content)) {
			return nil
		}
		// if index is negative, go backwards
		if s.index < 0 {
			return []*yaml.Node{value.Content[int64(len(value.Content))+s.index]}
		}
		return []*yaml.Node{value.Content[s.index]}
	case selectorSubKindWildcard:
		if value.Kind == yaml.SequenceNode {
			return value.Content
		} else if value.Kind == yaml.MappingNode {
			var result []*yaml.Node
			for i, child := range value.Content {
				if i%2 == 1 {
					idx.setPropertyKey(value.Content[i-1], value)
					idx.setPropertyKey(child, value.Content[i-1])
					result = append(result, child)
				}
			}
			return result
		}
		return nil
	case selectorSubKindArraySlice:
		if value.Kind != yaml.SequenceNode {
			return nil
		}
		if len(value.Content) == 0 {
			return nil
		}
		step := int64(1)
		if s.slice.step != nil {
			step = *s.slice.step
		}
		if step == 0 {
			return nil
		}

		start, end := s.slice.start, s.slice.end
		lower, upper := bounds(start, end, step, int64(len(value.Content)))

		var result []*yaml.Node
		if step > 0 {
			for i := lower; i < upper; i += step {
				result = append(result, value.Content[i])
			}
		} else {
			for i := upper; i > lower; i += step {
				result = append(result, value.Content[i])
			}
		}

		return result
	case selectorSubKindFilter:
		var result []*yaml.Node
		switch value.Kind {
		case yaml.MappingNode:
			for i := 1; i < len(value.Content); i += 2 {
				idx.setPropertyKey(value.Content[i-1], value)
				idx.setPropertyKey(value.Content[i], value.Content[i-1])
				if s.filter.Matches(idx, value.Content[i], root) {
					result = append(result, value.Content[i])
				}
			}
		case yaml.SequenceNode:
			for _, child := range value.Content {
				if s.filter.Matches(idx, child, root) {
					result = append(result, child)
				}
			}
		}
		return result
	}
	return nil
}

func normalize(i, length int64) int64 {
	if i >= 0 {
		return i
	}
	return length + i
}

func bounds(start, end *int64, step, length int64) (int64, int64) {
	var nStart, nEnd int64
	if start != nil {
		nStart = normalize(*start, length)
	} else if step > 0 {
		nStart = 0
	} else {
		nStart = length - 1
	}
	if end != nil {
		nEnd = normalize(*end, length)
	} else if step > 0 {
		nEnd = length
	} else {
		nEnd = -1
	}

	var lower, upper int64
	if step >= 0 {
		lower = max(min(nStart, length), 0)
		upper = min(max(nEnd, 0), length)
	} else {
		upper = min(max(nStart, -1), length-1)
		lower = min(max(nEnd, -1), length-1)
	}

	return lower, upper
}

func (s filterSelector) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	return s.expression.Matches(idx, node, root)
}

func (e logicalOrExpr) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	for _, expr := range e.expressions {
		if expr.Matches(idx, node, root) {
			return true
		}
	}
	return false
}

func (e logicalAndExpr) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	for _, expr := range e.expressions {
		if !expr.Matches(idx, node, root) {
			return false
		}
	}
	return true
}

func (e basicExpr) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	if e.parenExpr != nil {
		result := e.parenExpr.expr.Matches(idx, node, root)
		if e.parenExpr.not {
			return !result
		}
		return result
	} else if e.comparisonExpr != nil {
		return e.comparisonExpr.Matches(idx, node, root)
	} else if e.testExpr != nil {
		return e.testExpr.Matches(idx, node, root)
	}
	return false
}

func (e comparisonExpr) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	leftValue := e.left.Evaluate(idx, node, root)
	rightValue := e.right.Evaluate(idx, node, root)

	switch e.op {
	case equalTo:
		return leftValue.Equals(rightValue)
	case notEqualTo:
		return !leftValue.Equals(rightValue)
	case lessThan:
		return leftValue.LessThan(rightValue)
	case lessThanEqualTo:
		return leftValue.LessThanOrEqual(rightValue)
	case greaterThan:
		return rightValue.LessThan(leftValue)
	case greaterThanEqualTo:
		return rightValue.LessThanOrEqual(leftValue)
	default:
		return false
	}
}

func (e testExpr) Matches(idx index, node *yaml.Node, root *yaml.Node) bool {
	var result bool
	if e.filterQuery != nil {
		result = len(e.filterQuery.Query(idx, node, root)) > 0
	} else if e.functionExpr != nil {
		funcResult := e.functionExpr.Evaluate(idx, node, root)
		if funcResult.bool != nil {
			result = *funcResult.bool
		} else if funcResult.null == nil {
			result = true
		}
	}
	if e.not {
		return !result
	}
	return result
}

func (q filterQuery) Query(idx index, node *yaml.Node, root *yaml.Node) []*yaml.Node {
	if q.relQuery != nil {
		return q.relQuery.Query(idx, node, root)
	}
	if q.jsonPathQuery != nil {
		return q.jsonPathQuery.Query(node, root)
	}
	return nil
}

func (q relQuery) Query(idx index, node *yaml.Node, root *yaml.Node) []*yaml.Node {
	result := []*yaml.Node{node}
	for _, seg := range q.segments {
		var newResult []*yaml.Node
		for _, value := range result {
			newResult = append(newResult, seg.Query(idx, value, root)...)
		}
		result = newResult
	}
	return result
}

func (q absQuery) Query(idx index, node *yaml.Node, root *yaml.Node) []*yaml.Node {
	result := []*yaml.Node{root}
	for _, seg := range q.segments {
		var newResult []*yaml.Node
		for _, value := range result {
			newResult = append(newResult, seg.Query(idx, value, root)...)
		}
		result = newResult
	}
	return result
}
