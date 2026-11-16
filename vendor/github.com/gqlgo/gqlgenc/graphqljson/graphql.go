/*
MIT License

Copyright (c) 2017 Dmitri Shuralyov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Package graphqljson provides a function for decoding JSON
// into a GraphQL query data structure.
package graphqljson

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"

	"github.com/99designs/gqlgen/graphql"
)

// Reference: https://blog.gopheracademy.com/advent-2017/custom-json-unmarshaler-for-graphql-client/

// UnmarshalData parses the JSON-encoded GraphQL response data and stores
// the result in the GraphQL query data structure pointed to by v.
//
// The implementation is created on top of the JSON tokenizer available
// in "encoding/json".Decoder.
func UnmarshalData(data json.RawMessage, v any) error {
	d := newDecoder(bytes.NewBuffer(data))

	err := d.Decode(v)
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	tok, err := d.jsonDecoder.Token()
	switch err {
	case io.EOF:
		// Expect to get io.EOF. There shouldn't be any more
		// tokens left after we've decoded v successfully.
		return nil
	case nil:
		return fmt.Errorf("invalid token '%v' after top-level value", tok)
	}

	return fmt.Errorf("invalid token '%v' after top-level value", tok)
}

// Decoder is a JSON Decoder that performs custom unmarshaling behavior
// for GraphQL query data structures. It's implemented on top of a JSON tokenizer.
type Decoder struct {
	jsonDecoder *json.Decoder

	// Stack of what part of input JSON we're in the middle of - objects, arrays.
	parseState []json.Delim

	// Stacks of values where to unmarshal.
	// The top of each stack is the reflect.Value where to unmarshal next JSON value.
	//
	// The reason there's more than one stack is because we might be unmarshaling
	// a single JSON value into multiple GraphQL fragments or embedded structs, so
	// we keep track of them all.
	vs [][]reflect.Value

	// vsFragTypes is parallel to vs: for stacks created from "... on TypeName"
	// inline fragments, this holds "TypeName"; otherwise "".
	vsFragTypes []string

	// typenameByDepth maps object nesting depth (count of open '{' in parseState)
	// to the __typename value seen at that depth. Used to discriminate which
	// inline fragment pointer to initialize when multiple variants share a field name.
	typenameByDepth map[int]string
}

func newDecoder(r io.Reader) *Decoder {
	jsonDecoder := json.NewDecoder(r)
	jsonDecoder.UseNumber()

	return &Decoder{
		jsonDecoder:     jsonDecoder,
		typenameByDepth: make(map[int]string),
	}
}

// Decode decodes a single JSON value from d.tokenizer into v.
func (d *Decoder) Decode(v any) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Pointer {
		return fmt.Errorf("cannot decode into non-pointer %T", v)
	}

	d.vs = [][]reflect.Value{{rv.Elem()}}
	d.vsFragTypes = []string{""}

	err := d.decode()
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	return nil
}

// decode decodes a single JSON value from d.tokenizer into d.vs.
func (d *Decoder) decode() error { //nolint:maintidx
	// The loop invariant is that the top of each d.vs stack
	// is where we try to unmarshal the next JSON value we see.
	for len(d.vs) > 0 {
		tok, err := d.jsonDecoder.Token()
		if err == io.EOF {
			return errors.New("unexpected end of JSON input")
		} else if err != nil {
			return fmt.Errorf(": %w", err)
		}

		switch {
		// Are we inside an object and seeing next key (rather than end of object)?
		case d.state() == '{' && tok != json.Delim('}'):
			key, ok := tok.(string)
			if !ok {
				return errors.New("unexpected non-key in JSON input")
			}

			// The last matching one is the one considered
			var matchingFieldValue *reflect.Value

			// If this key is __typename, eagerly read its value so we can use it
			// to discriminate which inline fragment pointers to initialize below.
			// This must happen before the nil-pointer init loop.
			var earlyReadTok json.Token
			if key == "__typename" {
				earlyReadTok, err = d.jsonDecoder.Token()
				if err == io.EOF {
					return errors.New("unexpected end of JSON input")
				} else if err != nil {
					return fmt.Errorf(": %w", err)
				}

				if s, ok := earlyReadTok.(string); ok {
					d.typenameByDepth[d.objectDepth()] = s
				}
			}

			for i := range d.vs {
				v := d.vs[i][len(d.vs[i])-1]
				// If v is a nil pointer, check whether the key exists in the pointed-to
				// type before initializing — preserves nil for non-matching union variants.
				// When a __typename was seen, also require the fragment type to match.
				if v.Kind() == reflect.Pointer && v.IsNil() && v.CanSet() {
					if elemType := v.Type().Elem(); elemType.Kind() == reflect.Struct {
						if fieldByGraphQLName(reflect.New(elemType).Elem(), key).IsValid() && d.shouldInitFragPtr(i) {
							v.Set(reflect.New(elemType))
						}
					}
				}

				if v.Kind() == reflect.Pointer {
					v = v.Elem()
				}

				var f reflect.Value
				if v.Kind() == reflect.Struct {
					f = fieldByGraphQLName(v, key)
					if f.IsValid() {
						matchingFieldValue = &f
					}
				}

				d.vs[i] = append(d.vs[i], f)
			}

			if matchingFieldValue == nil {
				return fmt.Errorf("struct field for %q doesn't exist in any of %v places to unmarshal", key, len(d.vs))
			}

			// We've just consumed the current token, which was the key.
			// Read the next token, which should be the value.
			// If it's of json.RawMessage or map type, decode the value.
			// Skip reading if we already eagerly read the value above (for __typename).
			if earlyReadTok != nil {
				tok = earlyReadTok
			} else {
				switch matchingFieldValue.Type() {
				case reflect.TypeFor[json.RawMessage]():
					var data json.RawMessage

					err = d.jsonDecoder.Decode(&data)
					tok = data
				case reflect.TypeFor[map[string]any]():
					var data map[string]any

					err = d.jsonDecoder.Decode(&data)
					tok = data
				default:
					tok, err = d.jsonDecoder.Token()
				}
			}

			if err == io.EOF {
				return errors.New("unexpected end of JSON input")
			} else if err != nil {
				return fmt.Errorf(": %w", err)
			}

		// Are we inside an array and seeing next value (rather than end of array)?
		case d.state() == '[' && tok != json.Delim(']'):
			someSliceExist := false

			for i := range d.vs {
				v := d.vs[i][len(d.vs[i])-1]
				if v.Kind() == reflect.Pointer {
					v = v.Elem()
				}

				var f reflect.Value

				if v.Kind() == reflect.Slice {
					v.Set(reflect.Append(v, reflect.Zero(v.Type().Elem()))) // v = append(v, T).
					f = v.Index(v.Len() - 1)
					someSliceExist = true
				}

				d.vs[i] = append(d.vs[i], f)
			}

			if !someSliceExist {
				return fmt.Errorf("slice doesn't exist in any of %v places to unmarshal", len(d.vs))
			}
		}

		switch tok := tok.(type) {
		case nil: // Handle null values correctly.
			for i := range d.vs {
				v := d.vs[i][len(d.vs[i])-1]
				if !v.CanSet() {
					// If v is not settable, skip the operation to prevent panicking.
					continue
				}

				if v.Kind() == reflect.Pointer || v.Kind() == reflect.Slice {
					// Set the pointer or slice to nil.
					v.Set(reflect.Zero(v.Type()))
				} else {
					// For other types that cannot directly handle nil, continue to use default zero values.
					v.Set(reflect.Zero(v.Type()))
				}
			}

			d.popAllVs()

			continue
		case string, json.Number, bool, json.RawMessage, map[string]any:
			for i := range d.vs {
				v := d.vs[i][len(d.vs[i])-1]
				if !v.IsValid() {
					continue
				}

				// Initialize the pointer if it is nil
				if v.Kind() == reflect.Pointer && v.IsNil() {
					v.Set(reflect.New(v.Type().Elem()))
				}

				// Handle both pointer and non-pointer types
				target := v
				if v.Kind() == reflect.Pointer {
					target = v.Elem()
				}

				// Check if the type of target (or its address) implements graphql.Unmarshaler
				var (
					unmarshaler graphql.Unmarshaler
					ok          bool
				)

				if target.CanAddr() {
					unmarshaler, ok = target.Addr().Interface().(graphql.Unmarshaler)
				} else if target.CanInterface() {
					unmarshaler, ok = target.Interface().(graphql.Unmarshaler)
				}

				if ok {
					err := unmarshaler.UnmarshalGQL(tok)
					if err != nil {
						return fmt.Errorf("unmarshal gql error: %w", err)
					}
				} else {
					// Use the standard unmarshal method for non-custom types
					err := unmarshalValue(tok, target)
					if err != nil {
						return fmt.Errorf(": %w", err)
					}
				}
			}

			d.popAllVs()

		case json.Delim:
			switch tok {
			case '{':
				// Start of object.
				d.pushState(tok)

				frontier := make([]reflect.Value, len(d.vs)) // Places to look for GraphQL fragments/embedded structs.
				for i := range d.vs {
					v := d.vs[i][len(d.vs[i])-1]
					frontier[i] = v
					// TODO: Do this recursively or not? Add a test case if needed.
					if v.Kind() == reflect.Pointer && v.IsNil() {
						v.Set(reflect.New(v.Type().Elem())) // v = new(T).
					}
				}
				// Find GraphQL fragments/embedded structs recursively, adding to frontier
				// as new ones are discovered and exploring them further.
				for len(frontier) > 0 {
					v := frontier[0]
					frontier = frontier[1:]

					if v.Kind() == reflect.Pointer {
						v = v.Elem()
					}

					if v.Kind() != reflect.Struct {
						continue
					}

					for i := range v.NumField() {
						field := v.Type().Field(i)
						if isGraphQLFragment(field) || field.Anonymous {
							// Add GraphQL fragment or embedded struct.
							d.vs = append(d.vs, []reflect.Value{v.Field(i)})
							d.vsFragTypes = append(d.vsFragTypes, inlineFragmentType(field))
							frontier = append(frontier, v.Field(i))
						}
					}
				}
			case '[':
				// Start of array.
				d.pushState(tok)

				for i := range d.vs {
					v := d.vs[i][len(d.vs[i])-1]
					// TODO: Confirm this is needed, write a test case.
					// if v.Kind() == reflect.Pointer && v.IsNil() {
					//	v.Set(reflect.New(v.Type().Elem())) // v = new(T).
					//}

					// Reset slice to empty (in case it had non-zero initial value).
					if v.Kind() == reflect.Pointer {
						v = v.Elem()
					}

					if v.Kind() != reflect.Slice {
						continue
					}

					v.Set(reflect.MakeSlice(v.Type(), 0, 0)) // v = make(T, 0, 0).
				}
			case '}', ']':
				// End of object or array.
				if tok == '}' {
					delete(d.typenameByDepth, d.objectDepth())
				}

				d.popAllVs()
				d.popState()
			default:
				return errors.New("unexpected delimiter in JSON input")
			}
		default:
			return errors.New("unexpected token in JSON input")
		}
	}

	return nil
}

// pushState pushes a new parse state s onto the stack.
func (d *Decoder) pushState(s json.Delim) {
	d.parseState = append(d.parseState, s)
}

// popState pops a parse state (already obtained) off the stack.
// The stack must be non-empty.
func (d *Decoder) popState() {
	d.parseState = d.parseState[:len(d.parseState)-1]
}

// state reports the parse state on top of stack, or 0 if empty.
func (d *Decoder) state() json.Delim {
	if len(d.parseState) == 0 {
		return 0
	}

	return d.parseState[len(d.parseState)-1]
}

// popAllVs pops from all d.vs stacks, keeping only non-empty ones.
func (d *Decoder) popAllVs() {
	var (
		nonEmpty          [][]reflect.Value
		nonEmptyFragTypes []string
	)

	for i := range d.vs {
		d.vs[i] = d.vs[i][:len(d.vs[i])-1]
		if len(d.vs[i]) > 0 {
			nonEmpty = append(nonEmpty, d.vs[i])
			nonEmptyFragTypes = append(nonEmptyFragTypes, d.vsFragTypes[i])
		}
	}

	d.vs = nonEmpty
	d.vsFragTypes = nonEmptyFragTypes
}

// fieldByGraphQLName returns an exported struct field of struct v
// that matches GraphQL name, or invalid reflect.Value if none found.
func fieldByGraphQLName(v reflect.Value, name string) reflect.Value {
	for i := range v.NumField() {
		if v.Type().Field(i).PkgPath != "" {
			// Skip unexported field.
			continue
		}

		if hasGraphQLName(v.Type().Field(i), name) {
			return v.Field(i)
		}
	}

	return reflect.Value{}
}

// hasGraphQLName reports whether struct field f has GraphQL name.
func hasGraphQLName(f reflect.StructField, name string) bool {
	value, ok := f.Tag.Lookup("graphql")
	if !ok {
		// TODO: caseconv package is relatively slow. Optimize it, then consider using it here.
		// return caseconv.MixedCapsToLowerCamelCase(f.Name) == name
		return strings.EqualFold(f.Name, name)
	}

	value = strings.TrimSpace(value) // TODO: Parse better.
	if strings.HasPrefix(value, "...") {
		// GraphQL fragment. It doesn't have a name.
		return false
	}

	if i := strings.Index(value, "("); i != -1 {
		value = value[:i]
	}

	if i := strings.Index(value, ":"); i != -1 {
		value = value[:i]
	}

	return strings.TrimSpace(value) == name
}

// isGraphQLFragment reports whether struct field f is a GraphQL fragment.
func isGraphQLFragment(f reflect.StructField) bool {
	value, ok := f.Tag.Lookup("graphql")
	if !ok {
		return false
	}

	value = strings.TrimSpace(value) // TODO: Parse better.

	return strings.HasPrefix(value, "...")
}

// unmarshalValue unmarshals JSON value into v.
// v must be addressable and not obtained by the use of unexported
// struct fields, otherwise unmarshalValue will panic.
func unmarshalValue(value json.Token, v reflect.Value) error {
	b, err := json.Marshal(value) // TODO: Short-circuit (if profiling says it's worth it).
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	err = json.Unmarshal(b, v.Addr().Interface())
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	return nil
}

// objectDepth returns the number of currently open JSON objects ('{') in parseState.
func (d *Decoder) objectDepth() int {
	count := 0

	for _, s := range d.parseState {
		if s == '{' {
			count++
		}
	}

	return count
}

// shouldInitFragPtr reports whether the nil pointer at stack index i should be
// initialized. When a __typename has been observed for the current object depth,
// only the inline fragment stack whose type matches that typename is initialized;
// all others are skipped. Non-fragment stacks are always initialized.
func (d *Decoder) shouldInitFragPtr(i int) bool {
	fragType := d.vsFragTypes[i]
	if fragType == "" {
		return true // not a typed inline fragment
	}

	typename, ok := d.typenameByDepth[d.objectDepth()]
	if !ok {
		return true // no __typename seen yet, fall back to field-presence check
	}

	return fragType == typename
}

// inlineFragmentType returns the concrete type name from a "... on TypeName" graphql
// tag, or "" if the field is not a typed inline fragment.
func inlineFragmentType(f reflect.StructField) string {
	value, ok := f.Tag.Lookup("graphql")
	if !ok {
		return ""
	}

	value = strings.TrimSpace(value)

	const prefix = "... on "
	if !strings.HasPrefix(value, prefix) {
		return ""
	}

	return strings.TrimSpace(strings.TrimPrefix(value, prefix))
}
