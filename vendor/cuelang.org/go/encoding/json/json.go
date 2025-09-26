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

// Package json converts JSON to and from CUE.
package json

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/source"
)

// Valid reports whether data is a valid JSON encoding.
func Valid(b []byte) bool {
	return json.Valid(b)
}

// Validate validates JSON and confirms it matches the constraints
// specified by v.
func Validate(b []byte, v cue.Value) error {
	if !json.Valid(b) {
		return fmt.Errorf("json: invalid JSON")
	}
	v2 := v.Context().CompileBytes(b, cue.Filename("json.Validate"))
	if err := v2.Err(); err != nil {
		return err
	}

	v = v.Unify(v2)
	if err := v.Err(); err != nil {
		return err
	}
	return v.Validate(cue.Final())
}

// Extract parses JSON-encoded data to a CUE expression, using path for
// position information.
func Extract(path string, data []byte) (ast.Expr, error) {
	expr, err := extract(path, data)
	if err != nil {
		return nil, err
	}
	patchExpr(expr, nil)
	return expr, nil
}

func extract(path string, b []byte) (ast.Expr, error) {
	expr, err := parser.ParseExpr(path, b)
	if err != nil || !json.Valid(b) {
		p := token.NoPos
		if pos := errors.Positions(err); len(pos) > 0 {
			p = pos[0]
		}
		var x interface{}
		err := json.Unmarshal(b, &x)

		// If encoding/json has a position, prefer that, as it relates to json.Unmarshal's error message.
		if synErr, ok := err.(*json.SyntaxError); ok && len(b) > 0 {
			tokFile := token.NewFile(path, 0, len(b))
			tokFile.SetLinesForContent(b)
			p = tokFile.Pos(int(synErr.Offset-1), token.NoRelPos)
		}

		return nil, errors.Wrapf(err, p, "invalid JSON for file %q", path)
	}
	return expr, nil
}

// NewDecoder configures a JSON decoder. The path is used to associate position
// information with each node. The runtime may be nil if the decoder
// is only used to extract to CUE ast objects.
//
// The runtime argument is a historical remnant and unused.
func NewDecoder(r *cue.Runtime, path string, src io.Reader) *Decoder {
	b, err := source.ReadAll(path, src)
	tokFile := token.NewFile(path, 0, len(b))
	tokFile.SetLinesForContent(b)
	return &Decoder{
		path:       path,
		dec:        json.NewDecoder(bytes.NewReader(b)),
		tokFile:    tokFile,
		readAllErr: err,
	}
}

// A Decoder converts JSON values to CUE.
type Decoder struct {
	path string
	dec  *json.Decoder

	startOffset int
	tokFile     *token.File
	readAllErr  error
}

// Extract converts the current JSON value to a CUE ast. It returns io.EOF
// if the input has been exhausted.
func (d *Decoder) Extract() (ast.Expr, error) {
	if d.readAllErr != nil {
		return nil, d.readAllErr
	}

	expr, err := d.extract()
	if err != nil {
		return expr, err
	}
	patchExpr(expr, d.patchPos)
	return expr, nil
}

func (d *Decoder) extract() (ast.Expr, error) {
	var raw json.RawMessage
	err := d.dec.Decode(&raw)
	if err == io.EOF {
		return nil, err
	}
	if err != nil {
		pos := token.NoPos
		// When decoding into a RawMessage, encoding/json should only error due to syntax errors.
		if synErr, ok := err.(*json.SyntaxError); ok {
			pos = d.tokFile.Pos(int(synErr.Offset-1), token.NoRelPos)
		}
		return nil, errors.Wrapf(err, pos, "invalid JSON for file %q", d.path)
	}
	expr, err := parser.ParseExpr(d.path, []byte(raw))
	if err != nil {
		return nil, err
	}

	d.startOffset = int(d.dec.InputOffset()) - len(raw)
	return expr, nil
}

func (d *Decoder) patchPos(n ast.Node) {
	pos := n.Pos()
	realPos := d.tokFile.Pos(pos.Offset()+d.startOffset, pos.RelPos())
	ast.SetPos(n, realPos)
}

// patchExpr simplifies the AST parsed from JSON.
// TODO: some of the modifications are already done in format, but are
// a package deal of a more aggressive simplify. Other pieces of modification
// should probably be moved to format.
func patchExpr(n ast.Node, patchPos func(n ast.Node)) {
	type info struct {
		reflow bool
	}
	stack := []info{{true}}

	afterFn := func(n ast.Node) {
		switch n.(type) {
		case *ast.ListLit, *ast.StructLit:
			stack = stack[:len(stack)-1]
		}
	}

	var beforeFn func(n ast.Node) bool

	beforeFn = func(n ast.Node) bool {
		if patchPos != nil {
			patchPos(n)
		}

		isLarge := n.End().Offset()-n.Pos().Offset() > 50
		descent := true

		switch x := n.(type) {
		case *ast.ListLit:
			reflow := true
			if !isLarge {
				for _, e := range x.Elts {
					if hasSpaces(e) {
						reflow = false
						break
					}
				}
			}
			stack = append(stack, info{reflow})
			if reflow {
				x.Lbrack = x.Lbrack.WithRel(token.NoRelPos)
				x.Rbrack = x.Rbrack.WithRel(token.NoRelPos)
			}
			return true

		case *ast.StructLit:
			reflow := true
			if !isLarge {
				for _, e := range x.Elts {
					if f, ok := e.(*ast.Field); !ok || hasSpaces(f) || hasSpaces(f.Value) {
						reflow = false
						break
					}
				}
			}
			stack = append(stack, info{reflow})
			if reflow {
				x.Lbrace = x.Lbrace.WithRel(token.NoRelPos)
				x.Rbrace = x.Rbrace.WithRel(token.NoRelPos)
			}
			return true

		case *ast.Field:
			// label is always a string for JSON.
			switch {
			case true:
				s, ok := x.Label.(*ast.BasicLit)
				if !ok || s.Kind != token.STRING {
					break // should not happen: implies invalid JSON
				}

				u, err := literal.Unquote(s.Value)
				if err != nil {
					break // should not happen: implies invalid JSON
				}

				// TODO(legacy): remove checking for '_' prefix once hidden
				// fields are removed.
				if !ast.IsValidIdent(u) || strings.HasPrefix(u, "_") {
					break // keep string
				}

				x.Label = ast.NewIdent(u)
				astutil.CopyMeta(x.Label, s)
			}
			ast.Walk(x.Value, beforeFn, afterFn)
			descent = false

		case *ast.BasicLit:
			if x.Kind == token.STRING && len(x.Value) > 10 {
				s, err := literal.Unquote(x.Value)
				if err != nil {
					break // should not happen: implies invalid JSON
				}

				x.Value = literal.String.WithOptionalTabIndent(len(stack)).Quote(s)
			}
		}

		if stack[len(stack)-1].reflow {
			ast.SetRelPos(n, token.NoRelPos)
		}
		return descent
	}

	ast.Walk(n, beforeFn, afterFn)
}

func hasSpaces(n ast.Node) bool {
	return n.Pos().RelPos() > token.NoSpace
}
