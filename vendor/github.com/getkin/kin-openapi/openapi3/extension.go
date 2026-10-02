package openapi3

import (
	"context"
	"strings"
)

// validateExtensions reports any non-`x-` keys in the given extensions
// map that are not explicitly allowed by the validation context. The
// origin argument is attached to the resulting ExtraSiblingFieldsError
// so callers can pin the finding to the parent object that carries the
// unknown keys; pass nil when the parent has no Origin (the loader was
// run with IncludeOrigin = false, or the parent was constructed
// programmatically without an Origin set).
func validateExtensions(ctx context.Context, extensions map[string]any, origin *Origin) error { // FIXME: newtype + Validate(...)
	allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed

	var unknowns []string
	for _, k := range componentNames(extensions) {
		if strings.HasPrefix(k, "x-") {
			continue
		}
		if allowed != nil {
			if _, ok := allowed[k]; ok {
				continue
			}
		}
		unknowns = append(unknowns, k)
	}

	if len(unknowns) != 0 {
		return newExtraSiblingFields(unknowns, origin)
	}

	return nil
}
