// Copyright 2018 The CUE Authors
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

package astutil

import "cuelang.org/go/cue/ast"

// walkVisitor traverses an AST in depth-first order with a [visitor].
//
// TODO(mvdan): refactor away the need for walkVisitor;
// Resolve and Sanitize should be able to use ast.Walk directly.
func walkVisitor(node ast.Node, v visitor) {
	sv := &stackVisitor{stack: []visitor{v}}
	ast.Walk(node, sv.Before, sv.After)
}

// stackVisitor helps implement visitor support on top of ast.Walk.
type stackVisitor struct {
	stack []visitor
}

func (v *stackVisitor) Before(node ast.Node) bool {
	current := v.stack[len(v.stack)-1]
	next := current.Before(node)
	if next == nil {
		return false
	}
	v.stack = append(v.stack, next)
	return true
}

func (v *stackVisitor) After(node ast.Node) {
	v.stack[len(v.stack)-1] = nil // set visitor to nil so it can be garbage collected
	v.stack = v.stack[:len(v.stack)-1]
}

// A visitor's before method is invoked for each node encountered by Walk.
// If the result visitor w is true, Walk visits each of the children
// of node with the visitor w, followed by a call of w.After.
type visitor interface {
	Before(node ast.Node) (w visitor)
	After(node ast.Node)
}
