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
	"strconv"
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
type Object struct {
	Keys []string
	Data map[string]Value
}

// NewObject builds an empty ordered object.
func NewObject() Object {
	return Object{Data: map[string]Value{}}
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
			return nil, err
		}
		buf.Write(kb)
		buf.WriteByte(':')
		vb, err := json.Marshal(o.Data[k])
		if err != nil {
			return nil, err
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
			return nil, err
		}
		return nil, fmt.Errorf("trailing tokens after JSON value")
	}
	return v, nil
}

// decodeOne reads exactly one JSON value from the token stream,
// preserving object key order (numbers are normalised to float64, as
// the rest of the evaluator expects). It mirrors the previous
// encoding/json streaming decoder, ported to jsontext.
func decodeOne(dec *jsontext.Decoder) (Value, error) {
	tok, err := dec.ReadToken()
	if err != nil {
		return nil, err
	}
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
			return nil, err
		}
		return out, nil
	case '{':
		obj := NewObject()
		for dec.PeekKind() != '}' {
			kt, err := dec.ReadToken()
			if err != nil {
				return nil, err
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
			return nil, err
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
	switch x := a.(type) {
	case nil:
		return true
	case bool:
		return x == b.(bool)
	case float64:
		return x == b.(float64)
	case string:
		return x == b.(string)
	case []Value:
		y := b.([]Value)
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
		y := b.(Object)
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
func Compare(a, b Value) int {
	ra, rb := constructorRank(a), constructorRank(b)
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
		y := b.(bool)
		switch {
		case x == y:
			return 0
		case !x && y: // false < true
			return -1
		default:
			return 1
		}
	case float64:
		y := b.(float64)
		switch {
		case x < y:
			return -1
		case x > y:
			return 1
		}
		return 0
	case string:
		y := b.(string)
		switch {
		case x < y:
			return -1
		case x > y:
			return 1
		}
		return 0
	case []Value:
		y := b.([]Value)
		n := len(x)
		if len(y) < n {
			n = len(y)
		}
		for i := 0; i < n; i++ {
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
		y := b.(Object)
		xk := append([]string(nil), x.Keys...)
		yk := append([]string(nil), y.Keys...)
		sort.Strings(xk)
		sort.Strings(yk)
		n := len(xk)
		if len(yk) < n {
			n = len(yk)
		}
		for i := 0; i < n; i++ {
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

func constructorRank(v Value) int {
	switch v.(type) {
	case nil:
		return 0
	case bool:
		return 1
	case float64:
		return 2
	case string:
		return 3
	case []Value:
		return 4
	case Object:
		return 5
	}
	return -1
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
		return "", err
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

// Itoa wraps strconv.Itoa for use in range-binder fixtures.
func Itoa(i int) string { return strconv.Itoa(i) }
