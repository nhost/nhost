package yaml

import "fmt"

const originTag = "__origin__"

func isScalar(n *Node) bool {
	return n.Kind == ScalarNode
}

func isSequence(n *Node) bool {
	return n.Kind == SequenceNode
}

func isMapping(n *Node) bool {
	return n.Kind == MappingNode
}

func addOriginInSeq(n *Node, file string) *Node {
	if !isMapping(n) || len(n.Content) == 0 {
		return n
	}
	// in case of a sequence, we use the first element as the key
	return addOrigin(n.Content[0], n, file)
}

func addOriginInMap(key, n *Node, file string) *Node {
	if !isMapping(n) {
		return n
	}
	return addOrigin(key, n, file)
}

// addOrigin injects a compact __origin__ sequence into the mapping node n.
//
// Format: [file, key_name, key_line, key_col, nf, f1_name, f1_delta, f1_col, ..., ns, s1_name, s1_count, s1_l0_delta, s1_c0, ..., end_delta, end_col]
//
//   - file: source file path
//   - key_name:  the YAML key whose value is this mapping
//   - key_line, key_col: location of that key
//   - nf: number of scalar+sequence fields recorded
//   - per field: name (string), line delta from key_line (int), column (int)
//   - ns: number of sequence fields that have item locations
//   - per sequence: name (string), item count (int), then count × (line delta, col)
//   - end_delta, end_col: end of the whole mapping block — line delta from
//     key_line and absolute column of the position just past its last content.
//     Appended last so a consumer that stops after the sequences section
//     simply ignores it (backward compatible).
func addOrigin(key, n *Node, file string) *Node {
	if isOrigin(key) {
		return n
	}

	seq := buildOriginSeq(key, n, file)
	n.Content = append(n.Content,
		&Node{Kind: ScalarNode, Tag: "!!str", Value: originTag}, // Line==0 → isOrigin
		&Node{Kind: SequenceNode, Tag: "!!seq", Content: seq},
	)
	return n
}

func buildOriginSeq(key, n *Node, file string) []*Node {
	// Header: file, key_name, key_line, key_col
	nodes := []*Node{
		strNode(file),
		strNode(key.Value),
		intNode(key.Line),
		intNode(key.Column),
	}

	// Collect field and sequence data.
	var fieldNodes []*Node // nf × (name, delta, col)
	var seqNodes []*Node   // ns × (name, count, (delta, col)…)
	nf, ns := 0, 0

	l := len(n.Content)
	for i := 0; i < l; i += 2 {
		k := n.Content[i]
		v := n.Content[i+1]
		if isOrigin(k) {
			continue
		}
		// Record the location of this field's key.
		nf++
		fieldNodes = append(fieldNodes,
			strNode(k.Value),
			intNode(k.Line-key.Line),
			intNode(k.Column),
		)
		if isSequence(v) {
			// Record locations of scalar items within the sequence.
			// Format per item: value_str, line_delta, col
			var itemNodes []*Node
			for _, item := range v.Content {
				if item.Kind == ScalarNode {
					itemNodes = append(itemNodes,
						strNode(item.Value),
						intNode(item.Line-key.Line),
						intNode(item.Column),
					)
				}
			}
			if len(itemNodes) > 0 {
				ns++
				seqNodes = append(seqNodes, strNode(k.Value), intNode(len(itemNodes)/3))
				seqNodes = append(seqNodes, itemNodes...)
			}
		}
	}

	nodes = append(nodes, intNode(nf))
	nodes = append(nodes, fieldNodes...)
	nodes = append(nodes, intNode(ns))
	nodes = append(nodes, seqNodes...)

	// Block end: line delta from key_line and absolute end column of the whole
	// mapping. Lets a consumer reconstruct the full block span
	// [key_line, key_line+end_delta] -- e.g. an entire endpoint operation block.
	endDelta, endCol := 0, 0
	if n.EndLine > 0 {
		endDelta = n.EndLine - key.Line
		endCol = n.EndColumn
	}
	nodes = append(nodes, intNode(endDelta), intNode(endCol))
	return nodes
}

// isOrigin returns true if the key is a synthetic origin node.
// Synthetic nodes have Line==0 (real YAML lines are 1-based).
func isOrigin(key *Node) bool {
	return key.Line == 0
}

func strNode(v string) *Node {
	return &Node{Kind: ScalarNode, Tag: "!!str", Value: v}
}

func intNode(v int) *Node {
	return &Node{Kind: ScalarNode, Tag: "!!int", Value: fmt.Sprintf("%d", v)}
}
