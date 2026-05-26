package controller

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/controller/planner"
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

	seen := make(map[string]struct{})

	for _, pfs := range plan.AllPhantomFieldSpecs() {
		key := pfs.Path.String()
		if _, ok := seen[key]; ok {
			continue
		}

		seen[key] = struct{}{}

		pfs.Path.Delete(results, pfs.Fields...)
	}
}
