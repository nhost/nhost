// Package funcs implements jsontmpl's built-in function library.
// One-for-one port of upstream's basicFuncMap (CustomFunctions.hs:38-55).
//
// Two upstream entries crash on edge inputs (inverse(0), tail([]),
// tail("")). The port returns a clean FunctionError in those cases
// and the divergence is documented in UPSTREAM.md.
package funcs

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"unicode/utf8"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/eval"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// Basic returns a fresh copy of the basic function map. Returning a
// new map (rather than a package-level value) is intentional so
// per-render overlays can mutate it without affecting other calls.
func Basic() map[string]eval.Func {
	return map[string]eval.Func{
		"empty":       emptyF,
		"size":        sizeF,
		"inverse":     inverseF,
		"head":        headF,
		"tail":        tailF,
		"toCaseFold":  toCaseFoldF,
		"toLower":     toLowerF,
		"toUpper":     toUpperF,
		"toTitle":     toTitleF,
		"escapeUri":   escapeURIF,
		"fromPairs":   fromPairsF,
		"toPairs":     toPairsF,
		"removeNulls": removeNullsF,
		"concat":      concatF,
		"not":         notF,
	}
}

// emptyF — CustomFunctions.hs:58-67.
func emptyF(v eval.Value) (eval.Value, error) {
	switch x := v.(type) {
	case eval.Object:
		return len(x.Keys) == 0, nil
	case []eval.Value:
		return len(x) == 0, nil
	case string:
		return strings.TrimSpace(x) == "", nil
	case float64:
		return x == 0, nil
	case bool:
		return nil, errors.New("Cannot define emptiness for a boolean")
	case nil:
		return true, nil
	}
	return nil, fmt.Errorf("empty: unhandled type %T", v)
}

// sizeF — CustomFunctions.hs:69-75. Returns the raw signed value for
// numbers (not magnitude) and 0/1 for booleans. Plan §5.1 notes the
// surprise.
func sizeF(v eval.Value) (eval.Value, error) {
	switch x := v.(type) {
	case eval.Object:
		return float64(len(x.Keys)), nil
	case []eval.Value:
		return float64(len(x)), nil
	case string:
		return float64(utf8.RuneCountInString(x)), nil
	case float64:
		return x, nil
	case bool:
		if x {
			return float64(1), nil
		}
		return float64(0), nil
	case nil:
		return float64(0), nil
	}
	return nil, fmt.Errorf("size: unhandled type %T", v)
}

// inverseF — CustomFunctions.hs:77-83. inverse(0) is a port divergence:
// upstream throws a Haskell exception; we return a FunctionError.
func inverseF(v eval.Value) (eval.Value, error) {
	switch x := v.(type) {
	case eval.Object:
		return x, nil
	case []eval.Value:
		out := make([]eval.Value, len(x))
		for i, e := range x {
			out[len(x)-1-i] = e
		}
		return out, nil
	case string:
		// Reverse by runes, not bytes.
		r := []rune(x)
		for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
			r[i], r[j] = r[j], r[i]
		}
		return string(r), nil
	case float64:
		if x == 0 || math.IsNaN(x) {
			return nil, errors.New("Division by zero")
		}
		return 1 / x, nil
	case bool:
		return !x, nil
	case nil:
		return nil, nil
	}
	return nil, fmt.Errorf("inverse: unhandled type %T", v)
}

// headF — CustomFunctions.hs:85-92.
func headF(v eval.Value) (eval.Value, error) {
	switch x := v.(type) {
	case []eval.Value:
		if len(x) == 0 {
			return nil, errors.New("Empty array")
		}
		return x[0], nil
	case string:
		if x == "" {
			return nil, errors.New("Empty string")
		}
		r, _ := utf8.DecodeRuneInString(x)
		return string(r), nil
	}
	return nil, errors.New("Expected an array or string")
}

// tailF — CustomFunctions.hs:94-97. Upstream crashes on empty inputs;
// we return the same error strings as headF for uniformity (plan §14).
func tailF(v eval.Value) (eval.Value, error) {
	switch x := v.(type) {
	case []eval.Value:
		if len(x) == 0 {
			return nil, errors.New("Empty array")
		}
		return append([]eval.Value(nil), x[1:]...), nil
	case string:
		if x == "" {
			return nil, errors.New("Empty string")
		}
		_, size := utf8.DecodeRuneInString(x)
		return x[size:], nil
	}
	return nil, errors.New("Expected an array or string")
}

// toCaseFold — CustomFunctions.hs:99. Unicode case folding.
func toCaseFoldF(v eval.Value) (eval.Value, error) {
	s, ok := v.(string)
	if !ok {
		return nil, parsingTextErr(v)
	}
	return cases.Fold().String(s), nil
}

func toLowerF(v eval.Value) (eval.Value, error) {
	s, ok := v.(string)
	if !ok {
		return nil, parsingTextErr(v)
	}
	return cases.Lower(language.Und).String(s), nil
}

func toUpperF(v eval.Value) (eval.Value, error) {
	s, ok := v.(string)
	if !ok {
		return nil, parsingTextErr(v)
	}
	return cases.Upper(language.Und).String(s), nil
}

func toTitleF(v eval.Value) (eval.Value, error) {
	s, ok := v.(string)
	if !ok {
		return nil, parsingTextErr(v)
	}
	return cases.Title(language.Und).String(s), nil
}

// escapeURI — CustomFunctions.hs:108. Encodes per RFC 3986 unreserved.
// Network/URI's `escapeURIString isUnreserved` keeps A-Z a-z 0-9 - _ . ~
// and percent-encodes everything else as %XX bytes of its UTF-8.
func escapeURIF(v eval.Value) (eval.Value, error) {
	s, ok := v.(string)
	if !ok {
		return nil, parsingTextErr(v)
	}
	var b strings.Builder
	for _, r := range s {
		if isUnreserved(r) {
			b.WriteRune(r)
			continue
		}
		for _, c := range []byte(string(r)) {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String(), nil
}

func isUnreserved(r rune) bool {
	switch {
	case r >= 'A' && r <= 'Z':
		return true
	case r >= 'a' && r <= 'z':
		return true
	case r >= '0' && r <= '9':
		return true
	case r == '-', r == '_', r == '.', r == '~':
		return true
	}
	return false
}

// toPairsF — CustomFunctions.hs:111-114. Returns array of [k, v] pairs
// in insertion order (matches upstream itoList).
func toPairsF(v eval.Value) (eval.Value, error) {
	obj, ok := v.(eval.Object)
	if !ok {
		return nil, parsingErr("Object", v)
	}
	out := make([]eval.Value, 0, len(obj.Keys))
	for _, k := range obj.Keys {
		out = append(out, []eval.Value{k, obj.Data[k]})
	}
	return out, nil
}

// fromPairsF — CustomFunctions.hs:117-126.
func fromPairsF(v eval.Value) (eval.Value, error) {
	arr, ok := v.([]eval.Value)
	if !ok {
		return nil, parsingErrf("Nested Arrays", "Array", v)
	}
	out := eval.NewObject()
	for _, el := range arr {
		pair, ok := el.([]eval.Value)
		if !ok || len(pair) != 2 {
			return nil, errors.New(
				"Expected an array of shape [ [k1,v1], [k2,v2] ... ] - With String keys.",
			)
		}
		key, err := pairKeyFromValue(pair[0])
		if err != nil {
			return nil, err
		}
		out.Set(key, pair[1])
	}
	return out, nil
}

// pairKeyFromValue mirrors Aeson's `parseJSON :: Value -> Parser Key`.
// Only J.String parses cleanly; other types raise an error whose
// message matches upstream (plan §13 q3).
func pairKeyFromValue(v eval.Value) (string, error) {
	switch x := v.(type) {
	case string:
		return x, nil
	case bool:
		return "", errors.New("parsing Key failed, expected String, but encountered Boolean")
	case nil:
		return "", errors.New("parsing Key failed, expected String, but encountered Null")
	case float64:
		return "", errors.New("parsing Key failed, expected String, but encountered Number")
	case []eval.Value:
		return "", errors.New("parsing Key failed, expected String, but encountered Array")
	case eval.Object:
		return "", errors.New("parsing Key failed, expected String, but encountered Object")
	}
	return "", fmt.Errorf("parsing Key failed: unknown value type %T", v)
}

// removeNullsF — CustomFunctions.hs:128. Non-recursive.
func removeNullsF(v eval.Value) (eval.Value, error) {
	arr, ok := v.([]eval.Value)
	if !ok {
		return nil, parsingErr("Array", v)
	}
	out := make([]eval.Value, 0, len(arr))
	for _, el := range arr {
		if el != nil {
			out = append(out, el)
		}
	}
	return out, nil
}

// concatF — CustomFunctions.hs:138. Tries arrays-of-arrays, then
// strings-of-strings, then objects-of-objects (rightmost wins).
func concatF(v eval.Value) (eval.Value, error) {
	arr, ok := v.([]eval.Value)
	if !ok {
		return nil, parsingErr("Array", v)
	}
	// Try arrays-of-arrays.
	if out, ok := tryFlatten(arr); ok {
		return out, nil
	}
	// Try strings-of-strings.
	if out, ok := tryStringJoin(arr); ok {
		return out, nil
	}
	// Try objects-merge (rightmost wins).
	out, lastErr := tryObjectMerge(arr)
	if lastErr != nil {
		return nil, lastErr
	}
	return out, nil
}

func tryFlatten(arr []eval.Value) ([]eval.Value, bool) {
	out := []eval.Value{}
	for _, el := range arr {
		sub, ok := el.([]eval.Value)
		if !ok {
			return nil, false
		}
		out = append(out, sub...)
	}
	return out, true
}

func tryStringJoin(arr []eval.Value) (string, bool) {
	var sb strings.Builder
	for _, el := range arr {
		s, ok := el.(string)
		if !ok {
			return "", false
		}
		sb.WriteString(s)
	}
	return sb.String(), true
}

// tryObjectMerge: when concat() falls through to the object branch and
// any element is not an Object, upstream surfaces an Aeson parse error
// from the last <|> branch. The message matches upstream (plan §13 q5).
func tryObjectMerge(arr []eval.Value) (eval.Value, error) {
	merged := eval.NewObject()
	for _, el := range arr {
		obj, ok := el.(eval.Object)
		if !ok {
			return nil, parsingErrf("Nested Object", "Object", el)
		}
		for _, k := range obj.Keys {
			merged.Set(k, obj.Data[k])
		}
	}
	return merged, nil
}

// notF — CustomFunctions.hs:152.
func notF(v eval.Value) (eval.Value, error) {
	b, ok := v.(bool)
	if !ok {
		return nil, parsingErr("Bool", v)
	}
	return !b, nil
}

// --- Error builders mirroring Aeson's diagnostics ---------------------------

func parsingTextErr(v eval.Value) error {
	return parsingErr("String", v)
}

// parsingErr builds an Aeson-style parse diagnostic for the common case where
// the prefix label and the expected Aeson type token are identical (e.g.
// "String", "Array", "Bool").
func parsingErr(expected string, v eval.Value) error {
	return parsingErrf(expected, expected, v)
}

// parsingErrf builds an Aeson parse diagnostic whose prefix label and expected
// type token differ. Aeson's nested-parser messages use an asymmetric form,
// e.g. "parsing Nested Object failed, expected Object, but encountered Array":
// the "parsing X failed" prefix carries the parser label ("Nested Object")
// while the "expected Y" clause carries the Aeson type token ("Object"). The
// upstream goldens (testdata/derived/q05*) pin this exact wording.
func parsingErrf(prefixLabel, aesonType string, v eval.Value) error {
	return fmt.Errorf("parsing %s failed, expected %s, but encountered %s",
		prefixLabel, aesonType, eval.TypeName(v))
}
