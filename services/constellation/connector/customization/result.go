package customization

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"

	"github.com/vektah/gqlparser/v2/ast"
)

// ForwardResult reshapes a native connector response back into customized
// shape, guided by the customized operation that produced it. It re-nests the
// lifted root fields under their namespace field and rewrites every
// __typename value from the native type name to the customized one.
//
// op and fragments are the customized operation/fragments (as received by the
// decorator's Execute), and result is keyed by the response keys the connector
// returned — which match the customized response keys because ReverseOperation
// preserves them via aliases.
func (c *Customizer) ForwardResult(
	result map[string]any,
	op *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) map[string]any {
	if !c.enabled() || op == nil || result == nil {
		return result
	}

	w := &resultWalker{
		customizer:   c,
		fragments:    fragments,
		typenameMemo: make(map[*ast.Field]bool),
		remapsTypeNm: c.remapsTypeNames(),
	}

	return w.object(op.SelectionSet, result, true)
}

// resultWalker rebuilds a response map by walking the customized selection set
// alongside the native data.
type resultWalker struct {
	customizer *Customizer
	fragments  ast.FragmentDefinitionList
	// typenameMemo caches, per field, whether that field's selection subtree
	// selects __typename anywhere (so the raw-JSON fast path can be kept for
	// subtrees that don't, even when type renaming is enabled).
	typenameMemo map[*ast.Field]bool
	// remapsTypeNm caches the customizer's remapsTypeNames result for the
	// duration of one walk.
	remapsTypeNm bool
}

// object rebuilds one object level. root marks the top level, where namespace
// fields are unwrapped: their children read from the same data level (the
// connector returned them lifted), but are re-nested under the namespace key.
func (w *resultWalker) object(
	selections ast.SelectionSet,
	data map[string]any,
	root bool,
) map[string]any {
	out := make(map[string]any, len(data))
	w.collect(selections, data, root, out)

	return out
}

func (w *resultWalker) collect(
	selections ast.SelectionSet,
	data map[string]any,
	root bool,
	out map[string]any,
) {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			w.field(sel, data, root, out)
		case *ast.InlineFragment:
			w.collect(sel.SelectionSet, data, root, out)
		case *ast.FragmentSpread:
			if def := w.fragments.ForName(sel.Name); def != nil {
				w.collect(def.SelectionSet, data, root, out)
			}
		}
	}
}

func (w *resultWalker) field(
	field *ast.Field,
	data map[string]any,
	root bool,
	out map[string]any,
) {
	key := field.Alias
	if key == "" {
		key = field.Name
	}

	if root && field.Name == w.customizer.cfg.RootFieldsNamespace {
		// The namespace field's children were returned lifted to this level;
		// re-nest them under the namespace response key.
		out[key] = w.object(field.SelectionSet, data, false)

		return
	}

	value, ok := data[key]
	if !ok {
		return
	}

	if field.Name == "__typename" {
		if native, isStr := value.(string); isStr {
			out[key] = w.customizer.forwardTypeName(native)

			return
		}
	}

	if len(field.SelectionSet) > 0 {
		out[key] = w.value(field.SelectionSet, value, w.fieldSelectsTypename(field))

		return
	}

	out[key] = value
}

// value descends into a field's value, handling objects, (nested) lists, and
// raw-JSON values. SQL connectors return field results as raw jsontext.Value
// bytes; when type renaming is in effect and the subtree selects __typename
// those must be decoded so nested __typename values can be re-mapped, then they
// flow on as decoded structures (the controller marshals them normally).
//
// selectsTypename reports whether selections selects __typename anywhere in the
// subtree; it is threaded down so the raw-JSON fast path is preserved for
// subtrees that contain no __typename even under a type-renaming customization.
func (w *resultWalker) value(selections ast.SelectionSet, data any, selectsTypename bool) any {
	switch typed := data.(type) {
	case map[string]any:
		return w.object(selections, typed, false)
	case []any:
		rebuilt := make([]any, len(typed))
		for i, elem := range typed {
			rebuilt[i] = w.value(selections, elem, selectsTypename)
		}

		return rebuilt
	case jsontext.Value:
		return w.rawValue(selections, typed, selectsTypename)
	case []byte:
		return w.rawValue(selections, typed, selectsTypename)
	default:
		return data
	}
}

// rawValue decodes a raw-JSON value and walks it only when type renaming is in
// effect AND the subtree selects __typename; otherwise it leaves the bytes
// intact so the connector's efficient raw payload is preserved. The decode-and-
// rewalk path's only effect on data is re-mapping __typename string values, so
// skipping it when no __typename is selected is behaviour-preserving.
func (w *resultWalker) rawValue(selections ast.SelectionSet, raw []byte, selectsTypename bool) any {
	if !w.remapsTypeNm || !selectsTypename {
		return jsontext.Value(raw)
	}

	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return jsontext.Value(raw)
	}

	return w.value(selections, decoded, selectsTypename)
}

// fieldSelectsTypename reports whether field's selection subtree selects
// __typename anywhere, memoized per field so repeated list elements sharing the
// same selection set are evaluated once.
func (w *resultWalker) fieldSelectsTypename(field *ast.Field) bool {
	if cached, ok := w.typenameMemo[field]; ok {
		return cached
	}

	result := w.selectionsSelectTypename(field.SelectionSet)
	w.typenameMemo[field] = result

	return result
}

// selectionsSelectTypename reports whether selections selects __typename
// anywhere in the subtree, resolving inline fragments and fragment spreads.
func (w *resultWalker) selectionsSelectTypename(selections ast.SelectionSet) bool {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			if sel.Name == "__typename" {
				return true
			}

			if len(sel.SelectionSet) > 0 && w.fieldSelectsTypename(sel) {
				return true
			}
		case *ast.InlineFragment:
			if w.selectionsSelectTypename(sel.SelectionSet) {
				return true
			}
		case *ast.FragmentSpread:
			if def := w.fragments.ForName(sel.Name); def != nil &&
				w.selectionsSelectTypename(def.SelectionSet) {
				return true
			}
		}
	}

	return false
}

// remapsTypeNames reports whether the customization renames any type, which is
// what makes __typename re-mapping (and therefore decoding raw values)
// necessary. Namespacing alone does not rename types.
func (c *Customizer) remapsTypeNames() bool {
	return c.cfg.TypeNamesPrefix != "" ||
		c.cfg.TypeNamesSuffix != "" ||
		len(c.cfg.TypeNamesMapping) > 0
}

// forwardTypeName maps a native type name to its customized name, leaving
// unknown names untouched.
func (c *Customizer) forwardTypeName(name string) string {
	if customized, ok := c.typeForward[name]; ok {
		return customized
	}

	return name
}
