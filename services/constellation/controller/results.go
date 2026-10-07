package controller

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

// unmarshalRawResults materializes SQL's raw JSON at any depth. A customized
// source places raw root rows inside a namespace map; leaving those bytes
// opaque prevents both stitching and phantom cleanup on that source.
func unmarshalRawResults(results map[string]any) error {
	for k, v := range results {
		parsed, err := unmarshalRawValue(v)
		if err != nil {
			return fmt.Errorf("key %q: %w", k, err)
		}

		results[k] = parsed
	}

	return nil
}

func unmarshalRawValue(value any) (any, error) {
	switch v := value.(type) {
	case jsontext.Value:
		if v == nil {
			return value, nil
		}

		var parsed any
		if err := json.Unmarshal(v, &parsed); err != nil {
			return nil, fmt.Errorf("decoding raw connector result: %w", err)
		}

		return parsed, nil
	case map[string]any:
		if err := unmarshalRawResults(v); err != nil {
			return nil, err
		}
	case []any:
		for i, item := range v {
			parsed, err := unmarshalRawValue(item)
			if err != nil {
				return nil, fmt.Errorf("index %d: %w", i, err)
			}

			v[i] = parsed
		}
	}

	return value, nil
}

// removePhantomFieldsFromPlan removes phantom fields from results based on
// the query plan's specs. This cleans up join columns that were injected
// for remote relationship resolution.
func removePhantomFieldsFromPlan(results map[string]any, plan *planner.QueryPlan) {
	if plan == nil {
		return
	}

	fieldsByPath := make(map[string]map[string]struct{})
	pathsByKey := make(map[string]jsonpath.Path)

	for _, pfs := range plan.AllPhantomFieldSpecs() {
		key := pfs.Path.String()

		pathsByKey[key] = pfs.Path
		if fieldsByPath[key] == nil {
			fieldsByPath[key] = make(map[string]struct{})
		}

		for _, field := range pfs.Fields {
			if alias, ok := pfs.Aliases[field]; ok {
				fieldsByPath[key][alias] = struct{}{}

				continue
			}

			fieldsByPath[key][field] = struct{}{}
		}
	}

	for key, fieldSet := range fieldsByPath {
		fields := make([]string, 0, len(fieldSet))
		for field := range fieldSet {
			fields = append(fields, field)
		}

		pathsByKey[key].Delete(results, fields...)
	}
}
