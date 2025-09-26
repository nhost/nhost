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

package internal

import (
	"fmt"
	"strconv"
	"strings"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/scanner"
	"cuelang.org/go/cue/token"
)

// AttrKind indicates the location of an attribute within CUE source.
type AttrKind uint8

const (
	// FieldAttr indicates an attribute is a field attribute.
	// foo: bar @attr()
	FieldAttr AttrKind = 1 << iota

	// DeclAttr indicates an attribute was specified at a declaration position.
	// foo: {
	//     @attr()
	// }
	DeclAttr

	// TODO: Possible future attr kinds
	// ElemAttr
	// FileAttr
	// ValueAttr = FieldAttr|DeclAttr|ElemAttr
)

// Attr holds positional information for a single Attr.
type Attr struct {
	Name   string // e.g. "json" or "protobuf"
	Body   string
	Kind   AttrKind
	Fields []KeyValue
	Err    errors.Error
	Pos    token.Pos
}

// NewNonExisting creates a non-existing attribute.
func NewNonExisting(key string) Attr {
	const msgNotExist = "attribute %q does not exist"
	return Attr{Err: errors.Newf(token.NoPos, msgNotExist, key)}
}

type KeyValue struct {
	key   string
	value string
	text  string
}

func (kv *KeyValue) Text() string {
	return kv.text
}

func (kv *KeyValue) Key() string {
	return kv.key
}

func (kv *KeyValue) Value() string {
	return kv.value
}

func (a *Attr) hasPos(p int) error {
	if a.Err != nil {
		return a.Err
	}
	if p >= len(a.Fields) {
		return fmt.Errorf("field does not exist")
	}
	return nil
}

// String reports the possibly empty string value at the given position or
// an error the attribute is invalid or if the position does not exist.
func (a *Attr) String(pos int) (string, error) {
	if err := a.hasPos(pos); err != nil {
		return "", err
	}
	f := a.Fields[pos]
	if f.key != "" {
		// When there's a key, we return the entire value.
		return f.Text(), nil
	}
	return a.Fields[pos].Value(), nil
}

// Int reports the integer at the given position or an error if the attribute is
// invalid, the position does not exist, or the value at the given position is
// not an integer.
func (a *Attr) Int(pos int) (int64, error) {
	if err := a.hasPos(pos); err != nil {
		return 0, err
	}
	// TODO: use CUE's literal parser once it exists, allowing any of CUE's
	// number types.
	return strconv.ParseInt(a.Fields[pos].Text(), 10, 64)
}

// Flag reports whether an entry with the given name exists at position pos or
// onwards or an error if the attribute is invalid or if the first pos-1 entries
// are not defined.
func (a *Attr) Flag(pos int, key string) (bool, error) {
	if err := a.hasPos(pos - 1); err != nil {
		return false, err
	}
	for _, kv := range a.Fields[pos:] {
		if kv.Key() == "" && kv.Value() == key {
			return true, nil
		}
	}
	return false, nil
}

// Lookup searches for an entry of the form key=value from position pos onwards
// and reports the value if found. It reports an error if the attribute is
// invalid or if the first pos-1 entries are not defined.
func (a *Attr) Lookup(pos int, key string) (val string, found bool, err error) {
	if err := a.hasPos(pos - 1); err != nil {
		return "", false, err
	}
	for _, kv := range a.Fields[pos:] {
		if kv.Key() == key {
			return kv.Value(), true, nil
		}
	}
	return "", false, nil
}

func ParseAttrBody(pos token.Pos, s string) (a Attr) {
	// Create temporary token.File so that scanner has something
	// to work with.
	// TODO it's probably possible to do this without allocations.
	tmpFile := token.NewFile("", -1, len(s))
	if len(s) > 0 {
		tmpFile.AddLine(len(s) - 1)
	}
	a.Body = s
	a.Pos = pos
	var scan scanner.Scanner
	scan.Init(tmpFile, []byte(s), nil, scanner.DontInsertCommas)
	for {
		start := scan.Offset()
		tok, err := scanAttributeTokens(&scan, pos, 1<<token.COMMA|1<<token.BIND|1<<token.EOF)
		if err != nil {
			// Shouldn't happen because bracket nesting should have been checked previously by
			// the regular CUE parser.
			a.Err = err
			return a
		}
		switch tok {
		case token.EOF:
			// Empty field.
			a.appendField("", s[start:], s[start:])
			return a
		case token.COMMA:
			val := s[start : scan.Offset()-1]
			a.appendField("", val, val) // All but final comma.
			continue
		}
		valStart := scan.Offset()
		key := s[start : valStart-1] // All but =.
		tok, err = scanAttributeTokens(&scan, pos, 1<<token.COMMA|1<<token.EOF)
		if err != nil {
			// Shouldn't happen because bracket nesting should have been checked previously by
			// the regular CUE parser.
			a.Err = err
			return a
		}
		valEnd := len(s)
		if tok != token.EOF {
			valEnd = scan.Offset() - 1 // All but final comma
		}
		value := s[valStart:valEnd]
		text := s[start:valEnd]
		a.appendField(key, value, text)
		if tok == token.EOF {
			return a
		}
	}
}

func (a *Attr) appendField(k, v, text string) {
	a.Fields = append(a.Fields, KeyValue{
		key:   strings.TrimSpace(k),
		value: maybeUnquote(strings.TrimSpace(v)),
		text:  text,
	})
}

func maybeUnquote(s string) string {
	if !possiblyQuoted(s) {
		return s
	}
	s1, err := literal.Unquote(s)
	if err != nil {
		return s
	}
	return s1
}

func possiblyQuoted(s string) bool {
	if len(s) < 2 {
		return false
	}
	if s[0] == '#' && s[len(s)-1] == '#' {
		return true
	}
	if s[0] == '"' && s[len(s)-1] == '"' {
		return true
	}
	if s[0] == '\'' && s[len(s)-1] == '\'' {
		return true
	}
	return false
}

// scanAttributeTokens reads tokens from s until it encounters
// a close token from the given bitmask. It returns the actual close token read.
func scanAttributeTokens(s *scanner.Scanner, startPos token.Pos, close uint64) (token.Token, errors.Error) {
	for {
		pos, tok, _ := s.Scan()
		if s.ErrorCount > 0 {
			// Shouldn't happen because the text should have been scanned previously by
			// the regular CUE parser.
			return 0, errors.Newf(startPos.Add(pos.Offset()), "error scanning attribute text")
		}
		if tok < 64 && (close&(1<<tok)) != 0 {
			return tok, nil
		}
		var err error
		switch tok {
		case token.EOF:
			err = fmt.Errorf("attribute missing '%s'", tokenMaskStr(close))
		case token.LPAREN:
			_, err = scanAttributeTokens(s, startPos, 1<<token.RPAREN)
		case token.LBRACE:
			_, err = scanAttributeTokens(s, startPos, 1<<token.RBRACE)
		case token.LBRACK:
			_, err = scanAttributeTokens(s, startPos, 1<<token.RBRACK)
		case token.RPAREN, token.RBRACK, token.RBRACE:
			err = fmt.Errorf("unexpected '%s'", tok)
		}
		if err != nil {
			return 0, errors.Newf(startPos.Add(pos.Offset()), "%v", err)
		}
	}
}

func tokenMaskStr(m uint64) string {
	var buf strings.Builder
	for t := token.Token(0); t < 64; t++ {
		if (m & (1 << t)) != 0 {
			if buf.Len() > 0 {
				buf.WriteByte('|')
			}
			buf.WriteString(t.String())
		}
	}
	return buf.String()
}
