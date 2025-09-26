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

package adt

import (
	"cuelang.org/go/internal"
	"github.com/cockroachdb/apd/v3"
)

func (n *Num) Impl() *apd.Decimal {
	return &n.X
}

func (n *Num) Negative() bool {
	return n.X.Negative
}

func (a *Num) Cmp(b *Num) int {
	return a.X.Cmp(&b.X)
}

func (c *OpContext) Add(a, b *Num) Value {
	return numOp(c, internal.BaseContext.Add, a, b)
}

func (c *OpContext) Sub(a, b *Num) Value {
	return numOp(c, internal.BaseContext.Sub, a, b)
}

func (c *OpContext) Mul(a, b *Num) Value {
	return numOp(c, internal.BaseContext.Mul, a, b)
}

func (c *OpContext) Quo(a, b *Num) Value {
	v := numOp(c, internal.BaseContext.Quo, a, b)
	if n, ok := v.(*Num); ok {
		n.K = FloatKind
	}
	return v
}

func (c *OpContext) Pow(a, b *Num) Value {
	return numOp(c, internal.BaseContext.Pow, a, b)
}

type numFunc func(z, x, y *apd.Decimal) (apd.Condition, error)

func numOp(c *OpContext, fn numFunc, x, y *Num) Value {
	var d apd.Decimal

	cond, err := fn(&d, &x.X, &y.X)

	if err != nil {
		return c.NewErrf("failed arithmetic: %v", err)
	}

	if cond.DivisionByZero() {
		return c.NewErrf("division by zero")
	}

	k := x.Kind() & y.Kind()
	if k == 0 {
		k = FloatKind
	}
	return c.newNum(&d, k)
}

func (c *OpContext) IntDiv(a, b *Num) Value {
	return intDivOp(c, (*apd.BigInt).Div, a, b)
}

func (c *OpContext) IntMod(a, b *Num) Value {
	return intDivOp(c, (*apd.BigInt).Mod, a, b)
}

func (c *OpContext) IntQuo(a, b *Num) Value {
	return intDivOp(c, (*apd.BigInt).Quo, a, b)
}

func (c *OpContext) IntRem(a, b *Num) Value {
	return intDivOp(c, (*apd.BigInt).Rem, a, b)
}

type intFunc func(z, x, y *apd.BigInt) *apd.BigInt

func intDivOp(c *OpContext, fn intFunc, a, b *Num) Value {
	if b.X.IsZero() {
		return c.NewErrf("division by zero")
	}

	var x, y apd.Decimal
	_, _ = internal.BaseContext.RoundToIntegralValue(&x, &a.X)
	if x.Negative {
		x.Coeff.Neg(&x.Coeff)
	}
	_, _ = internal.BaseContext.RoundToIntegralValue(&y, &b.X)
	if y.Negative {
		y.Coeff.Neg(&y.Coeff)
	}

	var d apd.Decimal

	fn(&d.Coeff, &x.Coeff, &y.Coeff)

	if d.Coeff.Sign() < 0 {
		d.Coeff.Neg(&d.Coeff)
		d.Negative = true
	}

	return c.newNum(&d, IntKind)
}
