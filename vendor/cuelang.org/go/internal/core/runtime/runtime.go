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

package runtime

import (
	"cuelang.org/go/cue/build"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/cuedebug"
	"cuelang.org/go/internal/cueexperiment"
)

// A Runtime maintains data structures for indexing and reuse for evaluation.
type Runtime struct {
	index *index

	loaded map[*build.Instance]interface{}

	// interpreters implement extern functionality. The map key corresponds to
	// the kind in a file-level @extern(kind) attribute.
	interpreters map[string]Interpreter

	version  internal.EvaluatorVersion
	topoSort bool

	flags cuedebug.Config
}

func (r *Runtime) Settings() (internal.EvaluatorVersion, cuedebug.Config) {
	return r.version, r.flags
}

func (r *Runtime) ConfigureOpCtx(ctx *adt.OpContext) {
	ctx.Version = r.version
	ctx.TopoSort = r.topoSort
	ctx.Config = r.flags
}

func (r *Runtime) SetBuildData(b *build.Instance, x interface{}) {
	r.loaded[b] = x
}

func (r *Runtime) BuildData(b *build.Instance) (x interface{}, ok bool) {
	x, ok = r.loaded[b]
	return x, ok
}

// New is short for [NewWithSettings] while obeying `CUE_EXPERIMENT=evalv3`
// for the evaluator version and using zero [cuedebug] flags.
func New() *Runtime {
	r := &Runtime{}
	r.Init()
	return r
}

// NewWithSettings creates a new Runtime using the given runtime version and
// debug flags. The builtins registered with RegisterBuiltin are available for
// evaluation.
func NewWithSettings(v internal.EvaluatorVersion, flags cuedebug.Config) *Runtime {
	r := &Runtime{flags: flags}
	r.Init()
	r.version = v
	return r
}

// SetVersion sets the version to use for the Runtime. This should only be set
// before first use.
func (r *Runtime) SetVersion(v internal.EvaluatorVersion) {
	r.version = v
}

// SetTopologicalSort sets whether or not to use topological sorting
// for the Runtime.
func (r *Runtime) SetTopologicalSort(b bool) {
	r.topoSort = b
}

// SetDebugOptions sets the debug flags to use for the Runtime. This should only
// be set before first use.
func (r *Runtime) SetDebugOptions(flags *cuedebug.Config) {
	r.flags = *flags
}

// IsInitialized reports whether the runtime has been initialized.
func (r *Runtime) IsInitialized() bool {
	return r.index != nil
}

func (r *Runtime) Init() {
	if r.index != nil {
		return
	}
	r.index = newIndex()

	// TODO: the builtin-specific instances will ultimately also not be
	// shared by indexes.
	r.index.builtinPaths = sharedIndex.builtinPaths
	r.index.builtinShort = sharedIndex.builtinShort

	r.loaded = map[*build.Instance]interface{}{}

	cueexperiment.Init()
	if cueexperiment.Flags.EvalV3 {
		r.version = internal.DevVersion
	} else {
		r.version = internal.DefaultVersion
	}
	r.topoSort = cueexperiment.Flags.TopoSort
}
