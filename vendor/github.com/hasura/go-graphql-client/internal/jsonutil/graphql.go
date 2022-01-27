// Package jsonutil provides a function for decoding JSON
// into a GraphQL query data structure.
package jsonutil

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
)

// UnmarshalGraphQL parses the JSON-encoded GraphQL response data and stores
// the result in the GraphQL query data structure pointed to by v.
//
// The implementation is created on top of the JSON tokenizer available
// in "encoding/json".Decoder.
func UnmarshalGraphQL(data []byte, v interface{}) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	err := (&decoder{tokenizer: dec}).Decode(v)
	if err != nil {
		return err
	}
	tok, err := dec.Token()
	switch err {
	case io.EOF:
		// Expect to get io.EOF. There shouldn't be any more
		// tokens left after we've decoded v successfully.
		return nil
	case nil:
		return fmt.Errorf("invalid token '%v' after top-level value", tok)
	default:
		return err
	}
}

// decoder is a JSON decoder that performs custom unmarshaling behavior
// for GraphQL query data structures. It's implemented on top of a JSON tokenizer.
type decoder struct {
	tokenizer interface {
		Token() (json.Token, error)
		Decode(v interface{}) error
	}

	// Stack of what part of input JSON we're in the middle of - objects, arrays.
	parseState []json.Delim

	// Stacks of values where to unmarshal.
	// The top of each stack is the reflect.Value where to unmarshal next JSON value.
	//
	// The reason there's more than one stack is because we might be unmarshaling
	// a single JSON value into multiple GraphQL fragments or embedded structs, so
	// we keep track of them all.
	vs []stack
}

type stack []reflect.Value

func (s stack) Top() reflect.Value {
	return s[len(s)-1]
}

func (s stack) Pop() stack {
	return s[:len(s)-1]
}

// Decode decodes a single JSON value from d.tokenizer into v.
func (d *decoder) Decode(v interface{}) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr {
		return fmt.Errorf("cannot decode into non-pointer %T", v)
	}
	d.vs = []stack{{rv.Elem()}}
	return d.decode()
}

// decode decodes a single JSON value from d.tokenizer into d.vs.
func (d *decoder) decode() error {
	rawMessageValue := reflect.ValueOf(json.RawMessage{})

	// The loop invariant is that the top of each d.vs stack
	// is where we try to unmarshal the next JSON value we see.
	for len(d.vs) > 0 {
		var tok interface{}
		tok, err := d.tokenizer.Token()

		if err == io.EOF {
			return errors.New("unexpected end of JSON input")
		} else if err != nil {
			return err
		}

		switch {

		// Are we inside an object and seeing next key (rather than end of object)?
		case d.state() == '{' && tok != json.Delim('}'):
			key, ok := tok.(string)
			if !ok {
				return errors.New("unexpected non-key in JSON input")
			}
			someFieldExist := false
			// If one field is raw all must be treated as raw
			rawMessage := false
			isScalar := false
			for i := range d.vs {
				v := d.vs[i].Top()
				for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
					v = v.Elem()
				}
				var f reflect.Value
				switch v.Kind() {
				case reflect.Struct:
					f, isScalar = fieldByGraphQLName(v, key)
					if f.IsValid() {
						someFieldExist = true
						// Check for special embedded json
						if f.Type() == rawMessageValue.Type() {
							rawMessage = true
						}
					}
				case reflect.Slice:
					f = orderedMapValueByGraphQLName(v, key)
					if f.IsValid() {
						someFieldExist = true
					}
				}
				d.vs[i] = append(d.vs[i], f)
			}
			if !someFieldExist {
				return fmt.Errorf("struct field for %q doesn't exist in any of %v places to unmarshal", key, len(d.vs))
			}

			if rawMessage || isScalar {
				// Read the next complete object from the json stream
				var data json.RawMessage
				err = d.tokenizer.Decode(&data)
				if err != nil {
					return err
				}
				tok = data
			} else {
				// We've just consumed the current token, which was the key.
				// Read the next token, which should be the value, and let the rest of code process it.
				tok, err = d.tokenizer.Token()
				if err == io.EOF {
					return errors.New("unexpected end of JSON input")
				} else if err != nil {
					return err
				}
			}

		// Are we inside an array and seeing next value (rather than end of array)?
		case d.state() == '[' && tok != json.Delim(']'):
			someSliceExist := false
			for i := range d.vs {
				v := d.vs[i].Top()
				for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
					v = v.Elem()
				}
				var f reflect.Value
				if v.Kind() == reflect.Slice {
					// we want to append the template item copy
					// so that all the inner structure gets preserved
					copied, err := copyTemplate(v.Index(0))
					if err != nil {
						return fmt.Errorf("failed to copy template: %w", err)
					}
					v.Set(reflect.Append(v, copied)) // v = append(v, T).
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
		case string, json.Number, bool, nil, json.RawMessage:
			// Value.

			for i := range d.vs {
				v := d.vs[i].Top()
				if !v.IsValid() {
					continue
				}
				err := unmarshalValue(tok, v)
				if err != nil {
					return err
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
					v := d.vs[i].Top()
					frontier[i] = v
					// TODO: Do this recursively or not? Add a test case if needed.
					if v.Kind() == reflect.Ptr && v.IsNil() {
						v.Set(reflect.New(v.Type().Elem())) // v = new(T).
					}
				}
				// Find GraphQL fragments/embedded structs recursively, adding to frontier
				// as new ones are discovered and exploring them further.
				for len(frontier) > 0 {
					v := frontier[0]
					frontier = frontier[1:]
					for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
						v = v.Elem()
					}
					if v.Kind() == reflect.Struct {
						for i := 0; i < v.NumField(); i++ {
							if isGraphQLFragment(v.Type().Field(i)) || v.Type().Field(i).Anonymous {
								// Add GraphQL fragment or embedded struct.
								d.vs = append(d.vs, []reflect.Value{v.Field(i)})
								frontier = append(frontier, v.Field(i))
							}
						}
					} else if isOrderedMap(v) {
						for i := 0; i < v.Len(); i++ {
							pair := v.Index(i)
							key, val := pair.Index(0), pair.Index(1)
							if keyForGraphQLFragment(key.Interface().(string)) {
								// Add GraphQL fragment or embedded struct.
								d.vs = append(d.vs, []reflect.Value{val})
								frontier = append(frontier, val)
							}
						}
					}
				}
			case '[':
				// Start of array.

				d.pushState(tok)

				for i := range d.vs {
					v := d.vs[i].Top()
					// TODO: Confirm this is needed, write a test case.
					//if v.Kind() == reflect.Ptr && v.IsNil() {
					//	v.Set(reflect.New(v.Type().Elem())) // v = new(T).
					//}

					// Reset slice to empty (in case it had non-zero initial value).
					for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
						v = v.Elem()
					}
					if v.Kind() != reflect.Slice {
						continue
					}
					newSlice := reflect.MakeSlice(v.Type(), 0, 0) // v = make(T, 0, 0).
					switch v.Len() {
					case 0:
						// if there is no template we need to create one so that we can
						// handle both cases (with or without a template) in the same way
						newSlice = reflect.Append(newSlice, reflect.Zero(v.Type().Elem()))
					case 1:
						// if there is a template, we need to keep it at index 0
						newSlice = reflect.Append(newSlice, v.Index(0))
					case 2:
						return fmt.Errorf("template slice can only have 1 item, got %d", v.Len())
					}
					v.Set(newSlice)
				}
			case '}':
				// End of object.
				d.popAllVs()
				d.popState()
			case ']':
				// End of array.
				d.popLeftArrayTemplates()
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

func copyTemplate(template reflect.Value) (reflect.Value, error) {
	if isOrderedMap(template) {
		// copy slice if it's actually an ordered map
		return copyOrderedMap(template), nil
	}
	if template.Kind() == reflect.Map {
		return reflect.Value{}, fmt.Errorf("unsupported template type `%v`, use [][2]interface{} for ordered map instead", template.Type())
	}
	// don't need to copy regular slice
	return template, nil
}

func isOrderedMap(v reflect.Value) bool {
	if !v.IsValid() {
		return false
	}
	t := v.Type()
	return t.Kind() == reflect.Slice &&
		t.Elem().Kind() == reflect.Array &&
		t.Elem().Len() == 2
}

func copyOrderedMap(m reflect.Value) reflect.Value {
	newMap := reflect.MakeSlice(m.Type(), 0, m.Len())
	for i := 0; i < m.Len(); i++ {
		pair := m.Index(i)
		newMap = reflect.Append(newMap, pair)
	}
	return newMap
}

// pushState pushes a new parse state s onto the stack.
func (d *decoder) pushState(s json.Delim) {
	d.parseState = append(d.parseState, s)
}

// popState pops a parse state (already obtained) off the stack.
// The stack must be non-empty.
func (d *decoder) popState() {
	d.parseState = d.parseState[:len(d.parseState)-1]
}

// state reports the parse state on top of stack, or 0 if empty.
func (d *decoder) state() json.Delim {
	if len(d.parseState) == 0 {
		return 0
	}
	return d.parseState[len(d.parseState)-1]
}

// popAllVs pops from all d.vs stacks, keeping only non-empty ones.
func (d *decoder) popAllVs() {
	var nonEmpty []stack
	for i := range d.vs {
		d.vs[i] = d.vs[i].Pop()
		if len(d.vs[i]) > 0 {
			nonEmpty = append(nonEmpty, d.vs[i])
		}
	}
	d.vs = nonEmpty
}

// popLeftArrayTemplates pops left from last array items of all d.vs stacks.
func (d *decoder) popLeftArrayTemplates() {
	for i := range d.vs {
		v := d.vs[i].Top()
		if v.IsValid() {
			v.Set(v.Slice(1, v.Len()))
		}
	}
}

// fieldByGraphQLName returns an exported struct field of struct v
// that matches GraphQL name, or invalid reflect.Value if none found.
func fieldByGraphQLName(v reflect.Value, name string) (val reflect.Value, taggedAsScalar bool) {
	for i := 0; i < v.NumField(); i++ {
		if v.Type().Field(i).PkgPath != "" {
			// Skip unexported field.
			continue
		}
		if hasGraphQLName(v.Type().Field(i), name) {
			return v.Field(i), hasScalarTag(v.Type().Field(i))
		}
	}
	return reflect.Value{}, false
}

// orderedMapValueByGraphQLName takes [][2]string, interprets it as an ordered map
// and returns value for corresponding key, or invalid reflect.Value if none found.
func orderedMapValueByGraphQLName(v reflect.Value, name string) reflect.Value {
	for i := 0; i < v.Len(); i++ {
		pair := v.Index(i)
		key := pair.Index(0).Interface().(string)
		if keyHasGraphQLName(key, name) {
			return pair.Index(1)
		}
	}
	return reflect.Value{}
}

func hasScalarTag(f reflect.StructField) bool {
	return isTrue(f.Tag.Get("scalar"))
}

func isTrue(s string) bool {
	b, _ := strconv.ParseBool(s)
	return b
}

// hasGraphQLName reports whether struct field f has GraphQL name.
func hasGraphQLName(f reflect.StructField, name string) bool {
	value, ok := f.Tag.Lookup("graphql")
	if !ok {
		// TODO: caseconv package is relatively slow. Optimize it, then consider using it here.
		//return caseconv.MixedCapsToLowerCamelCase(f.Name) == name
		return strings.EqualFold(f.Name, name)
	}
	return keyHasGraphQLName(value, name)
}

func keyHasGraphQLName(value, name string) bool {
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
	return keyForGraphQLFragment(value)
}

// isGraphQLFragment reports whether ordered map kv pair f is a GraphQL fragment.
func keyForGraphQLFragment(value string) bool {
	value = strings.TrimSpace(value) // TODO: Parse better.
	return strings.HasPrefix(value, "...")
}

// unmarshalValue unmarshals JSON value into v.
// v must be addressable and not obtained by the use of unexported
// struct fields, otherwise unmarshalValue will panic.
func unmarshalValue(value interface{}, v reflect.Value) error {
	b, err := json.Marshal(value) // TODO: Short-circuit (if profiling says it's worth it).
	if err != nil {
		return err
	}
	ty := v.Type()
	if ty.Kind() == reflect.Interface {
		if !v.Elem().IsValid() {
			return json.Unmarshal(b, v.Addr().Interface())
		}
		ty = v.Elem().Type()
	}
	newVal := reflect.New(ty)
	err = json.Unmarshal(b, newVal.Interface())
	if err != nil {
		return err
	}
	v.Set(newVal.Elem())
	return nil
}
