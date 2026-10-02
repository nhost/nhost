package openapi3

import (
	"maps"
	"slices"
	"strconv"
	"strings"
)

// WalkParametersFunc is called once for each parameter visited by
// WalkParameters.
//
// jsonPointer is the RFC 6901 JSON Pointer of the parameter within the
// document, e.g. "/components/parameters/Limit" or
// "/paths/~1pets/get/parameters/0". For a parameter referenced from several
// places it is the pointer of the first visit, and components are visited
// first, so a shared parameter is reported at its definition. param is
// non-nil and param.Value is non-nil; the callback may modify param.Value in
// place, so WalkParameters serves transformers and not only read-only
// inspection.
//
// Returning a non-nil error aborts the walk and is returned by
// WalkParameters.
type WalkParametersFunc func(jsonPointer string, param *ParameterRef) error

// WalkParameters visits every parameter reachable from the document exactly
// once, invoking fn for each. It follows resolved $ref targets (param.Value),
// so each distinct *Parameter is visited a single time regardless of how many
// references point at it. Maps are visited in sorted key order, so the
// traversal is deterministic.
//
// It covers components.parameters, path items, operations, callbacks, and
// webhooks. It is the parameter counterpart of WalkSchemas: useful for
// validation, linting, parameter transformation, and documentation, without
// re-deriving the (easy to get wrong) traversal.
func (doc *T) WalkParameters(fn WalkParametersFunc) error {
	if doc == nil {
		return nil
	}
	w := parameterWalker{fn: fn, seen: make(map[*Parameter]struct{})}
	return w.document(doc)
}

type parameterWalker struct {
	fn   WalkParametersFunc
	seen map[*Parameter]struct{}
}

func (w *parameterWalker) document(doc *T) error {
	if c := doc.Components; c != nil {
		for _, name := range slices.Sorted(maps.Keys(c.Parameters)) {
			if err := w.parameter("/components/parameters/"+escapeRefString(name), c.Parameters[name]); err != nil {
				return err
			}
		}
		for _, name := range slices.Sorted(maps.Keys(c.Callbacks)) {
			if cbr := c.Callbacks[name]; cbr != nil && cbr.Value != nil {
				if err := w.callback("/components/callbacks/"+escapeRefString(name), cbr.Value); err != nil {
					return err
				}
			}
		}
	}
	if doc.Paths != nil {
		items := doc.Paths.Map()
		for _, path := range slices.Sorted(maps.Keys(items)) {
			if err := w.pathItem("/paths/"+escapeRefString(path), items[path]); err != nil {
				return err
			}
		}
	}
	for _, name := range slices.Sorted(maps.Keys(doc.Webhooks)) {
		if err := w.pathItem("/webhooks/"+escapeRefString(name), doc.Webhooks[name]); err != nil {
			return err
		}
	}
	return nil
}

func (w *parameterWalker) pathItem(ptr string, item *PathItem) error {
	if item == nil {
		return nil
	}
	for i, pr := range item.Parameters {
		if err := w.parameter(ptr+"/parameters/"+strconv.Itoa(i), pr); err != nil {
			return err
		}
	}
	ops := item.Operations()
	for _, method := range slices.Sorted(maps.Keys(ops)) {
		op := ops[method]
		opPtr := ptr + "/" + strings.ToLower(method)
		for i, pr := range op.Parameters {
			if err := w.parameter(opPtr+"/parameters/"+strconv.Itoa(i), pr); err != nil {
				return err
			}
		}
		for _, name := range slices.Sorted(maps.Keys(op.Callbacks)) {
			if cbr := op.Callbacks[name]; cbr != nil && cbr.Value != nil {
				if err := w.callback(opPtr+"/callbacks/"+escapeRefString(name), cbr.Value); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (w *parameterWalker) callback(ptr string, cb *Callback) error {
	items := cb.Map()
	for _, expr := range slices.Sorted(maps.Keys(items)) {
		if err := w.pathItem(ptr+"/"+escapeRefString(expr), items[expr]); err != nil {
			return err
		}
	}
	return nil
}

func (w *parameterWalker) parameter(ptr string, pr *ParameterRef) error {
	if pr == nil || pr.Value == nil {
		return nil
	}
	if _, ok := w.seen[pr.Value]; ok {
		return nil
	}
	w.seen[pr.Value] = struct{}{}
	return w.fn(ptr, pr)
}
