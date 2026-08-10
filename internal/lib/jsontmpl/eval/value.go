// Package eval implements the jsontmpl tree-walking evaluator. Mirrors
// the semantics in src/Kriti/Eval.hs (Eval.hs:97-218) one-for-one.
package eval

import (
	"bytes"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"sort"
)

// Value is the runtime JSON value type. Concrete types:
//
//	nil         -> JSON null
//	bool        -> JSON true / false
//	float64     -> JSON number (precision matches Go's standard library;
//	               sufficient for upstream fixtures, which never exceed
//	               IEEE 754 double precision)
//	string      -> JSON string
//	[]Value     -> JSON array
//	Object      -> JSON object (insertion-order preserving)
//
// We use float64 instead of json.Number for arithmetic ease; the
// conformance test canonicalises both sides via json.Marshal + Unmarshal
// before comparing, so number-format drift is absorbed.
type Value any

// Object preserves insertion order, mirroring upstream's Compat.Object
// (an ordered KeyMap). MarshalJSON emits keys in Keys order; duplicate
// keys retain their first position but the latest value (last-wins).
// Object is an insertion-ordered JSON object. Set takes a pointer
// receiver because it mutates, while Get/MarshalJSON take value
// receivers so an Object held in a Value (which is copied freely)
// marshals correctly; this mixed-receiver shape is deliberate.
//
//nolint:recvcheck // value receivers are required for the Value interface; Set must mutate.
type Object struct {
	Keys []string
	Data map[string]Value
}

// NewObject builds an empty ordered object.
func NewObject() Object {
	return Object{Keys: nil, Data: map[string]Value{}}
}

// Set assigns v to k, appending k to Keys on first insertion. Duplicate
// keys overwrite the value in place; the original position is kept.
func (o *Object) Set(k string, v Value) {
	if _, ok := o.Data[k]; !ok {
		o.Keys = append(o.Keys, k)
	}

	if o.Data == nil {
		o.Data = map[string]Value{}
	}

	o.Data[k] = v
}

// Get returns (value, present).
func (o Object) Get(k string) (Value, bool) {
	v, ok := o.Data[k]
	return v, ok
}

// MarshalJSON emits the object as `{"k1":v1,"k2":v2,...}` in Keys
// order. Without this, Go's default map marshaller sorts keys
// alphabetically, breaking byte-stability against upstream output.
func (o Object) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')

	for i, k := range o.Keys {
		if i > 0 {
			buf.WriteByte(',')
		}

		kb, err := json.Marshal(k)
		if err != nil {
			return nil, fmt.Errorf("marshal object key: %w", err)
		}

		buf.Write(kb)
		buf.WriteByte(':')

		vb, err := json.Marshal(o.Data[k])
		if err != nil {
			return nil, fmt.Errorf("marshal object value: %w", err)
		}

		buf.Write(vb)
	}

	buf.WriteByte('}')

	return buf.Bytes(), nil
}

// FromJSON decodes a JSON document into a Value tree, preserving
// object key insertion order. Numbers decode to float64 (default Go
// behaviour). Returns the canonical zero Value (nil) for empty input.
func FromJSON(raw []byte) (Value, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}

	dec := jsontext.NewDecoder(bytes.NewReader(raw))

	v, err := decodeOne(dec)
	if err != nil {
		return nil, err
	}

	if _, err := dec.ReadToken(); !errors.Is(err, io.EOF) {
		if err != nil {
			return nil, fmt.Errorf("read trailing token: %w", err)
		}

		return nil, errors.New("trailing tokens after JSON value")
	}

	return v, nil
}

// decodeOne reads exactly one JSON value from the token stream,
// preserving object key order (numbers are normalised to float64, as
// the rest of the evaluator expects). It mirrors the previous
// encoding/json streaming decoder, ported to jsontext.
//
//nolint:cyclop // flat dispatch over JSON token kinds; one arm per kind.
func decodeOne(dec *jsontext.Decoder) (Value, error) {
	tok, err := dec.ReadToken()
	if err != nil {
		return nil, fmt.Errorf("read token: %w", err)
	}

	//nolint:exhaustive // jsontext.Kind is matched by its rune value; the
	// default arm rejects every other (incl. invalid) kind.
	switch tok.Kind() {
	case 'n':
		return nil, nil
	case 't', 'f':
		return tok.Bool(), nil
	case '"':
		return tok.String(), nil
	case '0':
		return tok.Float(), nil
	case '[':
		out := []Value{}
		for dec.PeekKind() != ']' {
			e, err := decodeOne(dec)
			if err != nil {
				return nil, err
			}

			out = append(out, e)
		}

		if _, err := dec.ReadToken(); err != nil { // consume ']'
			return nil, fmt.Errorf("read array close: %w", err)
		}

		return out, nil
	case '{':
		obj := NewObject()
		for dec.PeekKind() != '}' {
			kt, err := dec.ReadToken()
			if err != nil {
				return nil, fmt.Errorf("read object key: %w", err)
			}

			if kt.Kind() != '"' {
				return nil, fmt.Errorf("non-string object key (kind %v)", kt.Kind())
			}
			// Capture the key before decodeOne advances the decoder:
			// jsontext voids a Token on the next decoder call.
			key := kt.String()

			v, err := decodeOne(dec)
			if err != nil {
				return nil, err
			}

			obj.Set(key, v)
		}

		if _, err := dec.ReadToken(); err != nil { // consume '}'
			return nil, fmt.Errorf("read object close: %w", err)
		}

		return obj, nil
	}

	return nil, fmt.Errorf("unexpected token (kind %v)", tok.Kind())
}

// TypeName returns the Aeson-style type name used in upstream
// TypeError messages (Eval.hs:80-87). The exact spelling is required
// because dashboard error UI matches on it.
func TypeName(v Value) string {
	switch v.(type) {
	case nil:
		return "Null"
	case bool:
		return "Boolean"
	case float64:
		return "Number"
	case string:
		return "String"
	case []Value:
		return "Array"
	case Object:
		return "Object"
	}

	return fmt.Sprintf("%T", v)
}

// --- Equality ---------------------------------------------------------------

// Equal mirrors Aeson's structural Value Eq. Numeric equality is by
// IEEE value; arrays compare elementwise; objects compare by key-value
// set (order-independent).
func Equal(a, b Value) bool {
	ra, rb := constructorRank(a), constructorRank(b)
	if ra != rb {
		return false
	}

	// ra == rb guarantees a and b share a dynamic type, so the comma-ok
	// asserts below cannot fail; the ignored ok keeps the linter happy.
	switch x := a.(type) {
	case nil:
		return true
	case bool:
		y, _ := b.(bool)
		return x == y
	case float64:
		y, _ := b.(float64)
		return x == y
	case string:
		y, _ := b.(string)
		return x == y
	case []Value:
		y, _ := b.([]Value)
		if len(x) != len(y) {
			return false
		}

		for i := range x {
			if !Equal(x[i], y[i]) {
				return false
			}
		}

		return true
	case Object:
		y, _ := b.(Object)
		if len(x.Keys) != len(y.Keys) {
			return false
		}

		for k, va := range x.Data {
			vb, ok := y.Data[k]
			if !ok || !Equal(va, vb) {
				return false
			}
		}

		return true
	}

	return false
}

// --- Ordering ---------------------------------------------------------------

// Compare returns -1, 0, or 1 mirroring Aeson's Ord instance for
// Value. Cross-type comparisons use a constructor rank
// (Null < Bool < Number < String < Array < Object); within a
// constructor, values are compared natively. Surprising but
// fixture-required (plan §4.2).
//
//nolint:cyclop,funlen // flat Aeson Ord dispatch over the 6 JSON constructors.
func Compare(a, b Value) int {
	ra, rb := constructorRank(a), constructorRank(b)
	// ra == rb below guarantees a and b share a dynamic type, so each
	// comma-ok assert in the type switch cannot fail.
	if ra != rb {
		switch {
		case ra < rb:
			return -1
		default:
			return 1
		}
	}

	switch x := a.(type) {
	case nil:
		return 0
	case bool:
		y, _ := b.(bool)
		switch {
		case x == y:
			return 0
		case !x && y: // false < true
			return -1
		default:
			return 1
		}
	case float64:
		y, _ := b.(float64)
		switch {
		case x < y:
			return -1
		case x > y:
			return 1
		}

		return 0
	case string:
		y, _ := b.(string)
		switch {
		case x < y:
			return -1
		case x > y:
			return 1
		}

		return 0
	case []Value:
		y, _ := b.([]Value)

		n := min(len(y), len(x))

		for i := range n {
			if c := Compare(x[i], y[i]); c != 0 {
				return c
			}
		}

		switch {
		case len(x) < len(y):
			return -1
		case len(x) > len(y):
			return 1
		}

		return 0
	case Object:
		// Aeson Object Ord: compare as sorted key-value lists.
		y, _ := b.(Object)

		xk := append([]string(nil), x.Keys...)
		yk := append([]string(nil), y.Keys...)

		sort.Strings(xk)
		sort.Strings(yk)

		n := min(len(yk), len(xk))

		for i := range n {
			if c := stringCmp(xk[i], yk[i]); c != 0 {
				return c
			}

			if c := Compare(x.Data[xk[i]], y.Data[yk[i]]); c != 0 {
				return c
			}
		}

		switch {
		case len(xk) < len(yk):
			return -1
		case len(xk) > len(yk):
			return 1
		}

		return 0
	}

	return 0
}

func stringCmp(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}

	return 0
}

// Constructor ranks for cross-type ordering, mirroring Aeson's derived
// Ord on Value: Null < Bool < Number < String < Array < Object.
const (
	rankNull = iota
	rankBool
	rankNumber
	rankString
	rankArray
	rankObject
)

// rankUnknown sorts before everything; it is only reached for values
// outside the six JSON constructors, which the evaluator never builds.
const rankUnknown = -1

func constructorRank(v Value) int {
	switch v.(type) {
	case nil:
		return rankNull
	case bool:
		return rankBool
	case float64:
		return rankNumber
	case string:
		return rankString
	case []Value:
		return rankArray
	case Object:
		return rankObject
	}

	return rankUnknown
}

// EncodeForStringTem encodes v the way upstream's StringTem rule does
// (Eval.hs:108): J.encode produces compact JSON. For string values
// the surrounding quotes are stripped (the StringTem concatenator
// uses the raw text). For non-string values, the full encoded form
// is used (including quotes for nested strings, brackets for arrays,
// etc.).
func EncodeForStringTem(v Value) (string, error) {
	if s, ok := v.(string); ok {
		return s, nil
	}

	b, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("encode value: %w", err)
	}

	return string(b), nil
}

// AsInt reports whether n is exactly an integer (no fractional part)
// and returns its int value. Used for array indexing per Eval.hs:122
// (Scientific.toBoundedInteger).
func AsInt(n float64) (int, bool) {
	i := int(n)
	if float64(i) == n {
		return i, true
	}

	return 0, false
}
