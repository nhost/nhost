// Copyright 2024 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package compile

// This file contains validator and other non-monotonic builtins.

import (
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/validate"
)

// matchN is a validator that checks that the number of schemas in the given
// list that unify with "self" matches the number passed as the first argument
// of the validator. Note that this number may itself be a number constraint
// and does not have to be a concrete number.
var matchNBuiltin = &adt.Builtin{
	Name:        "matchN",
	Params:      []adt.Param{topParam, intParam, listParam}, // varargs
	Result:      adt.BoolKind,
	NonConcrete: true,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		if !c.IsValidator {
			return c.NewErrf("matchN is a validator and should not be used as a function")
		}

		self := finalizeSelf(c, args[0])
		if err := bottom(c, self); err != nil {
			return &adt.Bool{B: false}
		}

		constraints := c.Elems(args[2])

		var count, possibleCount int64
		for _, check := range constraints {
			v := unifyValidator(c, self, check)
			if err := validate.Validate(c, v, finalCfg); err == nil {
				// TODO: is it always true that the lack of an error signifies
				// success?
				count++
			} else {
				if err.IsIncomplete() {
					possibleCount++
				}
			}
		}

		bound := args[1]
		// TODO: consider a mode to require "all" to pass, for instance by
		// supporting the value null or "all".

		b := checkNum(c, bound, count, count+possibleCount)
		if b != nil {
			return b
		}
		return &adt.Bool{B: true}
	},
}

// matchIf is a validator that checks that if the first argument unifies with
// self, the second argument also unifies with self, otherwise the third
// argument unifies with self.
// The same finalization heuristics are applied to self as are applied
// in matchN.
var matchIfBuiltin = &adt.Builtin{
	Name:        "matchIf",
	Params:      []adt.Param{topParam, topParam, topParam, topParam},
	Result:      adt.BoolKind,
	NonConcrete: true,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		if !c.IsValidator {
			return c.NewErrf("matchIf is a validator and should not be used as a function")
		}

		self := finalizeSelf(c, args[0])
		if err := bottom(c, self); err != nil {
			return &adt.Bool{B: false}
		}
		ifSchema, thenSchema, elseSchema := args[1], args[2], args[3]
		v := unifyValidator(c, self, ifSchema)
		var chosenSchema adt.Value
		if err := validate.Validate(c, v, finalCfg); err == nil {
			chosenSchema = thenSchema
		} else {
			chosenSchema = elseSchema
		}
		v = unifyValidator(c, self, chosenSchema)
		err := validate.Validate(c, v, finalCfg)
		if err == nil {
			return &adt.Bool{B: true}
		}
		// TODO should we also include in the error something about the fact that
		// the if condition passed or failed?
		return err
	},
}

var finalCfg = &validate.Config{Final: true}

// finalizeSelf ensures a value is fully evaluated and then strips it of any
// of its validators or default values.
func finalizeSelf(c *adt.OpContext, self adt.Value) adt.Value {
	if x, ok := self.(*adt.Vertex); ok {
		self = x.ToDataAll(c)
	}
	return self
}

func unifyValidator(c *adt.OpContext, self, check adt.Value) *adt.Vertex {
	v := &adt.Vertex{}
	closeInfo := c.CloseInfo()
	v.AddConjunct(adt.MakeConjunct(nil, self, closeInfo))
	v.AddConjunct(adt.MakeConjunct(nil, check, closeInfo))
	v.Finalize(c)
	return v
}

func checkNum(ctx *adt.OpContext, bound adt.Value, count, maxCount int64) *adt.Bottom {
	cnt := ctx.NewInt64(count)
	n := unifyValidator(ctx, bound, cnt)
	b, _ := n.BaseValue.(*adt.Bottom)
	if b != nil {
		b := ctx.NewErrf("%d matched, expected %v", count, bound)

		// By default we should mark the error as incomplete, but check if we
		// know for sure it will fail.
		switch bound := bound.(type) {
		case *adt.Num:
			if i, err := bound.X.Int64(); err == nil && i > count && i <= maxCount {
				b.Code = adt.IncompleteError
			}

		case *adt.BoundValue:
			v := &adt.Vertex{}
			v.AddConjunct(ctx.MakeConjunct(bound))
			v.AddConjunct(ctx.MakeConjunct(&adt.BoundValue{
				Op:    adt.GreaterEqualOp,
				Value: cnt,
			}))
			v.AddConjunct(ctx.MakeConjunct(&adt.BoundValue{
				Op:    adt.LessEqualOp,
				Value: ctx.NewInt64(maxCount),
			}))
			v.Finalize(ctx)
			if _, ok := v.BaseValue.(*adt.Bottom); !ok {
				b.Code = adt.IncompleteError
			}

		default:
			b.Code = adt.IncompleteError
		}

		return b
	}
	return nil
}

func bottom(c *adt.OpContext, v adt.Value) *adt.Bottom {
	switch x := v.(type) {
	case *adt.Vertex:
		return x.Err(c)
	case *adt.Bottom:
		return x
	}
	return nil
}
