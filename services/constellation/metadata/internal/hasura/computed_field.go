package hasura

import (
	"bytes"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"math"
)

var (
	errComputedFunctionMissing = errors.New("computed field definition has no function")
	errComputedFunctionShape   = errors.New(
		"computed field function must be a name or schema-qualified object",
	)
	errComputedFunctionName = errors.New("computed field function has no name")
	errComputedFieldName    = errors.New("computed field has no name")
	errComputedGrantName    = errors.New("computed grant must be a nonempty string")
)

// ComputedFieldEntry keeps a JSON-safe value even when its definition cannot
// be decoded. Reconciliation can report the bad entry without dropping peers.
type ComputedFieldEntry struct {
	Name            string
	Function        TableSource
	TableArgument   string
	SessionArgument string
	Comment         string
	Raw             jsontext.Value
	DecodeError     error
}

// ComputedFieldGrant keeps a malformed grant as well as valid role grants.
type ComputedFieldGrant struct {
	Name        string
	Raw         jsontext.Value
	DecodeError error
}

// ComputedFieldList retains the JSON array (or a JSON-safe YAML projection),
// including null, empty, unknown keys and invalid members. A nil Raw means absent.
type ComputedFieldList struct {
	Raw     jsontext.Value
	Entries []ComputedFieldEntry
}

func (l *ComputedFieldList) UnmarshalJSON(data []byte) error {
	l.Raw = bytes.Clone(data)
	l.Entries = nil

	var entries []jsontext.Value
	if err := json.Unmarshal(data, &entries); err != nil {
		l.Entries = []ComputedFieldEntry{
			{
				Name:            "",
				Function:        TableSource{Name: "", Schema: "", Unknown: nil},
				TableArgument:   "",
				SessionArgument: "",
				Comment:         "",
				Raw: bytes.Clone(
					data,
				),
				DecodeError: fmt.Errorf("decoding computed fields list: %w", err),
			},
		}

		return nil
	}

	for _, raw := range entries {
		entry := ComputedFieldEntry{
			Name:            "",
			Function:        TableSource{Name: "", Schema: "", Unknown: nil},
			TableArgument:   "",
			SessionArgument: "",
			Comment:         "",
			Raw:             bytes.Clone(raw),
			DecodeError:     nil,
		}

		var field struct {
			Name       string `json:"name"`
			Definition struct {
				Function        jsontext.Value `json:"function"`
				TableArgument   string         `json:"table_argument"`
				SessionArgument string         `json:"session_argument"`
			} `json:"definition"`
			Comment string `json:"comment"`
		}

		if err := json.Unmarshal(raw, &field); err != nil {
			entry.DecodeError = fmt.Errorf("decoding computed field: %w", err)
		} else {
			entry.Name = field.Name
			entry.TableArgument = field.Definition.TableArgument
			entry.SessionArgument = field.Definition.SessionArgument
			entry.Comment = field.Comment

			entry.Function, entry.DecodeError = decodeComputedFunction(field.Definition.Function)
			if entry.DecodeError == nil && entry.Name == "" {
				entry.DecodeError = errComputedFieldName
			}
		}

		l.Entries = append(l.Entries, entry)
	}

	return nil
}

func (l ComputedFieldList) IsZero() bool { return l.Raw == nil }

func (l ComputedFieldList) MarshalJSON() ([]byte, error) {
	if l.Raw == nil {
		return []byte("null"), nil
	}

	return l.Raw, nil
}

func decodeComputedFunction(raw jsontext.Value) (TableSource, error) {
	var function TableSource
	if len(raw) == 0 {
		return function, errComputedFunctionMissing
	}

	switch firstNonWhitespaceByte(raw) {
	case '"':
		if err := json.Unmarshal(raw, &function.Name); err != nil {
			return function, fmt.Errorf("decoding function name: %w", err)
		}
	case '{':
		if err := json.Unmarshal(raw, &function); err != nil {
			return function, fmt.Errorf("decoding function reference: %w", err)
		}
	default:
		return function, errComputedFunctionShape
	}

	if function.Name == "" {
		return function, errComputedFunctionName
	}

	return function, nil
}

// ComputedFieldGrantList retains a malformed permission list without turning
// it into a broader grant. Null and absent are distinct in Raw.
type ComputedFieldGrantList struct {
	Raw     jsontext.Value
	Entries []ComputedFieldGrant
}

func (l *ComputedFieldGrantList) UnmarshalJSON(data []byte) error {
	l.Raw = bytes.Clone(data)
	l.Entries = nil

	var entries []jsontext.Value
	if err := json.Unmarshal(data, &entries); err != nil {
		l.Entries = []ComputedFieldGrant{
			{
				Name:        "",
				Raw:         bytes.Clone(data),
				DecodeError: fmt.Errorf("decoding computed grant list: %w", err),
			},
		}

		return nil
	}

	for _, raw := range entries {
		entry := ComputedFieldGrant{Name: "", Raw: bytes.Clone(raw), DecodeError: nil}
		if err := json.Unmarshal(raw, &entry.Name); err != nil || entry.Name == "" {
			entry.DecodeError = fmt.Errorf("%w: %s", errComputedGrantName, raw)
		}

		l.Entries = append(l.Entries, entry)
	}

	return nil
}

func (l ComputedFieldGrantList) IsZero() bool { return l.Raw == nil }

func (l ComputedFieldGrantList) MarshalJSON() ([]byte, error) {
	if l.Raw == nil {
		return []byte("null"), nil
	}

	return l.Raw, nil
}

// computedYAMLJSON converts the decoded value directly: a YAML re-encode
// changes quoted strings (including whitespace and numeric-looking strings).
// On values JSON cannot represent, return a safe approximation and the error
// so callers can keep the affected entry invalid without aborting the load.
func computedYAMLJSON(value any) (jsontext.Value, error) {
	result, err := json.Marshal(value, json.Deterministic(true))
	if err == nil {
		return result, nil
	}

	result, fallbackErr := json.Marshal(jsonSafeYAML(value), json.Deterministic(true))
	if fallbackErr != nil {
		// Even unexpected YAML node types cannot break the file snapshot.
		return jsontext.Value(
				`null`,
			), fmt.Errorf(
				"marshaling YAML value: %w (fallback: %w)",
				err,
				fallbackErr,
			)
	}

	return result, fmt.Errorf("marshaling YAML value: %w", err)
}

// jsonSafeYAML replaces non-JSON YAML scalars in maps and arrays with null,
// preserving valid siblings without turning an invalid grant or function into
// a valid-looking string when the snapshot is reloaded.
func jsonSafeYAML(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			out[key] = jsonSafeYAML(item)
		}

		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = jsonSafeYAML(item)
		}

		return out
	case float64:
		if math.IsInf(v, 0) || math.IsNaN(v) {
			return nil
		}
	case float32:
		if math.IsInf(float64(v), 0) || math.IsNaN(float64(v)) {
			return nil
		}
	}

	return value
}

// computedYAMLList isolates conversion failures to their own list
// element; the JSON boundary still decodes each element independently.
func computedYAMLList(
	value any,
	validAfterFallback func(jsontext.Value) bool,
) (jsontext.Value, map[int]error) {
	items, ok := value.([]any)
	if !ok {
		raw, err := computedYAMLJSON(value)
		if err != nil {
			// A non-JSON YAML scalar becomes null. Unlike a malformed JSON
			// list, null decodes with no entries, so retain an invalid member
			// in the snapshot as well as in the first load.
			if bytes.Equal(raw, []byte(`null`)) {
				return jsontext.Value(`[null]`), map[int]error{0: err}
			}

			return raw, map[int]error{0: err}
		}

		return raw, nil
	}

	rawItems := make([]jsontext.Value, 0, len(items))

	conversionErrors := make(map[int]error)
	for i, item := range items {
		raw, err := computedYAMLJSON(item)
		if err != nil {
			conversionErrors[i] = err
			// JSON nulls in optional fields can make an invalid YAML field
			// appear valid on snapshot reload (notably session_argument).
			// Retain representable siblings unless the approximation would
			// decode as a valid entry; then use a fail-closed null member.
			if validAfterFallback != nil && validAfterFallback(raw) {
				raw = jsontext.Value(`null`)
			}
		}

		rawItems = append(rawItems, raw)
	}

	raw, err := json.Marshal(rawItems, json.Deterministic(true))
	if err != nil {
		// The individually encoded entries above are all valid JSON values.
		fallback := jsontext.Value(`null`)
		return fallback, map[int]error{0: fmt.Errorf("marshaling computed list: %w", err)}
	}

	return raw, conversionErrors
}

func validComputedFieldJSON(raw jsontext.Value) bool {
	var field ComputedFieldList
	if err := field.UnmarshalJSON(append(append([]byte(`[`), raw...), ']')); err != nil {
		return false
	}

	return len(field.Entries) == 1 && field.Entries[0].DecodeError == nil
}

// computedYAMLUnknown retains representable extension keys, omitting only
// unrepresentable YAML scalars rather than dropping their valid siblings.
func computedYAMLUnknown(extra map[string]any) jsontext.Value {
	valid, _ := jsonRepresentableYAML(extra)

	raw, err := json.Marshal(valid, json.Deterministic(true))
	if err != nil {
		return nil
	}

	return raw
}

func jsonRepresentableYAML(value any) (any, bool) {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			if safe, ok := jsonRepresentableYAML(item); ok {
				out[key] = safe
			}
		}

		return out, true
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			// Keep array positions stable when an extension contains a bad scalar.
			out[i], _ = jsonRepresentableYAML(item)
		}

		return out, true
	default:
		if _, err := json.Marshal(v); err != nil {
			return nil, false
		}

		return v, true
	}
}
