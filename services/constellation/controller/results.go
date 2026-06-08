package controller

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

// unmarshalRawResults converts any [jsontext.Value] entries in results to
// parsed Go types. SQL connectors return [jsontext.Value] to avoid
// double-marshaling in the common path; the controller materialises them
// before handing results to the resolver, which needs to traverse them.
func unmarshalRawResults(results map[string]any) error {
	for k, v := range results {
		if raw, ok := v.(jsontext.Value); ok && raw != nil {
			var parsed any
			if err := json.Unmarshal(raw, &parsed); err != nil {
				return fmt.Errorf("key %q: %w", k, err)
			}

			results[k] = parsed
		}
	}

	return nil
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
