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

package cuecontext

import (
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/runtime"
	"cuelang.org/go/internal/cuedebug"
	"cuelang.org/go/internal/envflag"

	_ "cuelang.org/go/pkg"
)

// Option controls a build context.
type Option struct {
	apply func(r *runtime.Runtime)
}

// defaultFlags defines the debug flags that are set by default.
var defaultFlags cuedebug.Config

func init() {
	if err := envflag.Parse(&defaultFlags, ""); err != nil {
		panic(err)
	}
}

// New creates a new Context.
func New(options ...Option) *cue.Context {
	r := runtime.New()
	// Ensure default behavior if the flags are not set explicitly.
	r.SetDebugOptions(&defaultFlags)
	for _, o := range options {
		o.apply(r)
	}
	return (*cue.Context)(r)
}

// An ExternInterpreter creates a compiler that can produce implementations of
// functions written in a language other than CUE. It is currently for internal
// use only.
type ExternInterpreter = runtime.Interpreter

// Interpreter associates an interpreter for external code with this context.
func Interpreter(i ExternInterpreter) Option {
	return Option{func(r *runtime.Runtime) {
		r.SetInterpreter(i)
	}}
}

type EvalVersion = internal.EvaluatorVersion

const (
	// EvalDefault is the latest stable version of the evaluator.
	EvalDefault EvalVersion = internal.DefaultVersion

	// EvalExperiment refers to the latest unstable version of the evaluator.
	// Note that this version may change without notice.
	EvalExperiment EvalVersion = internal.DevVersion

	// EvalV2 is the currently latest stable version of the evaluator.
	// It was introduced in CUE version 0.3 and is being maintained until 2024.
	EvalV2 EvalVersion = internal.EvalV2

	// EvalV3 is the currently experimental version of the evaluator.
	// It was introduced in 2024 and brought a new disjunction algorithm,
	// a new closedness algorithm, a new core scheduler, and adds performance
	// enhancements like structure sharing.
	EvalV3 EvalVersion = internal.EvalV3
)

// EvaluatorVersion indicates which version of the evaluator to use. Currently
// only experimental versions can be selected as an alternative.
func EvaluatorVersion(v EvalVersion) Option {
	return Option{func(r *runtime.Runtime) {
		r.SetVersion(v)
	}}
}

// CUE_DEBUG takes a string with the same contents as CUE_DEBUG and configures
// the context with the relevant debug options. It panics for unknown or
// malformed options.
func CUE_DEBUG(s string) Option {
	var c cuedebug.Config
	if err := envflag.Parse(&c, s); err != nil {
		panic(fmt.Errorf("cuecontext.CUE_DEBUG: %v", err))
	}

	return Option{func(r *runtime.Runtime) {
		r.SetDebugOptions(&c)
	}}
}
