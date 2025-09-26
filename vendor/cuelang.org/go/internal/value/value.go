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

// Package value contains functions for converting values to internal types
// and various other Value-related utilities.
package value

import (
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/convert"
	"cuelang.org/go/internal/core/eval"
	"cuelang.org/go/internal/core/runtime"
	"cuelang.org/go/internal/types"
)

func ConvertToContext[Ctx *cue.Runtime | *cue.Context](ctx Ctx) *cue.Context {
	if ctx, ok := any(ctx).(*cue.Runtime); ok {
		(*runtime.Runtime)(ctx).Init()
	}
	return (*cue.Context)(ctx)
}

func ToInternal(v cue.Value) (*runtime.Runtime, *adt.Vertex) {
	var t types.Value
	v.Core(&t)
	return t.R, t.V
}

// Make wraps cue.MakeValue.
func Make(ctx *adt.OpContext, v adt.Value) cue.Value {
	return (*cue.Context)(ctx.Impl().(*runtime.Runtime)).Encode(v)
}

// UnifyBuiltin returns the given Value unified with the given builtin template.
func UnifyBuiltin(v cue.Value, kind string) cue.Value {
	pkg, name, _ := strings.Cut(kind, ".")
	s := runtime.SharedRuntime().LoadImport(pkg)
	if s == nil {
		return v
	}

	ctx := v.Context()
	a := s.Lookup((*runtime.Runtime)(ctx).Label(name, false))
	if a == nil {
		return v
	}

	return v.Unify(ctx.Encode(a))
}

func FromGoValue(r *cue.Context, x interface{}, nilIsTop bool) cue.Value {
	rt := (*runtime.Runtime)(r)
	rt.Init()
	ctx := eval.NewContext(rt, nil)
	v := convert.GoValueToValue(ctx, x, nilIsTop)
	n := adt.ToVertex(v)
	return r.Encode(n)
}

func FromGoType(r *cue.Context, x interface{}) cue.Value {
	rt := (*runtime.Runtime)(r)
	rt.Init()
	ctx := eval.NewContext(rt, nil)
	expr, err := convert.GoTypeToExpr(ctx, x)
	if err != nil {
		expr = &adt.Bottom{Err: err}
	}
	n := &adt.Vertex{}
	n.AddConjunct(adt.MakeRootConjunct(nil, expr))
	return r.Encode(n)
}
