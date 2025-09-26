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
	"cmp"
	"math"
	"slices"

	"cuelang.org/go/internal/core/adt"
)

const (
	NodeUnsorted     = -1
	NodeInCurrentScc = -2
)

type Graph struct {
	nodes Nodes
}

type Node struct {
	Feature    adt.Feature
	Outgoing   Nodes
	Incoming   Nodes
	structMeta *structMeta
	// temporary state for calculating the Strongly Connected
	// Components of a graph.
	sccNodeState *sccNodeState
	// temporary state for calculating the Elementary Cycles of a
	// graph.
	ecNodeState *ecNodeState
	position    int
}

func (n *Node) IsSorted() bool {
	return n.position >= 0
}

func (n *Node) Name(index adt.StringIndexer) string {
	// TODO: two different fields like "#foo" and #foo, can have the same raw
	// string
	return n.Feature.RawString(index)
}

type Nodes []*Node

func (nodes Nodes) Features() []adt.Feature {
	features := make([]adt.Feature, len(nodes))
	for i, node := range nodes {
		features[i] = node.Feature
	}
	return features
}

type edge struct {
	from adt.Feature
	to   adt.Feature
}

type GraphBuilder struct {
	edgesSet       map[edge]struct{}
	nodesByFeature map[adt.Feature]*Node
}

func NewGraphBuilder() *GraphBuilder {
	return &GraphBuilder{
		edgesSet:       make(map[edge]struct{}),
		nodesByFeature: make(map[adt.Feature]*Node),
	}
}

// Adds an edge between the two features. Nodes for the features will
// be created if they don't already exist. This method is idempotent:
// multiple calls with the same arguments will not create multiple
// edges, nor error.
func (builder *GraphBuilder) AddEdge(from, to adt.Feature) {
	edge := edge{from: from, to: to}
	if _, found := builder.edgesSet[edge]; found {
		return
	}

	builder.edgesSet[edge] = struct{}{}
	fromNode := builder.EnsureNode(from)
	toNode := builder.EnsureNode(to)
	fromNode.Outgoing = append(fromNode.Outgoing, toNode)
	toNode.Incoming = append(toNode.Incoming, fromNode)
}

// Ensure that a node for this feature exists. This is necessary for
// features that are not necessarily connected to any other feature.
func (builder *GraphBuilder) EnsureNode(feature adt.Feature) *Node {
	node, found := builder.nodesByFeature[feature]
	if !found {
		node = &Node{Feature: feature, position: NodeUnsorted}
		builder.nodesByFeature[feature] = node
	}
	return node
}

func (builder *GraphBuilder) Build() *Graph {
	nodesByFeature := builder.nodesByFeature
	nodes := make(Nodes, 0, len(nodesByFeature))
	for _, node := range nodesByFeature {
		nodes = append(nodes, node)
	}
	return &Graph{nodes: nodes}
}

type indexComparison struct{ adt.StringIndexer }

func (index *indexComparison) compareNodeByName(a, b *Node) int {
	return cmp.Compare(a.Name(index), b.Name(index))
}

func (index *indexComparison) compareNodesByNames(a, b Nodes) int {
	lim := min(len(a), len(b))
	for i := 0; i < lim; i++ {
		if comparison := index.compareNodeByName(a[i], b[i]); comparison != 0 {
			return comparison
		}
	}
	return cmp.Compare(len(a), len(b))
}

func (index *indexComparison) compareCyclesByNames(a, b *Cycle) int {
	return index.compareNodesByNames(a.Nodes, b.Nodes)
}

func (index *indexComparison) compareComponentsByNodes(a, b *StronglyConnectedComponent) int {
	return index.compareNodesByNames(a.Nodes, b.Nodes)
}

func chooseCycleEntryNode(cycle *Cycle) (entryNode *Node, enabledSince, brokenEdgeCount int) {
	enabledSince = math.MaxInt

	for _, cycleNode := range cycle.Nodes {
		if cycleNode.IsSorted() {
			// this node is already in the sorted result
			continue
		}
	NextNodeIncoming:
		for _, incoming := range cycleNode.Incoming {
			position := incoming.position

			if position < 0 {
				// this predecessor node has not yet been added to the sorted
				// result.
				for _, cycleNode1 := range cycle.Nodes {
					// ignore this predecessor node if it is part of this cycle.
					if cycleNode1 == incoming {
						continue NextNodeIncoming
					}
				}
				brokenEdgeCount++
				continue NextNodeIncoming
			}

			// this predecessor node must already be in the sorted output.
			if position < enabledSince {
				enabledSince = position
				entryNode = cycleNode
			}
		}
	}
	return entryNode, enabledSince, brokenEdgeCount
}

func chooseCycle(indexCmp *indexComparison, unusedCycles []*Cycle) *Cycle {
	chosenCycleIdx := -1
	chosenCycleBrokenEdgeCount := math.MaxInt
	chosenCycleEnabledSince := math.MaxInt
	var chosenCycleEntryNode *Node

	for i, cycle := range unusedCycles {
		if cycle == nil {
			continue
		}
		debug("cycle %d: %v\n", i, cycle)
		entryNode, enabledSince, brokenEdgeCount := chooseCycleEntryNode(cycle)

		if entryNode == nil {
			entryNode = slices.MinFunc(
				cycle.Nodes, indexCmp.compareNodeByName)
		}

		debug("cycle %v; edgeCount %v; enabledSince %v; entryNode %v\n",
			cycle, brokenEdgeCount, enabledSince,
			entryNode.Name(indexCmp))

		cycleIsBetter := chosenCycleIdx == -1
		// this is written out long-form for ease of readability
		switch {
		case cycleIsBetter:
			// noop
		case brokenEdgeCount < chosenCycleBrokenEdgeCount:
			cycleIsBetter = true
		case brokenEdgeCount > chosenCycleBrokenEdgeCount:
			// noop - only continue if ==

		case enabledSince < chosenCycleEnabledSince:
			cycleIsBetter = true
		case enabledSince > chosenCycleEnabledSince:
			// noop - only continue if ==

		case entryNode.Name(indexCmp) < chosenCycleEntryNode.Name(indexCmp):
			cycleIsBetter = true
		case entryNode == chosenCycleEntryNode:
			cycleIsBetter =
				indexCmp.compareCyclesByNames(cycle, unusedCycles[chosenCycleIdx]) < 0
		}

		if cycleIsBetter {
			chosenCycleIdx = i
			chosenCycleBrokenEdgeCount = brokenEdgeCount
			chosenCycleEnabledSince = enabledSince
			chosenCycleEntryNode = entryNode
		}
	}

	if chosenCycleEntryNode == nil {
		return nil
	}

	debug("Chose cycle: %v; entering at node: %s\n",
		unusedCycles[chosenCycleIdx], chosenCycleEntryNode.Name(indexCmp))
	cycle := unusedCycles[chosenCycleIdx]
	unusedCycles[chosenCycleIdx] = nil
	cycle.RotateToStartAt(chosenCycleEntryNode)
	return cycle
}

// Sort the features of the graph into a single slice.
//
// As far as possible, a topological sort is used.
//
// Whenever there is choice as to which feature should occur next, a
// lexicographical comparison is done, and minimum feature chosen.
//
// Whenever progress cannot be made due to needing to enter into
// cycles, the cycle to enter into, and the node of that cycle with
// which to start, is selected based on:
//
//  1. minimising the number of incoming edges that are violated
//  2. chosing a node which was reachable as early as possible
//  3. chosing a node with a smaller feature name (lexicographical)
func (self *Graph) Sort(index adt.StringIndexer) []adt.Feature {
	indexCmp := &indexComparison{index}

	nodesSorted := make(Nodes, 0, len(self.nodes))

	scc := self.StronglyConnectedComponents()
	var sccReady []*StronglyConnectedComponent
	for _, component := range scc {
		component.visited = false
		slices.SortFunc(component.Nodes, indexCmp.compareNodeByName)
		if len(component.Incoming) == 0 {
			sccReady = append(sccReady, component)
		}
	}
	slices.SortFunc(sccReady, indexCmp.compareComponentsByNodes)

	sccVisitedCount := 0
	for sccVisitedCount != len(scc) {
		sccCurrent := sccReady[0]
		sccReady = sccReady[1:]
		if sccCurrent.visited {
			continue
		}
		sccCurrent.visited = true
		sccVisitedCount++
		debug("scc current: %p %v\n", sccCurrent, sccCurrent)
		var cyclesCurrent []*Cycle

		var nodesReady Nodes
	NextNode:
		for _, node := range sccCurrent.Nodes {
			node.position = NodeInCurrentScc
			for _, required := range node.Incoming {
				if !required.IsSorted() {
					continue NextNode
				}
			}
			nodesReady = append(nodesReady, node)
		}
		slices.SortFunc(nodesReady, indexCmp.compareNodeByName)

		requiredLen := len(nodesSorted) + len(sccCurrent.Nodes)
		for requiredLen != len(nodesSorted) {
			if len(nodesReady) == 0 {
				debug("Stuck after: %v\n", nodesSorted)
				if cyclesCurrent == nil {
					cyclesCurrent = sccCurrent.ElementaryCycles()
					debug("cycles current: %v\n", cyclesCurrent)
				}
				cycle := chooseCycle(indexCmp, cyclesCurrent)
				if cycle == nil {
					panic("No cycle found.")
				}
				nodesSorted, nodesReady = appendNodes(
					indexCmp, nodesSorted, cycle.Nodes, nodesReady)

			} else {
				nodesSorted, nodesReady = appendNodes(
					indexCmp, nodesSorted, nodesReady[:1], nodesReady[1:])
			}
		}

		sccReadyNeedsSorting := false
	SccNextOutgoing:
		for _, next := range sccCurrent.Outgoing {
			for _, required := range next.Incoming {
				if !required.visited {
					continue SccNextOutgoing
				}
			}
			sccReady = append(sccReady, next)
			sccReadyNeedsSorting = true
		}
		if sccReadyNeedsSorting {
			slices.SortFunc(sccReady, indexCmp.compareComponentsByNodes)
		}
	}

	return nodesSorted.Features()
}

func appendNodes(indexCmp *indexComparison, nodesSorted, nodesReady, nodesEnabled Nodes) (nodesSortedOut, nodesEnabledOut Nodes) {
	nodesReadyNeedsSorting := false
	for _, node := range nodesReady {
		if node.IsSorted() {
			continue
		}
		node.position = len(nodesSorted)
		nodesSorted = append(nodesSorted, node)

	NextOutgoing:
		for _, next := range node.Outgoing {
			if next.position != NodeInCurrentScc {
				continue
			}
			for _, required := range next.Incoming {
				if !required.IsSorted() {
					continue NextOutgoing
				}
			}
			debug("After %v, found new ready: %s\n",
				nodesSorted, next.Name(indexCmp))
			nodesEnabled = append(nodesEnabled, next)
			nodesReadyNeedsSorting = true
		}
	}
	if nodesReadyNeedsSorting {
		slices.SortFunc(nodesEnabled, indexCmp.compareNodeByName)
	}
	return nodesSorted, nodesEnabled
}

func debug(formatting string, args ...any) {
	//	fmt.Printf(formatting, args...)
}
