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

package path

import (
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/pkg"
)

func init() {
	pkg.Register("path", p)
}

var _ = adt.TopKind // in case the adt package isn't used

var (
	osRequired = &adt.Disjunction{
		Values: allOS,
	}

	unixDefault = &adt.Disjunction{
		NumDefaults: 1,
		Values:      allOS,
	}

	// windowsDefault is the default for VolumeName.
	windowsDefault = &adt.Disjunction{
		NumDefaults: 1,
		Values: append([]adt.Value{
			newStr("windows"),
			newStr("unix"),
			newStr("plan9")}, unixOS...),
	}

	allOS = append([]adt.Value{
		newStr("unix"),
		newStr("windows"),
		newStr("plan9"),
	}, unixOS...)

	// These all fall back to unix
	unixOS = []adt.Value{
		newStr("aix"),
		newStr("android"),
		newStr("darwin"),
		newStr("dragonfly"),
		newStr("freebsd"),
		newStr("hurd"),
		newStr("illumos"),
		newStr("ios"),
		newStr("js"),
		newStr("linux"),
		newStr("nacl"),
		newStr("netbsd"),
		newStr("openbsd"),
		newStr("solaris"),
		newStr("zos"),
	}
)

func newStr(s string) adt.Value {
	return &adt.String{Str: s}
}

var p = &pkg.Package{
	CUE: `{
		Unix:    "unix"
		Windows: "windows"
		Plan9:   "plan9"
	}`,
	Native: []*pkg.Builtin{{
		Name: "Split",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.ListKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = Split(path, OS(os))
			}
		},
	}, {
		Name: "SplitList",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: osRequired},
		},
		Result: adt.ListKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = SplitList(path, OS(os))
			}
		},
	}, {
		Name: "Join",
		Params: []pkg.Param{
			{Kind: adt.ListKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			list, os := c.StringList(0), c.String(1)
			if c.Do() {
				c.Ret = Join(list, OS(os))
			}
		},
	}, {
		Name: "Match",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.BoolKind,
		Func: func(c *pkg.CallCtxt) {
			pattern, name, os := c.String(0), c.String(1), c.String(2)
			if c.Do() {
				c.Ret, c.Err = Match(pattern, name, OS(os))
			}
		},
	}, {
		Name: "Clean",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = Clean(path, OS(os))
			}
		},
	}, {
		Name: "ToSlash",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: osRequired},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = ToSlash(path, OS(os))
			}
		},
	}, {
		Name: "FromSlash",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: osRequired},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = FromSlash(path, OS(os))
			}
		},
	}, {
		Name: "Ext",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = Ext(path, OS(os))
			}
		},
	}, {
		Name: "Resolve",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			dir, sub, os := c.String(0), c.String(1), c.String(2)
			if c.Do() {
				c.Ret = Resolve(dir, sub, OS(os))
			}
		},
	}, {
		Name: "Rel",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			base, target, os := c.String(0), c.String(1), c.String(2)
			if c.Do() {
				c.Ret, c.Err = Rel(base, target, OS(os))
			}
		},
	}, {
		Name: "Base",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = Base(path, OS(os))
			}
		},
	}, {
		Name: "Dir",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = Dir(path, OS(os))
			}
		},
	}, {
		Name: "IsAbs",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: unixDefault},
		},
		Result: adt.BoolKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = IsAbs(path, OS(os))
			}
		},
	}, {
		Name: "VolumeName",
		Params: []pkg.Param{
			{Kind: adt.StringKind},
			{Kind: adt.StringKind, Value: windowsDefault},
		},
		Result: adt.StringKind,
		Func: func(c *pkg.CallCtxt) {
			path, os := c.String(0), c.String(1)
			if c.Do() {
				c.Ret = VolumeName(path, OS(os))
			}
		},
	}},
}
