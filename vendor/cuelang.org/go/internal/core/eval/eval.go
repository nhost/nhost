// Copyright 2021 CUE Authors
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

package eval

import (
	"cuelang.org/go/cue/stats"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/debug"
)

func Evaluate(r adt.Runtime, v *adt.Vertex) {
	c := adt.New(v, &adt.Config{
		Runtime: r,
		Format:  nodeFormat,
	})
	v.Finalize(c)
}

func New(r adt.Runtime) *Unifier {
	ctx := NewContext(r, nil)
	return &Unifier{r: r, e: ctx}
}

type Unifier struct {
	r adt.Runtime
	e *adt.OpContext
}

func (e *Unifier) Stats() *stats.Counts {
	return e.e.Stats()
}

// TODO: Note: NewContext takes essentially a cue.Value. By making this
// type more central, we can perhaps avoid context creation.
func NewContext(r adt.Runtime, v *adt.Vertex) *adt.OpContext {
	return adt.New(v, &adt.Config{
		Runtime: r,
		Format:  nodeFormat,
	})
}

func (e *Unifier) NewContext(v *adt.Vertex) *adt.OpContext {
	return NewContext(e.r, v)
}

var printConfig = &debug.Config{Compact: true}

func nodeFormat(r adt.Runtime, n adt.Node) string {
	return debug.NodeString(r, n, printConfig)
}
