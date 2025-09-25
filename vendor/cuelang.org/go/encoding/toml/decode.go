// Copyright 2024 The CUE Authors
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

// Package toml converts TOML to and from CUE.
//
// WARNING: THIS PACKAGE IS EXPERIMENTAL.
// ITS API MAY CHANGE AT ANY TIME.
package toml

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	toml "github.com/pelletier/go-toml/v2/unstable"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
)

// TODO(mvdan): schema and decode options

// NewDecoder creates a decoder from a stream of TOML input.
func NewDecoder(filename string, r io.Reader) *Decoder {
	// Note that we don't consume the reader here,
	// as there's no need, and we can't return an error either.
	return &Decoder{r: r, filename: filename, seenTableKeys: make(map[string]bool)}
}

// Decoder implements the decoding state.
//
// Note that TOML files and streams never decode multiple CUE nodes;
// subsequent calls to [Decoder.Decode] may return [io.EOF].
type Decoder struct {
	r io.Reader

	filename string

	decoded bool // whether [Decoder.Decoded] has been called already
	parser  toml.Parser

	// seenTableKeys tracks which rooted keys we have already decoded as tables,
	// as duplicate table keys in TOML are not allowed.
	seenTableKeys map[rootedKey]bool

	// topFile is the top-level CUE file we are decoding into.
	// TODO(mvdan): make an *ast.File once the decoder returns ast.Node rather than ast.Expr.
	topFile *ast.StructLit

	// tokenFile is used to create positions which can be used for error values and syntax tree nodes.
	tokenFile *token.File

	// openTableArrays keeps track of all the declared table arrays so that
	// later headers can append a new table array element, or add a field
	// to the last element in a table array.
	//
	// TODO(mvdan): an unsorted slice means we do two linear searches per header key.
	// For N distinct `[[keys]]`, this means a decoding runtime of O(2*N*N).
	// Consider either sorting this array so we can do a binary search for O(N*log2(N)),
	// or perhaps a tree, although for a nesting level D, that could cause O(N*D),
	// and a tree would use more slices and so more allocations.
	//
	// Note that a map is not a good option either, because even though it makes
	// exact lookups cheap, prefix matches are still linear and relatively slow.
	// A sorted slice allows both mechanisms to use a form of binary search.
	openTableArrays []openTableArray

	// currentTableKey is the rooted key for the current table where the following
	// TOML `key = value` lines will be inserted.
	currentTableKey rootedKey

	// currentTable is the CUE struct literal for currentTableKey.
	// It is nil before the first [header] or [[header]],
	// in which case any key-values are inserted in topFile.
	currentTable *ast.StructLit
}

// rootedKey is a dot-separated path from the root of the TOML document.
// The string elements in between the dots may be quoted to avoid ambiguity.
// For the time being, this is just an alias for the sake of documentation.
//
// A path into an array element is like "arr.3",
// which looks very similar to a table's "tbl.key",
// particularly since a table key can be any string.
// However, we just need these keys to detect duplicates,
// and a path cannot be both an array and table, so it's OK.
type rootedKey = string

// openTableArray records information about a declared table array.
type openTableArray struct {
	rkey      rootedKey
	level     int // the level of nesting, 1 or higher, e.g. 2 for key="foo.bar"
	list      *ast.ListLit
	lastTable *ast.StructLit
}

// TODO(mvdan): support decoding comments

// Decode parses the input stream as TOML and converts it to a CUE [*ast.File].
// Because TOML files only contain a single top-level expression,
// subsequent calls to this method may return [io.EOF].
func (d *Decoder) Decode() (ast.Expr, error) {
	if d.decoded {
		return nil, io.EOF
	}
	d.decoded = true
	// TODO(mvdan): unfortunately go-toml does not support streaming as of v2.2.2.
	data, err := io.ReadAll(d.r)
	if err != nil {
		return nil, err
	}
	d.tokenFile = token.NewFile(d.filename, 0, len(data))
	d.tokenFile.SetLinesForContent(data)
	d.parser.Reset(data)
	// Note that if the input is empty the result will be the same
	// as for an empty table: an empty struct.
	// The TOML spec and other decoders also work this way.
	d.topFile = &ast.StructLit{}
	for d.parser.NextExpression() {
		if err := d.nextRootNode(d.parser.Expression()); err != nil {
			return nil, err
		}
	}
	if err := d.parser.Error(); err != nil {
		if err, ok := err.(*toml.ParserError); ok {
			shape := d.parser.Shape(d.parser.Range(err.Highlight))
			return nil, d.posErrf(shape.Start, "%s", err.Message)
		}
		return nil, err
	}
	return d.topFile, nil
}

func (d *Decoder) shape(tnode *toml.Node) toml.Shape {
	if tnode.Raw.Length == 0 {
		// Otherwise the Shape method call below happily returns a position like 1:1,
		// which is worse than no position information as it confuses the user.
		panic("Decoder.nodePos was given an empty toml.Node as position")
	}
	return d.parser.Shape(tnode.Raw)
}

func (d *Decoder) nodeErrf(tnode *toml.Node, format string, args ...any) error {
	return d.posErrf(d.shape(tnode).Start, format, args...)
}

func (d *Decoder) posErrf(pos toml.Position, format string, args ...any) error {
	return errors.Newf(d.tokenFile.Pos(pos.Offset, token.NoRelPos), format, args...)
}

// nextRootNode is called for every top-level expression from the TOML parser.
//
// This method does not return a syntax tree node directly,
// because some kinds of top-level expressions like comments and table headers
// require recording some state in the decoder to produce a node at a later time.
func (d *Decoder) nextRootNode(tnode *toml.Node) error {
	switch tnode.Kind {
	// Key-Values in TOML are in the form of:
	//
	//   foo.title = "Foo"
	//   foo.bar.baz = "value"
	//
	// We decode them as "inline" structs in CUE, which keeps the original shape:
	//
	//   foo: title: "Foo"
	//   foo: bar: baz: "value"
	//
	// An alternative would be to join struct literals, which avoids some repetition,
	// but also introduces extra lines and may break some comment positions:
	//
	//   foo: {
	//       title: "Foo"
	//       bar: baz: "value"
	//   }
	case toml.KeyValue:
		// Top-level fields begin a new line.
		field, err := d.decodeField(d.currentTableKey, tnode, token.Newline)
		if err != nil {
			return err
		}
		if d.currentTable != nil {
			d.currentTable.Elts = append(d.currentTable.Elts, field)
		} else {
			d.topFile.Elts = append(d.topFile.Elts, field)
		}

	case toml.Table:
		// Tables always begin a new line.
		key, keyElems := d.decodeKey("", tnode.Key())
		// All table keys must be unique, including for the top-level table.
		if d.seenTableKeys[key] {
			return d.nodeErrf(tnode.Child(), "duplicate key: %s", key)
		}
		d.seenTableKeys[key] = true

		// We want a multi-line struct with curly braces,
		// just like TOML's tables are on multiple lines.
		d.currentTable = &ast.StructLit{
			// No positions, as TOML doesn't have table delimiters.
			Lbrace: token.NoPos.WithRel(token.Blank),
			Rbrace: token.NoPos.WithRel(token.Newline),
		}
		array := d.findArrayPrefix(key)
		if array != nil { // [last_array.new_table]
			if array.rkey == key {
				return d.nodeErrf(tnode.Child(), "cannot redeclare table array %q as a table", key)
			}
			subKeyElems := keyElems[array.level:]
			topField, leafField := d.inlineFields(subKeyElems, token.Newline)
			array.lastTable.Elts = append(array.lastTable.Elts, topField)
			leafField.Value = d.currentTable
		} else { // [new_table]
			topField, leafField := d.inlineFields(keyElems, token.Newline)
			d.topFile.Elts = append(d.topFile.Elts, topField)
			leafField.Value = d.currentTable
		}
		d.currentTableKey = key

	case toml.ArrayTable:
		// Table array elements always begin a new line.
		key, keyElems := d.decodeKey("", tnode.Key())
		if d.seenTableKeys[key] {
			return d.nodeErrf(tnode.Child(), "cannot redeclare key %q as a table array", key)
		}
		// Each struct inside a table array sits on separate lines.
		d.currentTable = &ast.StructLit{
			// No positions, as TOML doesn't have table delimiters.
			Lbrace: token.NoPos.WithRel(token.Newline),
			Rbrace: token.NoPos.WithRel(token.Newline),
		}
		if array := d.findArrayPrefix(key); array != nil && array.level == len(keyElems) {
			// [[last_array]] - appending to an existing array.
			d.currentTableKey = key + "." + strconv.Itoa(len(array.list.Elts))
			array.lastTable = d.currentTable
			array.list.Elts = append(array.list.Elts, d.currentTable)
		} else {
			// Creating a new array via either [[new_array]] or [[last_array.new_array]].
			// We want a multi-line list with square braces,
			// since TOML's table arrays are on multiple lines.
			list := &ast.ListLit{
				// No positions, as TOML doesn't have array table delimiters.
				Lbrack: token.NoPos.WithRel(token.Blank),
				Rbrack: token.NoPos.WithRel(token.Newline),
			}
			if array == nil {
				// [[new_array]] - at the top level
				topField, leafField := d.inlineFields(keyElems, token.Newline)
				d.topFile.Elts = append(d.topFile.Elts, topField)
				leafField.Value = list
			} else {
				// [[last_array.new_array]] - on the last array element
				subKeyElems := keyElems[array.level:]
				topField, leafField := d.inlineFields(subKeyElems, token.Newline)
				array.lastTable.Elts = append(array.lastTable.Elts, topField)
				leafField.Value = list
			}

			d.currentTableKey = key + ".0"
			list.Elts = append(list.Elts, d.currentTable)
			d.openTableArrays = append(d.openTableArrays, openTableArray{
				rkey:      key,
				level:     len(keyElems),
				list:      list,
				lastTable: d.currentTable,
			})
		}

	default:
		return fmt.Errorf("encoding/toml.Decoder.nextRootNode: unknown %s %#v", tnode.Kind, tnode)
	}
	return nil
}

// decodeField decodes a single table key and its value as a struct field.
func (d *Decoder) decodeField(rkey rootedKey, tnode *toml.Node, relPos token.RelPos) (*ast.Field, error) {
	rkey, keyElems := d.decodeKey(rkey, tnode.Key())
	if d.findArray(rkey) != nil {
		return nil, d.nodeErrf(tnode.Child().Next(), "cannot redeclare table array %q as a table", rkey)
	}
	topField, leafField := d.inlineFields(keyElems, relPos)
	// All table keys must be unique, including inner table ones.
	if d.seenTableKeys[rkey] {
		return nil, d.nodeErrf(tnode.Child().Next(), "duplicate key: %s", rkey)
	}
	d.seenTableKeys[rkey] = true
	value, err := d.decodeExpr(rkey, tnode.Value())
	if err != nil {
		return nil, err
	}
	leafField.Value = value
	return topField, nil
}

// findArray returns an existing table array if one exists at exactly the given key.
func (d *Decoder) findArray(rkey rootedKey) *openTableArray {
	for i, arr := range d.openTableArrays {
		if arr.rkey == rkey {
			return &d.openTableArrays[i]
		}
	}
	return nil
}

// findArray returns an existing table array if one exists at exactly the given key
// or as a prefix to the given key.
func (d *Decoder) findArrayPrefix(rkey rootedKey) *openTableArray {
	// TODO(mvdan): see the performance TODO on [Decoder.openTableArrays].

	// Prefer an exact match over a relative prefix match.
	if arr := d.findArray(rkey); arr != nil {
		return arr
	}
	// The longest relative key match wins.
	maxLevel := 0
	var maxLevelArr *openTableArray
	for i, arr := range d.openTableArrays {
		if strings.HasPrefix(rkey, arr.rkey+".") && arr.level > maxLevel {
			maxLevel = arr.level
			maxLevelArr = &d.openTableArrays[i]
		}
	}
	if maxLevel > 0 {
		return maxLevelArr
	}
	return nil
}

// tomlKey represents a name with a position which forms part of a TOML dotted key,
// such as "foo" from "[foo.bar.baz]".
type tomlKey struct {
	name  string
	shape toml.Shape
}

// decodeKey extracts a rootedKey from a TOML node key iterator,
// appending to the given parent key and returning the unquoted string elements.
func (d *Decoder) decodeKey(rkey rootedKey, iter toml.Iterator) (rootedKey, []tomlKey) {
	var elems []tomlKey
	for iter.Next() {
		node := iter.Node()
		name := string(node.Data)
		// TODO(mvdan): use an append-like API once we have benchmarks
		if len(rkey) > 0 {
			rkey += "."
		}
		rkey += quoteLabelIfNeeded(name)
		elems = append(elems, tomlKey{name, d.shape(node)})
	}
	return rkey, elems
}

// inlineFields constructs a single-line chain of CUE fields joined with structs,
// so that an input like:
//
//	["foo", "bar.baz", "zzz"]
//
// results in the CUE fields:
//
//	foo: "bar.baz": zzz: <nil>
//
// The "top" field, in this case "foo", can then be added as an element to a struct.
// The "leaf" field, in this case "zzz", leaves its value as nil to be filled out.
func (d *Decoder) inlineFields(tkeys []tomlKey, relPos token.RelPos) (top, leaf *ast.Field) {
	curField := &ast.Field{
		Label: d.label(tkeys[0], relPos),
	}

	topField := curField
	for _, tkey := range tkeys[1:] {
		nextField := &ast.Field{
			Label: d.label(tkey, token.Blank), // on the same line
		}
		curField.Value = &ast.StructLit{Elts: []ast.Decl{nextField}}
		curField = nextField
	}
	return topField, curField
}

// quoteLabelIfNeeded quotes a label name only if it needs quoting.
//
// TODO(mvdan): this exists in multiple packages; move to cue/literal or cue/ast?
func quoteLabelIfNeeded(name string) string {
	if ast.IsValidIdent(name) {
		return name
	}
	return literal.Label.Quote(name)
}

// label creates an ast.Label that represents a key with exactly the literal string name.
// This means a quoted string literal for the key "_", as TOML never means "top",
// as well as for any keys beginning with an underscore, as we don't want to hide any fields.
// cue/format knows how to quote any other identifiers correctly.
func (d *Decoder) label(tkey tomlKey, relPos token.RelPos) ast.Label {
	pos := d.tokenFile.Pos(tkey.shape.Start.Offset, relPos)
	if strings.HasPrefix(tkey.name, "_") {
		return &ast.BasicLit{
			ValuePos: pos,
			Kind:     token.STRING,
			Value:    literal.String.Quote(tkey.name),
		}
	}
	return &ast.Ident{
		NamePos: pos,
		Name:    tkey.name,
	}
}

// decodeExpr decodes a single TOML value expression, found on the right side
// of a `key = value` line.
func (d *Decoder) decodeExpr(rkey rootedKey, tnode *toml.Node) (ast.Expr, error) {
	// TODO(mvdan): we currently assume that TOML basic literals (string, int, float)
	// are also valid CUE literals; we should double check this, perhaps via fuzzing.
	data := string(tnode.Data)
	var expr ast.Expr
	switch tnode.Kind {
	case toml.String:
		expr = ast.NewString(data)
	case toml.Integer:
		expr = ast.NewLit(token.INT, data)
	case toml.Float:
		expr = ast.NewLit(token.FLOAT, data)
	case toml.Bool:
		expr = ast.NewBool(data == "true")
	case toml.Array:
		list := &ast.ListLit{}
		elems := tnode.Children()
		for elems.Next() {
			key := rkey + "." + strconv.Itoa(len(list.Elts))
			elem, err := d.decodeExpr(key, elems.Node())
			if err != nil {
				return nil, err
			}
			list.Elts = append(list.Elts, elem)
		}
		expr = list
	case toml.InlineTable:
		strct := &ast.StructLit{
			// We want a single-line struct, just like TOML's inline tables are on a single line.
			Lbrace: token.NoPos.WithRel(token.Blank),
			Rbrace: token.NoPos.WithRel(token.Blank),
		}
		elems := tnode.Children()
		for elems.Next() {
			// Inline table fields are on the same line.
			field, err := d.decodeField(rkey, elems.Node(), token.Blank)
			if err != nil {
				return nil, err
			}
			strct.Elts = append(strct.Elts, field)
		}
		expr = strct
	case toml.LocalDate, toml.LocalTime, toml.LocalDateTime, toml.DateTime:
		// CUE does not have native date nor time literal kinds,
		// so we decode these as strings exactly as they came in
		// and we validate them with time.Format using the corresponding format string.
		// Not only does this ensure that the resulting CUE can be used with our time package,
		// but it also means that we can roundtrip a TOML timestamp without confusing it for a string.
		var format ast.Expr
		switch tnode.Kind {
		case toml.LocalDate:
			// TODO(mvdan): rename time.RFC3339Date to time.DateOnly to mirror Go
			format = ast.NewSel(&ast.Ident{
				Name: "time",
				Node: ast.NewImport(nil, "time"),
			}, "RFC3339Date")
		case toml.LocalTime:
			// TODO(mvdan): add TimeOnly to CUE's time package to mirror Go
			format = ast.NewString(time.TimeOnly)
		case toml.LocalDateTime:
			// RFC3339 minus the timezone; this seems like a format peculiar to TOML.
			format = ast.NewString("2006-01-02T15:04:05")
		default: // DateTime
			format = ast.NewSel(&ast.Ident{
				Name: "time",
				Node: ast.NewImport(nil, "time"),
			}, "RFC3339")
		}
		expr = ast.NewBinExpr(token.AND, ast.NewString(data), ast.NewCall(
			ast.NewSel(&ast.Ident{
				Name: "time",
				Node: ast.NewImport(nil, "time"),
			}, "Format"), format),
		)
	default:
		return nil, fmt.Errorf("encoding/toml.Decoder.decodeExpr: unknown %s %#v", tnode.Kind, tnode)
	}
	// TODO(mvdan): some go-toml nodes such as Kind=toml.Bool do not seem to have a Raw Range
	// which would let us grab their position information; fix this upstream.
	if tnode.Raw.Length > 0 {
		ast.SetPos(expr, d.tokenFile.Pos(d.shape(tnode).Start.Offset, token.NoRelPos))
	}
	return expr, nil
}
