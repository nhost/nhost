// Package yaml provides a wrapper around go-yaml designed to enable a better
// way of handling YAML when marshaling to and from structs.
//
// In short, this package first converts YAML to JSON using go-yaml and then
// uses json.Marshal and json.Unmarshal to convert to or from the struct. This
// means that it effectively reuses the JSON struct tags as well as the custom
// JSON methods MarshalJSON and UnmarshalJSON unlike go-yaml.
package yaml // import "github.com/oasdiff/yaml"

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"

	yaml "github.com/oasdiff/yaml3"
)

// Marshal the object into JSON then converts JSON to YAML and returns the
// YAML.
func Marshal(o interface{}) ([]byte, error) {
	j, err := json.Marshal(o)
	if err != nil {
		return nil, fmt.Errorf("error marshaling into JSON: %v", err)
	}

	y, err := JSONToYAML(j)
	if err != nil {
		return nil, fmt.Errorf("error converting JSON to YAML: %v", err)
	}

	return y, nil
}

// JSONOpt is a decoding option for decoding from JSON format.
type JSONOpt func(*json.Decoder) *json.Decoder

// OriginOpt controls origin-tracking behavior. When Enabled is false the
// OriginTree returned by Unmarshal is nil.
type OriginOpt struct {
	// Enabled adds __origin__ metadata to maps during unmarshaling.
	Enabled bool
	// File is the source file name recorded in origin metadata.
	File string
}

// DecodeOpts groups options that apply to the YAML decoder side, as opposed
// to JSONOpt which configures the JSON unmarshal step.
type DecodeOpts struct {
	// Origin controls origin-tracking behavior. When Origin.Enabled is
	// false the OriginTree returned by Unmarshal is nil.
	Origin OriginOpt
	// DisableTimestamps suppresses YAML 1.1 implicit-timestamp resolution.
	// When true, untagged date-shaped scalars (e.g. "1344-08-22") resolve
	// to strings instead of time.Time, which keeps map keys stable for
	// real-world specs that use date-shaped strings as keys. Explicit
	// "!!timestamp" tags in the source still resolve to time.Time.
	DisableTimestamps bool
}

// OriginTree holds __origin__ data extracted from a YAML-decoded map tree.
// It mirrors the structure of the spec: Fields tracks map children by key,
// Items tracks slice children by index.
type OriginTree struct {
	// File is the source file for all origins in this subtree.
	// Set once at the root of each decode call; all nodes in the same
	// decode share the same file.
	File string
	// Origin is the raw __origin__ value ([]any compact sequence) for this node.
	// Format: [key_name, key_line, key_col, nf, f1_name, f1_delta, f1_col, ..., ns, ...]
	Origin any
	// Fields holds child trees keyed by map key name.
	Fields map[string]*OriginTree
	// Items holds child trees for slice elements (index-aligned).
	Items []*OriginTree
}

// Unmarshal converts YAML to JSON then uses JSON to unmarshal
// into o. It is the single public unmarshal entry point: pass DecodeOpts{}
// for the simple case, or set Origin / DisableTimestamps to opt into
// origin tracking or YAML 1.1 timestamp-resolution suppression. The
// variadic JSONOpt list configures the JSON unmarshal step. The returned
// OriginTree is nil when origin tracking is disabled.
func Unmarshal(y []byte, o interface{}, decode DecodeOpts, opts ...JSONOpt) (*OriginTree, error) {
	dec := yaml.NewDecoder(bytes.NewReader(y))
	dec.Origin(decode.Origin.Enabled, decode.Origin.File)
	if decode.DisableTimestamps {
		dec.DisableTimestamps(true)
	}

	// Decode YAML into a generic object.
	var yamlObj interface{}
	if err := dec.Decode(&yamlObj); err != nil {
		if !errors.Is(err, io.EOF) {
			return nil, fmt.Errorf("error converting YAML to JSON: %v", err)
		}
	}

	// Extract __origin__ before JSON conversion so the JSON stays small.
	var tree *OriginTree
	if decode.Origin.Enabled {
		tree = extractOrigins(yamlObj, decode.Origin.File)
	}

	// Convert to JSON (without __origin__) and unmarshal into the target struct.
	vo := reflect.ValueOf(o)
	jsonObj, err := convertToJSONableObject(yamlObj, &vo)
	if err != nil {
		return nil, fmt.Errorf("error converting YAML to JSON: %v", err)
	}
	j, err := json.Marshal(jsonObj)
	if err != nil {
		return nil, fmt.Errorf("error converting YAML to JSON: %v", err)
	}
	if err := jsonUnmarshal(bytes.NewReader(j), o, opts...); err != nil {
		return nil, fmt.Errorf("error unmarshaling JSON: %v", err)
	}

	return tree, nil
}

const originKey = "__origin__"

// extractOrigins recursively extracts and removes __origin__ entries from a
// YAML-decoded map tree, returning the origin data as an OriginTree.
// file is the source file for all nodes in this decode call.
func extractOrigins(v any, file string) *OriginTree {
	switch val := v.(type) {
	case map[string]any:
		return extractOriginsFromStringMap(val, file)
	case map[interface{}]interface{}:
		// yaml3 produces map[interface{}]interface{} when map keys are non-string
		// (e.g. integer HTTP status codes like 200). __origin__ is always a string
		// key, so we must handle this case to strip it from mixed-key maps.
		tree := &OriginTree{File: file}
		if orig, ok := val[originKey]; ok {
			tree.Origin = orig
			delete(val, originKey)
		}
		for k, child := range val {
			if childTree := extractOrigins(child, file); childTree != nil {
				if tree.Fields == nil {
					tree.Fields = make(map[string]*OriginTree)
				}
				// Convert key to string: mirrors convertToJSONableObject behaviour.
				// String keys pass through; int/int64/float64 keys are formatted.
				var ks string
				switch kt := k.(type) {
				case string:
					ks = kt
				case int:
					ks = strconv.Itoa(kt)
				case int64:
					ks = strconv.FormatInt(kt, 10)
				case float64:
					ks = strconv.FormatFloat(kt, 'g', -1, 64)
				default:
					ks = fmt.Sprintf("%v", k)
				}
				tree.Fields[ks] = childTree
			}
		}
		if tree.Origin == nil && tree.Fields == nil {
			return nil
		}
		return tree
	case []any:
		var items []*OriginTree
		hasChild := false
		for _, child := range val {
			childTree := extractOrigins(child, file)
			items = append(items, childTree) // may be nil; preserves index alignment
			if childTree != nil {
				hasChild = true
			}
		}
		if !hasChild {
			return nil
		}
		return &OriginTree{File: file, Items: items}
	default:
		return nil
	}
}

func extractOriginsFromStringMap(val map[string]any, file string) *OriginTree {
	tree := &OriginTree{File: file}
	if orig, ok := val[originKey]; ok {
		tree.Origin = orig
		delete(val, originKey)
	}
	for k, child := range val {
		if childTree := extractOrigins(child, file); childTree != nil {
			if tree.Fields == nil {
				tree.Fields = make(map[string]*OriginTree)
			}
			tree.Fields[k] = childTree
		}
	}
	if tree.Origin == nil && tree.Fields == nil {
		return nil
	}
	return tree
}

// jsonUnmarshal unmarshals the JSON byte stream from the given reader into the
// object, optionally applying decoder options prior to decoding.  We are not
// using json.Unmarshal directly as we want the chance to pass in non-default
// options.
func jsonUnmarshal(r io.Reader, o interface{}, opts ...JSONOpt) error {
	d := json.NewDecoder(r)
	for _, opt := range opts {
		d = opt(d)
	}
	if err := d.Decode(&o); err != nil {
		return fmt.Errorf("while decoding JSON: %v", err)
	}
	return nil
}

// JSONToYAML converts JSON to YAML.
func JSONToYAML(j []byte) ([]byte, error) {
	// Convert the JSON to an object.
	var jsonObj interface{}
	// We are using yaml.Unmarshal here (instead of json.Unmarshal) because the
	// Go JSON library doesn't try to pick the right number type (int, float,
	// etc.) when unmarshalling to interface{}, it just picks float64
	// universally. go-yaml does go through the effort of picking the right
	// number type, so we can preserve number type throughout this process.
	err := yaml.Unmarshal(j, &jsonObj)
	if err != nil {
		return nil, err
	}

	// Marshal this object into YAML.
	return yaml.Marshal(jsonObj)
}

// YAMLToJSON converts YAML to JSON. Since JSON is a subset of YAML,
// passing JSON through this method should be a no-op.
//
// Things YAML can do that are not supported by JSON:
//   - In YAML you can have binary and null keys in your maps. These are invalid
//     in JSON. (int and float keys are converted to strings.)
//   - Binary data in YAML with the !!binary tag is not supported. If you want to
//     use binary data with this library, encode the data as base64 as usual but do
//     not use the !!binary tag in your YAML. This will ensure the original base64
//     encoded data makes it all the way through to the JSON.
func YAMLToJSON(y []byte) ([]byte, error) { //nolint:revive
	dec := yaml.NewDecoder(bytes.NewReader(y))
	return yamlToJSON(dec, nil)
}

func yamlToJSON(dec *yaml.Decoder, jsonTarget *reflect.Value) ([]byte, error) {
	// Convert the YAML to an object.
	var yamlObj interface{}
	if err := dec.Decode(&yamlObj); err != nil {
		// Functionality changed in v3 which means we need to ignore EOF error.
		// See https://github.com/go-yaml/yaml/issues/639
		if !errors.Is(err, io.EOF) {
			return nil, err
		}
	}

	// YAML objects are not completely compatible with JSON objects (e.g. you
	// can have non-string keys in YAML). So, convert the YAML-compatible object
	// to a JSON-compatible object, failing with an error if irrecoverable
	// incompatibilities happen along the way.
	jsonObj, err := convertToJSONableObject(yamlObj, jsonTarget)
	if err != nil {
		return nil, err
	}

	// Convert this object to JSON and return the data.
	return json.Marshal(jsonObj)
}

// convertToJSONableObject converts a YAML object to a JSON-compatible object.
func convertToJSONableObject(yamlObj interface{}, jsonTarget *reflect.Value) (interface{}, error) { //nolint:gocyclo
	var err error

	// Resolve jsonTarget to a concrete value (i.e. not a pointer or an
	// interface). We pass decodingNull as false because we're not actually
	// decoding into the value, we're just checking if the ultimate target is a
	// string.
	if jsonTarget != nil {
		ju, tu, pv := indirect(*jsonTarget, false)
		// We have a JSON or Text Umarshaler at this level, so we can't be trying
		// to decode into a string.
		if ju != nil || tu != nil {
			jsonTarget = nil
		} else {
			jsonTarget = &pv
		}
	}

	// go-yaml v3 changed from v2 and now will provide map[string]interface{} by
	// default and map[interface{}]interface{} when none of the keys strings.
	// To get around this, we run a pre-loop to convert the map.
	// JSON only supports strings as keys, so we must convert.

	switch typedYAMLObj := yamlObj.(type) {
	case map[interface{}]interface{}:
		// From my reading of go-yaml v2 (specifically the resolve function),
		// keys can only have the types string, int, int64, float64, binary
		// (unsupported), or null (unsupported).
		strMap := make(map[string]interface{})
		for k, v := range typedYAMLObj {
			// Resolve the key to a string first.
			var keyString string
			switch typedKey := k.(type) {
			case string:
				keyString = typedKey
			case int:
				keyString = strconv.Itoa(typedKey)
			case int64:
				// go-yaml will only return an int64 as a key if the system
				// architecture is 32-bit and the key's value is between 32-bit
				// and 64-bit. Otherwise the key type will simply be int.
				keyString = strconv.FormatInt(typedKey, 10)
			case float64:
				// Float64 is now supported in keys
				keyString = strconv.FormatFloat(typedKey, 'g', -1, 64)
			case bool:
				if typedKey {
					keyString = "true"
				} else {
					keyString = "false"
				}
			default:
				return nil, fmt.Errorf("unsupported map key of type: %s, key: %+#v, value: %+#v",
					reflect.TypeOf(k), k, v)
			}
			strMap[keyString] = v
		}
		// replace yamlObj with our new string map
		yamlObj = strMap
	}

	// If yamlObj is a number or a boolean, check if jsonTarget is a string -
	// if so, coerce.  Else return normal.
	// If yamlObj is a map or array, find the field that each key is
	// unmarshaling to, and when you recurse pass the reflect.Value for that
	// field back into this function.
	switch typedYAMLObj := yamlObj.(type) {
	case map[string]interface{}:
		for k, v := range typedYAMLObj {

			// jsonTarget should be a struct or a map. If it's a struct, find
			// the field it's going to map to and pass its reflect.Value. If
			// it's a map, find the element type of the map and pass the
			// reflect.Value created from that type. If it's neither, just pass
			// nil - JSON conversion will error for us if it's a real issue.
			if jsonTarget != nil {
				t := *jsonTarget
				if t.Kind() == reflect.Struct {
					keyBytes := []byte(k)
					// Find the field that the JSON library would use.
					var f *field
					fields := cachedTypeFields(t.Type())
					for i := range fields {
						ff := &fields[i]
						if bytes.Equal(ff.nameBytes, keyBytes) {
							f = ff
							break
						}
						// Do case-insensitive comparison.
						if f == nil && ff.equalFold(ff.nameBytes, keyBytes) {
							f = ff
						}
					}
					if f != nil {
						// Find the reflect.Value of the most preferential
						// struct field.
						jtf := t.Field(f.index[0])
						typedYAMLObj[k], err = convertToJSONableObject(v, &jtf)
						if err != nil {
							return nil, err
						}
						continue
					}
				} else if t.Kind() == reflect.Map {
					// Create a zero value of the map's element type to use as
					// the JSON target.
					jtv := reflect.Zero(t.Type().Elem())
					typedYAMLObj[k], err = convertToJSONableObject(v, &jtv)
					if err != nil {
						return nil, err
					}
					continue
				}
			}
			typedYAMLObj[k], err = convertToJSONableObject(v, nil)
			if err != nil {
				return nil, err
			}
		}
		return typedYAMLObj, nil
	case []interface{}:
		// We need to recurse into arrays in case there are any
		// map[interface{}]interface{}'s inside and to convert any
		// numbers to strings.

		// If jsonTarget is a slice (which it really should be), find the
		// thing it's going to map to. If it's not a slice, just pass nil
		// - JSON conversion will error for us if it's a real issue.
		var jsonSliceElemValue *reflect.Value
		if jsonTarget != nil {
			t := *jsonTarget
			if t.Kind() == reflect.Slice {
				// By default slices point to nil, but we need a reflect.Value
				// pointing to a value of the slice type, so we create one here.
				ev := reflect.Indirect(reflect.New(t.Type().Elem()))
				jsonSliceElemValue = &ev
			}
		}

		// Make and use a new array.
		arr := make([]interface{}, len(typedYAMLObj))
		for i, v := range typedYAMLObj {
			arr[i], err = convertToJSONableObject(v, jsonSliceElemValue)
			if err != nil {
				return nil, err
			}
		}
		return arr, nil
	default:
		// If the target type is a string and the YAML type is a number,
		// convert the YAML type to a string.
		if jsonTarget != nil && (*jsonTarget).Kind() == reflect.String {
			// Based on my reading of go-yaml, it may return int, int64,
			// float64, or uint64.
			var s string
			switch typedVal := typedYAMLObj.(type) {
			case int:
				s = strconv.FormatInt(int64(typedVal), 10)
			case int64:
				s = strconv.FormatInt(typedVal, 10)
			case float64:
				s = strconv.FormatFloat(typedVal, 'g', -1, 64)
			case uint64:
				s = strconv.FormatUint(typedVal, 10)
			case bool:
				if typedVal {
					s = "true"
				} else {
					s = "false"
				}
			}
			if len(s) > 0 {
				yamlObj = interface{}(s)
			}
		}
		return yamlObj, nil
	}
}
