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

package cue

import (
	"cuelang.org/go/internal/core/adt"
)

// Op indicates the operation at the top of an expression tree of the expression
// use to evaluate a value.
type Op = adt.Op

// Values of Op.
const (
	NoOp Op = adt.NoOp

	AndOp Op = adt.AndOp
	OrOp  Op = adt.OrOp

	SelectorOp Op = adt.SelectorOp
	IndexOp    Op = adt.IndexOp
	SliceOp    Op = adt.SliceOp
	CallOp     Op = adt.CallOp

	BooleanAndOp Op = adt.BoolAndOp
	BooleanOrOp  Op = adt.BoolOrOp

	EqualOp            Op = adt.EqualOp
	NotOp              Op = adt.NotOp
	NotEqualOp         Op = adt.NotEqualOp
	LessThanOp         Op = adt.LessThanOp
	LessThanEqualOp    Op = adt.LessEqualOp
	GreaterThanOp      Op = adt.GreaterThanOp
	GreaterThanEqualOp Op = adt.GreaterEqualOp

	RegexMatchOp    Op = adt.MatchOp
	NotRegexMatchOp Op = adt.NotMatchOp

	AddOp           Op = adt.AddOp
	SubtractOp      Op = adt.SubtractOp
	MultiplyOp      Op = adt.MultiplyOp
	FloatQuotientOp Op = adt.FloatQuotientOp
	IntQuotientOp   Op = adt.IntQuotientOp
	IntRemainderOp  Op = adt.IntRemainderOp
	IntDivideOp     Op = adt.IntDivideOp
	IntModuloOp     Op = adt.IntModuloOp

	InterpolationOp Op = adt.InterpolationOp
)
