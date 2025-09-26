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

import "slices"

type ecNodeState struct {
	visitedIncoming []*ecNodeState
	blocked         bool
}

func (ecNode *ecNodeState) excluded() bool {
	return ecNode == nil
}

type ecFinderState struct {
	cycles []*Cycle
	stack  []*Node
}

type Cycle struct {
	Nodes Nodes
}

func (cycle *Cycle) RotateToStartAt(start *Node) {
	nodes := cycle.Nodes
	if start == nodes[0] {
		return
	}
	for i, node := range nodes {
		if start == node {
			prefix := slices.Clone(nodes[:i])
			copy(nodes, nodes[i:])
			copy(nodes[len(nodes)-i:], prefix)
			break
		}
	}
}

// Calculate the Elementary Cycles (EC) within the current Strongly
// Connected Component (SCC).
//
// If the component contains no cycles (by definition, this means the
// component contains only a single node), then the slice returned
// will be empty.
//
// In general:
//
//  1. If a component contains two or more nodes then it contains at
//     least one cycle.
//  2. A single node can be involved in many cycles.
//  3. This method finds all cycles within a component, but does not
//     include cycles that are merely rotations of each
//     other. I.e. every cycle is unique, ignoring rotations.
//  4. The cycles returned are unsorted: each cycle is itself in no
//     particular rotation, and the complete slice of cycles is
//     similarly unsorted.
//
// The complexity of this algorithm is O((n+e)*c) where
//   - n: number of nodes in the SCC
//   - e: number of edges between the nodes in the SCC
//   - c: number of cycles discovered
//
// Donald B Johnson: Finding All the Elementary Circuits of a Directed
// Graph. SIAM Journal on Computing. Volumne 4, Nr. 1 (1975),
// pp. 77-84.
func (scc *StronglyConnectedComponent) ElementaryCycles() []*Cycle {
	nodes := scc.Nodes
	nodeStates := make([]ecNodeState, len(nodes))
	for i, node := range nodes {
		node.ecNodeState = &nodeStates[i]
	}

	ec := &ecFinderState{}
	for i, node := range nodes {
		ec.findCycles(node, node)
		ec.unblockAll(nodes[i+1:])
		node.ecNodeState = nil
	}

	return ec.cycles
}

func (ec *ecFinderState) findCycles(origin, cur *Node) bool {
	stackLen := len(ec.stack)
	ec.stack = append(ec.stack, cur)

	curEc := cur.ecNodeState
	curEc.blocked = true

	cycleFound := false
	for _, next := range cur.Outgoing {
		if next.ecNodeState.excluded() {
			continue
		}
		if next == origin { // found cycle
			ec.cycles = append(ec.cycles, &Cycle{Nodes: slices.Clone(ec.stack)})
			cycleFound = true
		} else if !next.ecNodeState.blocked {
			if ec.findCycles(origin, next) {
				cycleFound = true
			}
		}
	}

	if cycleFound {
		ec.unblock(curEc)
	} else {
		for _, next := range cur.Outgoing {
			if next.ecNodeState.excluded() {
				continue
			}
			nextEc := next.ecNodeState
			nextEc.visitedIncoming = append(nextEc.visitedIncoming, curEc)
		}
	}

	if len(ec.stack) != stackLen+1 {
		panic("stack is unexpected height!")
	}
	ec.stack = ec.stack[:stackLen]
	return cycleFound
}

func (ec *ecFinderState) unblockAll(nodes Nodes) {
	for _, node := range nodes {
		nodeEc := node.ecNodeState
		nodeEc.blocked = false
		nodeEc.visitedIncoming = nodeEc.visitedIncoming[:0]
	}
}

func (ec *ecFinderState) unblock(nodeEc *ecNodeState) {
	nodeEc.blocked = false
	for _, previousEc := range nodeEc.visitedIncoming {
		if previousEc.blocked {
			ec.unblock(previousEc)
		}
	}
	nodeEc.visitedIncoming = nodeEc.visitedIncoming[:0]
}
