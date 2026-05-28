package customization

import (
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
)

// ReverseOperation rewrites an operation (and its fragments) from customized
// names back into the connector's native schema, so the wrapped connector
// executes against the schema it actually introspected. It returns rebuilt AST
// nodes and never mutates the inputs (the planner shares them across
// connectors).
//
// Two things are undone: the namespace wrapper (each root namespace field is
// removed and its children lifted to the root) and type renaming (type
// conditions on fragments and named types in variable definitions are mapped
// back to native names). Field-name reversal is applied for the root-field
// prefix/suffix; per-type field_names reversal is not yet implemented (no
// configuration in use exercises it).
func (c *Customizer) ReverseOperation(
	op *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) (*ast.OperationDefinition, ast.FragmentDefinitionList) {
	if !c.enabled() || op == nil {
		return op, fragments
	}

	rebuilt := &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:           op.Operation,
		Name:                op.Name,
		VariableDefinitions: c.reverseVariableDefinitions(op.VariableDefinitions),
		Directives:          op.Directives,
		SelectionSet:        c.reverseRootSelections(op.SelectionSet, fragments),
		Position:            op.Position,
	}

	var rebuiltFragments ast.FragmentDefinitionList
	if len(fragments) > 0 {
		rebuiltFragments = make(ast.FragmentDefinitionList, len(fragments))
		for i, frag := range fragments {
			rebuiltFragments[i] = &ast.FragmentDefinition{ //nolint:exhaustruct
				Name:               frag.Name,
				VariableDefinition: frag.VariableDefinition,
				TypeCondition:      c.reverseTypeName(frag.TypeCondition),
				Directives:         frag.Directives,
				SelectionSet: c.reverseSelections(
					frag.SelectionSet,
					c.fragmentCarriesRootFields(frag.TypeCondition),
				),
				Definition: frag.Definition,
				Position:   frag.Position,
			}
		}
	}

	return rebuilt, rebuiltFragments
}

// reverseRootSelections lifts the children of each namespace field onto the
// root when a namespace is configured; otherwise it reverses the selections in
// place.
//
// Three root selection shapes carry the namespace field and are unwrapped:
//
//   - a top-level *ast.Field whose name is the namespace — its children are
//     reversed and lifted to the root;
//   - a root-level *ast.InlineFragment — its selection set is unwrapped
//     recursively, so a namespace field inside it is lifted;
//   - a root-level *ast.FragmentSpread — its referenced definition's selection
//     set is unwrapped recursively, so a namespace field inside the fragment is
//     lifted.
//
// The query/mutation path only ever passes top-level *ast.Field root selections
// (the planner and controller build the per-connector sub-operation's root
// selection set solely from fields: planner.groupFieldsByConnector and
// resolve.groupFieldsByConnector both skip non-field root selections). The
// subscription path, however, reverses the raw client operation
// (customized_subscription.go calls ReverseOperation on req.Operation, built in
// controller/websocket.go straight from the validated client query), so a
// `subscription { ...frag }` or `subscription { ... on T { league { ... } } }`
// does reach here with a root fragment — hence the fragment handling above.
//
// Fragment spreads are resolved against the supplied fragment definitions
// (mirroring how ForwardResult resolves them via fragments.ForName), falling
// back to the spread's own validated Definition. Any root selection that does
// not resolve to the namespace field is reversed in place without lifting.
func (c *Customizer) reverseRootSelections(
	selections ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) ast.SelectionSet {
	if c.cfg.RootFieldsNamespace == "" {
		return c.reverseSelections(selections, true)
	}

	var lifted ast.SelectionSet

	for _, selection := range selections {
		lifted = append(lifted, c.liftRootSelection(selection, fragments)...)
	}

	return lifted
}

// liftRootSelection reverses one root-level selection, lifting the children of
// the namespace field to the root. It recurses through inline fragments and
// fragment spreads so a namespace field nested inside a (possibly nested)
// root-level fragment is lifted exactly as a top-level namespace *ast.Field is.
// A fragment that does not contain the namespace field is reversed in place
// (preserving its type condition), and any other selection is reversed without
// lifting.
func (c *Customizer) liftRootSelection(
	selection ast.Selection,
	fragments ast.FragmentDefinitionList,
) ast.SelectionSet {
	switch sel := selection.(type) {
	case *ast.Field:
		if sel.Name == c.cfg.RootFieldsNamespace {
			// The namespace field's children are the real root fields once
			// lifted, so reverse them as root fields.
			return c.reverseSelections(sel.SelectionSet, true)
		}

		return ast.SelectionSet{c.reverseSelection(sel, true)}
	case *ast.InlineFragment:
		if !c.selectionsContainNamespace(sel.SelectionSet, fragments) {
			return ast.SelectionSet{c.reverseSelection(sel, true)}
		}

		return c.liftRootSelections(sel.SelectionSet, fragments)
	case *ast.FragmentSpread:
		def := resolveFragment(sel, fragments)
		if def == nil || !c.selectionsContainNamespace(def.SelectionSet, fragments) {
			return ast.SelectionSet{c.reverseSelection(selection, true)}
		}

		return c.liftRootSelections(def.SelectionSet, fragments)
	default:
		return ast.SelectionSet{c.reverseSelection(selection, true)}
	}
}

// liftRootSelections lifts every selection in a (fragment) selection set,
// flattening the namespace field's children to the root.
func (c *Customizer) liftRootSelections(
	selections ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) ast.SelectionSet {
	var lifted ast.SelectionSet
	for _, inner := range selections {
		lifted = append(lifted, c.liftRootSelection(inner, fragments)...)
	}

	return lifted
}

// selectionsContainNamespace reports whether selections select the namespace
// field anywhere, descending through inline fragments and fragment spreads so a
// namespace field nested in a (possibly nested) fragment is detected.
func (c *Customizer) selectionsContainNamespace(
	selections ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) bool {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			if sel.Name == c.cfg.RootFieldsNamespace {
				return true
			}
		case *ast.InlineFragment:
			if c.selectionsContainNamespace(sel.SelectionSet, fragments) {
				return true
			}
		case *ast.FragmentSpread:
			if def := resolveFragment(sel, fragments); def != nil &&
				c.selectionsContainNamespace(def.SelectionSet, fragments) {
				return true
			}
		}
	}

	return false
}

// resolveFragment finds the definition a spread references, preferring the
// supplied fragment list (the shape ReverseOperation receives) and falling back
// to the spread's own validated Definition.
func resolveFragment(
	spread *ast.FragmentSpread,
	fragments ast.FragmentDefinitionList,
) *ast.FragmentDefinition {
	if def := fragments.ForName(spread.Name); def != nil {
		return def
	}

	return spread.Definition
}

// reverseSelections reverses every selection in selections. isRoot reports
// whether these selections sit at the operation's root level (directly on a
// root operation type or the namespace wrapper, possibly via a root-level
// fragment) and so carry the root-field prefix/suffix. It is threaded down so
// that descending into a field's own selection set clears it: only genuine root
// fields get the affix stripped, nested fields whose names happen to collide
// with the affix are left untouched.
func (c *Customizer) reverseSelections(
	selections ast.SelectionSet,
	isRoot bool,
) ast.SelectionSet {
	if selections == nil {
		return nil
	}

	rebuilt := make(ast.SelectionSet, len(selections))
	for i, selection := range selections {
		rebuilt[i] = c.reverseSelection(selection, isRoot)
	}

	return rebuilt
}

func (c *Customizer) reverseSelection( //nolint:ireturn,nolintlint
	selection ast.Selection,
	isRoot bool,
) ast.Selection {
	switch sel := selection.(type) {
	case *ast.Field:
		nativeName := sel.Name
		if isRoot {
			nativeName = c.reverseRootFieldName(sel)
		}

		// Preserve the client's response key: if the name changed and no
		// explicit alias was given, alias the native field to the customized
		// name so the connector returns data under the key the caller expects
		// and ForwardResult needs no key remapping.
		alias := sel.Alias
		if alias == "" && nativeName != sel.Name {
			alias = sel.Name
		}

		return &ast.Field{ //nolint:exhaustruct
			Alias:            alias,
			Name:             nativeName,
			Arguments:        sel.Arguments,
			Directives:       sel.Directives,
			SelectionSet:     c.reverseSelections(sel.SelectionSet, false),
			Definition:       sel.Definition,
			ObjectDefinition: sel.ObjectDefinition,
			Position:         sel.Position,
		}
	case *ast.InlineFragment:
		// An inline fragment at the root level still selects root fields, so
		// the root signal flows through it unchanged.
		return &ast.InlineFragment{ //nolint:exhaustruct
			TypeCondition:    c.reverseTypeName(sel.TypeCondition),
			Directives:       sel.Directives,
			SelectionSet:     c.reverseSelections(sel.SelectionSet, isRoot),
			ObjectDefinition: sel.ObjectDefinition,
			Position:         sel.Position,
		}
	default:
		return selection
	}
}

// fragmentCarriesRootFields reports whether a fragment type condition names a
// type whose selections are root fields (and therefore carry the root-field
// prefix/suffix). Two type conditions qualify:
//
//   - a root operation type (`on Query`/`on Mutation`/`on Subscription`); and
//   - a namespace-wrapper type minted in rewriteRoots (e.g.
//     `on league_subscription`), whose fields are the affixed root fields
//     moved under the namespace. A client may write a named fragment on the
//     wrapper type and spread it inside the namespace field
//     (`subscription { league { ...frag } }`); its selections must be
//     affix-stripped exactly like a fragment on the root operation type.
//
// A fragment written on any other type does not carry root fields.
func (c *Customizer) fragmentCarriesRootFields(typeCondition string) bool {
	if isRootOperationType(typeCondition) {
		return true
	}

	_, isWrapper := c.wrapperTypes[typeCondition]

	return isWrapper
}

// isRootOperationType reports whether a fragment type condition names a root
// operation type, i.e. the fragment's own selections are root fields. A
// fragment written `on Query`/`on Mutation`/`on Subscription` carries root
// fields; one written on any other type does not.
func isRootOperationType(typeCondition string) bool {
	switch typeCondition {
	case "Query", "Mutation", "Subscription":
		return true
	default:
		return false
	}
}

// reverseRootFieldName strips the root-field prefix/suffix from a root field.
// Callers apply it only to genuine root-level fields (the lifted namespace
// children, the top-level selections, or the direct children of a root-level
// fragment); nested fields are reversed with the root signal cleared, so a
// nested field name that happens to collide with the affix is left untouched.
func (c *Customizer) reverseRootFieldName(field *ast.Field) string {
	if c.cfg.RootFieldsPrefix == "" && c.cfg.RootFieldsSuffix == "" {
		return field.Name
	}

	name := field.Name

	if c.cfg.RootFieldsPrefix != "" {
		trimmed, ok := strings.CutPrefix(name, c.cfg.RootFieldsPrefix)
		if !ok {
			return field.Name
		}

		name = trimmed
	}

	if c.cfg.RootFieldsSuffix != "" {
		trimmed, ok := strings.CutSuffix(name, c.cfg.RootFieldsSuffix)
		if !ok {
			return field.Name
		}

		name = trimmed
	}

	return name
}

func (c *Customizer) reverseVariableDefinitions(
	defs ast.VariableDefinitionList,
) ast.VariableDefinitionList {
	if len(defs) == 0 {
		return defs
	}

	rebuilt := make(ast.VariableDefinitionList, len(defs))
	for i, def := range defs {
		rebuilt[i] = &ast.VariableDefinition{ //nolint:exhaustruct
			Variable:     def.Variable,
			Type:         c.reverseASTType(def.Type),
			DefaultValue: def.DefaultValue,
			Directives:   def.Directives,
			Definition:   def.Definition,
			Used:         def.Used,
			Position:     def.Position,
		}
	}

	return rebuilt
}

// reverseASTType returns a copy of t with its base named type mapped back to
// the native name. List/non-null wrappers are preserved.
func (c *Customizer) reverseASTType(t *ast.Type) *ast.Type {
	if t == nil {
		return nil
	}

	rebuilt := &ast.Type{
		NamedType: t.NamedType,
		NonNull:   t.NonNull,
		Elem:      c.reverseASTType(t.Elem),
		Position:  t.Position,
	}

	if rebuilt.Elem == nil {
		rebuilt.NamedType = c.reverseTypeName(t.NamedType)
	}

	return rebuilt
}

// reverseTypeName maps a customized type name back to its native name, leaving
// unknown names (builtin scalars, namespace wrappers) untouched.
func (c *Customizer) reverseTypeName(name string) string {
	if native, ok := c.typeInverse[name]; ok {
		return native
	}

	return name
}
