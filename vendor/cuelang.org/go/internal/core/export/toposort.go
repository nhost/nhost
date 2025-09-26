// Copyright 2020 CUE Authors
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

package export

import (
	"cmp"
	"slices"

	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/toposort"
)

// TODO: topological sort should go arguably in a more fundamental place as it
// may be needed to sort inputs for comprehensions.

// VertexFeatures returns the feature list of v. The list may include more
// features than for which there are arcs and also includes features for
// optional fields. It assumes the Structs fields are initialized and evaluated.
func VertexFeatures(c *adt.OpContext, v *adt.Vertex) []adt.Feature {
	if c.TopoSort {
		return toposort.VertexFeatures(c, v)
	} else {
		return vertexFeatures(c, v)
	}
}

func vertexFeatures(c *adt.OpContext, v *adt.Vertex) []adt.Feature {
	sets := extractFeatures(v.Structs)
	m := sortArcs(sets) // TODO: use for convenience.

	// Add features that are not in m. This may happen when fields were
	// dynamically created.
	var a []adt.Feature
	for _, arc := range v.Arcs {
		if _, ok := m[arc.Label]; !ok {
			a = append(a, arc.Label)
		}
	}

	sets = extractFeatures(v.Structs)
	if len(a) > 0 {
		sets = append(sets, a)
	}

	a = sortedArcs(sets)
	if adt.DebugSort > 0 {
		adt.DebugSortFields(c, a)
	}
	return a
}

func extractFeatures(in []*adt.StructInfo) (a [][]adt.Feature) {
	a = make([][]adt.Feature, 0, len(in))
	for _, s := range in {
		sorted := make([]adt.Feature, 0, len(s.Decls))
		for _, e := range s.Decls {
			switch x := e.(type) {
			case *adt.Field:
				sorted = append(sorted, x.Label)
			}
		}

		// Lists with a single element may still be useful to distinguish
		// between known and unknown fields: unknown fields are sorted last.
		if len(sorted) > 0 {
			a = append(a, sorted)
		}
	}
	return a
}

// VertexFeaturesUnsorted returns the feature list of v. There will be
// no duplicate features in the returned list, but there is also no
// attempt made to sort the list.
func VertexFeaturesUnsorted(v *adt.Vertex) (features []adt.Feature) {
	seen := make(map[adt.Feature]struct{})

	for _, s := range v.Structs {
		for _, decl := range s.Decls {
			field, ok := decl.(*adt.Field)
			if !ok {
				continue
			}
			label := field.Label
			if _, found := seen[label]; found {
				continue
			}
			seen[label] = struct{}{}
			features = append(features, label)
		}
	}

	for _, arc := range v.Arcs {
		label := arc.Label
		if _, found := seen[label]; found {
			continue
		}
		seen[label] = struct{}{}
		features = append(features, label)
	}

	return features
}

// sortedArcs is like sortArcs, but returns a the features of optional and
// required fields in an sorted slice. Ultimately, the implementation should
// use merge sort everywhere, and this will be the preferred method. Also,
// when querying optional fields as well, this helps identifying the optional
// fields.
func sortedArcs(fronts [][]adt.Feature) []adt.Feature {
	m := sortArcs(fronts)
	return sortedArcsFromMap(m)
}

func sortedArcsFromMap(m map[adt.Feature]int) []adt.Feature {
	a := make([]adt.Feature, 0, len(m))

	for k := range m {
		a = append(a, k)
	}

	slices.SortFunc(a, func(a1, a2 adt.Feature) int { return -cmp.Compare(m[a1], m[a2]) })

	return a
}

// sortArcs does a topological sort of arcs based on a variant of Kahn's
// algorithm. See
// https://www.geeksforgeeks.org/topological-sorting-indegree-based-solution/
//
// It returns a map from feature to int where the feature with the highest
// number should be sorted first.
func sortArcs(fronts [][]adt.Feature) map[adt.Feature]int {
	counts := map[adt.Feature]int{}
	for _, a := range fronts {
		if len(a) <= 1 {
			continue // no dependencies
		}
		for _, f := range a[1:] {
			counts[f]++
		}
	}

	// We could use a Heap instead of simple linear search here if we are
	// concerned about the time complexity.

	index := -1
outer:
	for {
	lists:
		for i, a := range fronts {
			for len(a) > 0 {
				f := a[0]
				n := counts[f]
				if n > 0 {
					continue lists
				}

				// advance list and decrease dependency.
				a = a[1:]
				fronts[i] = a
				if len(a) > 1 && counts[a[0]] > 0 {
					counts[a[0]]--
				}

				if n == 0 { // may be head of other lists as well
					counts[f] = index
					index--
				}
				continue outer // progress
			}
		}

		for _, a := range fronts {
			if len(a) > 0 {
				// Detected a cycle. Fire at will to make progress.
				counts[a[0]] = 0
				continue outer
			}
		}
		break
	}

	return counts
}
