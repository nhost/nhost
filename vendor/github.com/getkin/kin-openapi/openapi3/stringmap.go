package openapi3

import "encoding/json"

// StringMap is a map[string]string that ignores the origin in the underlying json representation.
type StringMap map[string]string

// UnmarshalJSON sets StringMap to a copy of data.
func (stringMap *StringMap) UnmarshalJSON(data []byte) (err error) {
	*stringMap, _, err = unmarshalStringMap[string](data)
	return
}

// unmarshalStringMapP unmarshals given json into a map[string]*V
func unmarshalStringMapP[V any](data []byte) (map[string]*V, *Origin, error) {
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, nil, err
	}

	origin, err := deepCast[Origin](m[originKey])
	if err != nil {
		return nil, nil, err
	}
	delete(m, originKey)

	result := make(map[string]*V, len(m))
	for k, v := range m {
		value, err := deepCast[V](v)
		if err != nil {
			return nil, nil, err
		}
		result[k] = value
	}

	return result, origin, nil
}

// unmarshalStringMap unmarshals given json into a map[string]V
func unmarshalStringMap[V any](data []byte) (map[string]V, *Origin, error) {
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, nil, err
	}

	origin, err := deepCast[Origin](m[originKey])
	if err != nil {
		return nil, nil, err
	}
	delete(m, originKey)

	result := make(map[string]V, len(m))
	for k, v := range m {
		value, err := deepCast[V](v)
		if err != nil {
			return nil, nil, err
		}
		result[k] = *value
	}

	return result, origin, nil
}

// deepCast casts any value to a value of type V.
func deepCast[V any](value any) (*V, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	var result V
	if err = json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
