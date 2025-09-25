// Copyright 2024 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package toposort

import (
	"slices"
)

type sccNodeState struct {
	component *StronglyConnectedComponent
	lowLink   uint
	index     uint
	visited   bool
	onStack   bool
}

type StronglyConnectedComponent struct {
	Nodes    Nodes
	Outgoing []*StronglyConnectedComponent
	Incoming []*StronglyConnectedComponent
	visited  bool
}

// Calculate the Strongly Connected Components of the graph.
// https://en.wikipedia.org/wiki/Strongly_connected_component
//
// The components returned are topologically sorted (forwards), and
// form a DAG (this is the "condensation graph").
func (graph *Graph) StronglyConnectedComponents() []*StronglyConnectedComponent {
	nodeStates := make([]sccNodeState, len(graph.nodes))
	for i, node := range graph.nodes {
		node.sccNodeState = &nodeStates[i]
	}

	scc := &sccFinderState{}
	for _, node := range graph.nodes {
		if !node.sccNodeState.visited {
			scc.findSCC(node)
		}
	}

	for _, node := range graph.nodes {
		node.sccNodeState = nil
	}

	components := scc.components
	for _, component := range components {
		for _, next := range component.Outgoing {
			next.Incoming = append(next.Incoming, component)
		}
	}
	slices.Reverse(components)
	return components
}

type sccFinderState struct {
	components []*StronglyConnectedComponent
	stack      Nodes
	counter    uint
}

// This is Tarjan's algorithm from 1972.
//
// Robert Tarjan: Depth-first search and linear graph algorithms.
// SIAM Journal on Computing. Volume 1, Nr. 2 (1972), pp. 146-160.
//
// https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
func (scc *sccFinderState) findSCC(cur *Node) {
	num := scc.counter
	scc.counter++

	curScc := cur.sccNodeState
	curScc.lowLink = num
	curScc.index = num
	curScc.visited = true
	curScc.onStack = true

	scc.stack = append(scc.stack, cur)

	for _, next := range cur.Outgoing {
		nextScc := next.sccNodeState
		if !nextScc.visited {
			scc.findSCC(next)
			curScc.lowLink = min(curScc.lowLink, nextScc.lowLink)

		} else if nextScc.onStack {
			// If the next node is already on the stack, the edge joining
			// the current node and the next node completes a cycle.
			curScc.lowLink = min(curScc.lowLink, nextScc.index)
		}
	}

	// If the lowlink value of the node is equal to its DFS value, this
	// is the head node of a strongly connected component that's shaped
	// by the node and all nodes on the stack.
	if curScc.lowLink == curScc.index {
		component := &StronglyConnectedComponent{visited: true}

		var componentNodes Nodes

		for i := len(scc.stack) - 1; i >= 0; i-- {
			nodeN := scc.stack[i]
			nodeNScc := nodeN.sccNodeState
			nodeNScc.onStack = false
			nodeNScc.component = component
			componentNodes = append(componentNodes, nodeN)
			if nodeNScc == curScc {
				scc.stack = scc.stack[:i]
				break
			}
		}

		var outgoingComponents []*StronglyConnectedComponent
		for _, node := range componentNodes {
			for _, nextNode := range node.Outgoing {
				// This algorithm is depth-first, which means we can rely
				// on the next component always existing before our own
				// component.
				nextComponent := nextNode.sccNodeState.component
				if !nextComponent.visited {
					nextComponent.visited = true
					outgoingComponents = append(outgoingComponents, nextComponent)
				}
			}
		}

		component.Nodes = componentNodes
		component.Outgoing = outgoingComponents
		component.visited = false
		for _, component := range outgoingComponents {
			component.visited = false
		}
		scc.components = append(scc.components, component)
	}
}
