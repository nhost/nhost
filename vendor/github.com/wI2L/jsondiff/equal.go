package jsondiff

import (
	"encoding/json"
	"strconv"
)

type invalidJSONTypeError struct {
	t any
}

// jsonValueType represents the type of JSON value.
// It follows the types of values stored by json.Unmarshal
// in interface values.
type jsonValueType uint

const (
	jsonInvalid jsonValueType = iota
	jsonNull
	jsonString
	jsonBoolean
	jsonNumberFloat
	jsonNumberString
	jsonArray
	jsonObject
)

// jsonTypeSwitch returns the JSON type of the value
// held by the interface using a type switch statement.
func jsonTypeSwitch(i interface{}) jsonValueType {
	switch i.(type) {
	case nil:
		return jsonNull
	case string:
		return jsonString
	case bool:
		return jsonBoolean
	case float64:
		return jsonNumberFloat
	case json.Number:
		return jsonNumberString
	case []interface{}:
		return jsonArray
	case map[string]interface{}:
		return jsonObject
	default:
		return jsonInvalid
	}
}

// areComparable returns whether the interface values
// i1 and i2 can be compared. The values are comparable
// only if they are both non-nil and share the same kind.
func areComparable(i1, i2 interface{}) bool {
	return jsonTypeSwitch(i1) == jsonTypeSwitch(i2)
}

func deepEqual(src, tgt interface{}) bool {
	if src == nil && tgt == nil {
		// Fast path.
		return true
	}
	return deepEqualValue(src, tgt)
}

func deepEqualValue(src, tgt interface{}) bool {
	st := jsonTypeSwitch(src)
	if st == jsonInvalid {
		panic(invalidJSONTypeError{t: src})
	}
	tt := jsonTypeSwitch(tgt)
	if tt == jsonInvalid {
		panic(invalidJSONTypeError{t: tgt})
	}
	if st != tt {
		return false
	}
	switch st {
	case jsonNull:
		return true
	case jsonString:
		return src.(string) == tgt.(string)
	case jsonBoolean:
		return src.(bool) == tgt.(bool)
	case jsonNumberFloat:
		return src.(float64) == tgt.(float64)
	case jsonNumberString:
		return src.(json.Number) == tgt.(json.Number)
	case jsonArray:
		oarr := src.([]interface{})
		narr := tgt.([]interface{})

		if len(oarr) != len(narr) {
			return false
		}
		for i := 0; i < len(oarr); i++ {
			if !deepEqual(oarr[i], narr[i]) {
				return false
			}
		}
		return true
	case jsonObject:
		oobj := src.(map[string]interface{})
		nobj := tgt.(map[string]interface{})

		if len(oobj) != len(nobj) {
			return false
		}
		for k, v1 := range oobj {
			v2, ok := nobj[k]
			if !ok {
				// Key not found in target.
				return false
			}
			if !deepEqual(v1, v2) {
				return false
			}
		}
		return true
	default:
		panic("unexpected json type")
	}
}

var jsonTypeNames = []string{
	jsonInvalid:      "Invalid",
	jsonBoolean:      "Boolean",
	jsonNumberFloat:  "Number",
	jsonNumberString: "json.Number",
	jsonString:       "String",
	jsonNull:         "Null",
	jsonObject:       "Object",
	jsonArray:        "Array",
}

// String implements fmt.Stringer for jsonValueType.
func (t jsonValueType) String() string {
	if uint(t) < uint(len(jsonTypeNames)) {
		return jsonTypeNames[t]
	}
	return "type" + strconv.Itoa(int(t))
}
