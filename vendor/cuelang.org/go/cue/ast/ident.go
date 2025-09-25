// Copyright 2019 CUE Authors
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

package ast

import (
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

func isLetter(ch rune) bool {
	return 'a' <= ch && ch <= 'z' || 'A' <= ch && ch <= 'Z' || ch >= utf8.RuneSelf && unicode.IsLetter(ch)
}

func isDigit(ch rune) bool {
	// TODO(mpvl): Is this correct?
	return '0' <= ch && ch <= '9' || ch >= utf8.RuneSelf && unicode.IsDigit(ch)
}

// IsValidIdent reports whether str is a valid identifier.
// Note that the underscore "_" string is considered valid, for top.
func IsValidIdent(ident string) bool {
	if ident == "" {
		return false
	}

	consumed := false
	if strings.HasPrefix(ident, "_") {
		ident = ident[1:]
		consumed = true
		if len(ident) == 0 {
			return true
		}
	}
	if strings.HasPrefix(ident, "#") {
		ident = ident[1:]
		// Note: _#0 is not allowed by the spec, although _0 is.
		// TODO: set consumed to true here to allow #0.
		consumed = false
	}

	if !consumed {
		if r, _ := utf8.DecodeRuneInString(ident); isDigit(r) {
			return false
		}
	}

	for _, r := range ident {
		if isLetter(r) || isDigit(r) || r == '_' || r == '$' {
			continue
		}
		return false
	}
	return true
}

// LabelName reports the name of a label, whether it is an identifier
// (it binds a value to a scope), and whether it is valid.
// Keywords that are allowed in label positions are interpreted accordingly.
//
// Examples:
//
//	Label   Result
//	foo     "foo"  true   nil
//	true    "true" true   nil
//	"foo"   "foo"  false  nil
//	"x-y"   "x-y"  false  nil
//	"foo    ""     false  invalid string
//	"\(x)"  ""     false  errors.Is(err, ErrIsExpression)
//	X=foo   "foo"  true   nil
func LabelName(l Label) (name string, isIdent bool, err error) {
	if a, ok := l.(*Alias); ok {
		l, _ = a.Expr.(Label)
	}
	switch n := l.(type) {
	case *ListLit:
		// An expression, but not one that can evaluated.
		return "", false, errors.Newf(l.Pos(),
			"cannot reference fields with square brackets labels outside the field value")

	case *Ident:
		name = n.Name
		if !IsValidIdent(name) {
			return "", false, errors.Newf(l.Pos(), "invalid identifier")
		}
		return name, true, err

	case *BasicLit:
		switch n.Kind {
		case token.STRING:
			// Use strconv to only allow double-quoted, single-line strings.
			name, err = strconv.Unquote(n.Value)
			if err != nil {
				err = errors.Newf(l.Pos(), "invalid")
			}

		case token.NULL, token.TRUE, token.FALSE:
			name = n.Value
			isIdent = true

		default:
			// TODO: allow numbers to be fields
			// This includes interpolation and template labels.
			return "", false, errors.Wrapf(ErrIsExpression, l.Pos(),
				"cannot use numbers as fields")
		}
		return name, isIdent, err

	default:
		// This includes interpolation and template labels.
		return "", false, errors.Wrapf(ErrIsExpression, l.Pos(),
			"label is an expression")
	}
}

// ErrIsExpression reports whether a label is an expression.
// This error is never returned directly. Use [errors.Is].
var ErrIsExpression = errors.New("not a concrete label")
