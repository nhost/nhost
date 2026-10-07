package customization

import (
	"slices"
	"strconv"
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
// back to native names). Distinct namespace response paths receive independent
// collision-checked native child aliases for database sources. Remote schemas
// keep unaliased, unmerged children so their validation rejects conflicts.
// Field-name reversal is applied for
// root-field prefix/suffix; per-type field_names reversal is not yet implemented
// (no configuration in use exercises it).
func (c *Customizer) ReverseOperation(
	op *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables ...map[string]any,
) (*ast.OperationDefinition, ast.FragmentDefinitionList) {
	if !c.enabled() || op == nil {
		return op, fragments
	}

	rebuilt := &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:           op.Operation,
		Name:                op.Name,
		VariableDefinitions: c.reverseVariableDefinitions(op.VariableDefinitions),
		Directives:          op.Directives,
		SelectionSet: c.reverseRootSelections(
			op.SelectionSet, fragments, c.namespaceLiftAliases(op, fragments), variables...),
		Position: op.Position,
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

// namespaceLiftAliases assigns private native response keys to each database
// namespace response path and child response key. Remote-schema errors carry
// native response paths, so their namespace forwarding stays unaliased.
// Candidates are checked against every client field name and alias: no
// user-reachable key can shadow a lifted field.
// An empty map preserves the historical native shape for one namespace key
// or any remote-schema namespace.
type namespaceLiftAliases map[string]map[string]string

func (a namespaceLiftAliases) key(namespace, child, fallback string) string {
	if key := a[namespace][child]; key != "" {
		return key
	}

	return fallback
}

func responseKey(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

func reserveClientResponseKeys(selections ast.SelectionSet, used map[string]bool) {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			used[sel.Name], used[responseKey(sel)] = true, true
			reserveClientResponseKeys(sel.SelectionSet, used)
		case *ast.InlineFragment:
			reserveClientResponseKeys(sel.SelectionSet, used)
		}
	}
}

func collectNamespaceChildren(
	selections ast.SelectionSet, namespace string,
	fragments ast.FragmentDefinitionList, children map[string][]string,
) {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			children[namespace] = append(children[namespace], responseKey(sel))
		case *ast.InlineFragment:
			collectNamespaceChildren(sel.SelectionSet, namespace, fragments, children)
		case *ast.FragmentSpread:
			if def := resolveFragment(sel, fragments); def != nil {
				collectNamespaceChildren(def.SelectionSet, namespace, fragments, children)
			}
		}
	}
}

func (c *Customizer) collectNamespaceRoots(
	selections ast.SelectionSet, fragments ast.FragmentDefinitionList,
	children map[string][]string,
) {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			if sel.Name == c.cfg.RootFieldsNamespace {
				collectNamespaceChildren(sel.SelectionSet, responseKey(sel), fragments, children)
			}
		case *ast.InlineFragment:
			c.collectNamespaceRoots(sel.SelectionSet, fragments, children)
		case *ast.FragmentSpread:
			if def := resolveFragment(sel, fragments); def != nil {
				c.collectNamespaceRoots(def.SelectionSet, fragments, children)
			}
		}
	}
}

func (c *Customizer) namespaceLiftAliases(
	op *ast.OperationDefinition, fragments ast.FragmentDefinitionList,
) namespaceLiftAliases {
	if op == nil || c.cfg.RootFieldsNamespace == "" || c.flavor != FlavorDatabase {
		return nil
	}

	used := make(map[string]bool)
	reserveClientResponseKeys(op.SelectionSet, used)

	for _, def := range fragments {
		reserveClientResponseKeys(def.SelectionSet, used)
	}

	children := make(map[string][]string)
	c.collectNamespaceRoots(op.SelectionSet, fragments, children)

	const distinctNamespaceKeys = 2
	if len(children) < distinctNamespaceKeys {
		return nil
	}

	aliases := make(namespaceLiftAliases, len(children))

	namespaces := make([]string, 0, len(children))
	for namespace := range children {
		namespaces = append(namespaces, namespace)
	}

	slices.Sort(namespaces)

	index := 0
	for _, namespace := range namespaces {
		keys := children[namespace]

		aliases[namespace] = make(map[string]string, len(keys))
		for _, child := range keys {
			if aliases[namespace][child] != "" {
				continue
			}

			for {
				candidate := "_constellation_ns_" + strconv.Itoa(index)
				index++

				if !used[candidate] {
					used[candidate] = true
					aliases[namespace][child] = candidate

					break
				}
			}
		}
	}

	return aliases
}

const argumentPathSelectionSet = ".selectionSet."

// ForwardArgumentPath maps an argument-path suffix stamped while validating a
// reversed native operation back onto the original client-facing operation.
// QueryValidationError stores paths without the leading "$.selectionSet" and
// trailing ".args" (for example, "teams.selectionSet.players"). Reversing a
// namespaced operation lifts the namespace wrapper before validation. Restore
// field names, not response aliases, matching Hasura's validation paths even
// when multiple namespace occurrences make the field-name path ambiguous.
func (c *Customizer) ForwardArgumentPath(
	nativePath string,
	op *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) string {
	if !c.enabled() || op == nil || nativePath == "" {
		return nativePath
	}

	root, rest := splitArgumentPathRoot(nativePath)
	forwarder := argumentPathForwarder{
		customizer: c,
		fragments:  fragments,
		nativeRoot: root,
		nativeRest: rest,
	}

	if c.cfg.RootFieldsNamespace == "" {
		if mapped := forwarder.clientRoots(op.SelectionSet, ""); mapped != "" {
			return mapped
		}
	} else if mapped := forwarder.rootSelections(op.SelectionSet); mapped != "" {
		return mapped
	}

	return nativePath
}

type argumentPathForwarder struct {
	customizer *Customizer
	fragments  ast.FragmentDefinitionList
	nativeRoot string
	nativeRest string
}

func splitArgumentPathRoot(path string) (string, string) {
	root, rest, ok := strings.Cut(path, argumentPathSelectionSet)
	if !ok {
		return path, ""
	}

	return root, argumentPathSelectionSet + rest
}

func (f argumentPathForwarder) clientRoots(
	selections ast.SelectionSet, prefix string,
) string {
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			if f.customizer.reverseRootFieldName(sel) == f.nativeRoot {
				return prefix + sel.Name + f.nativeRest
			}
		case *ast.InlineFragment:
			if mapped := f.clientRoots(sel.SelectionSet, prefix); mapped != "" {
				return mapped
			}
		case *ast.FragmentSpread:
			if def := resolveFragment(sel, f.fragments); def != nil {
				if mapped := f.clientRoots(def.SelectionSet, prefix); mapped != "" {
					return mapped
				}
			}
		}
	}

	return ""
}

func (f argumentPathForwarder) rootSelections(selections ast.SelectionSet) string {
	for _, selection := range selections {
		if mapped := f.rootSelection(selection); mapped != "" {
			return mapped
		}
	}

	return ""
}

func (f argumentPathForwarder) rootSelection(selection ast.Selection) string {
	switch sel := selection.(type) {
	case *ast.Field:
		if sel.Name != f.customizer.cfg.RootFieldsNamespace {
			return ""
		}

		return f.clientRoots(sel.SelectionSet, sel.Name+argumentPathSelectionSet)
	case *ast.InlineFragment:
		return f.rootSelections(sel.SelectionSet)
	case *ast.FragmentSpread:
		if def := resolveFragment(sel, f.fragments); def != nil {
			return f.rootSelections(def.SelectionSet)
		}
	}

	return ""
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
	aliases namespaceLiftAliases,
	variables ...map[string]any,
) ast.SelectionSet {
	if c.cfg.RootFieldsNamespace == "" {
		return c.reverseSelections(selections, true)
	}

	var lifted ast.SelectionSet

	for _, selection := range selections {
		lifted = append(lifted, c.liftRootSelection(selection, fragments, aliases, variables...)...)
	}

	if c.flavor != FlavorDatabase {
		return lifted
	}

	// The SQL root executor keeps one value per response key. GraphQL permits
	// compatible repeated fields, including those selected by wrapper spreads;
	// combine their selections before the inner connector sees them.
	merged := make(ast.SelectionSet, 0, len(lifted))

	byKey := make(map[string]*ast.Field)
	for _, selection := range lifted {
		field, ok := selection.(*ast.Field)
		if !ok {
			merged = append(merged, selection)

			continue
		}

		key := responseKey(field)
		if prior := byKey[key]; prior != nil && prior.Name == field.Name {
			prior.SelectionSet = append(prior.SelectionSet, field.SelectionSet...)

			continue
		}

		byKey[key] = field
		merged = append(merged, field)
	}

	return merged
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
	aliases namespaceLiftAliases,
	variables ...map[string]any,
) ast.SelectionSet {
	switch sel := selection.(type) {
	case *ast.Field:
		if sel.Name == c.cfg.RootFieldsNamespace {
			// The namespace field's children are the real root fields once
			// lifted, so reverse them as root fields.
			selections := sel.SelectionSet
			if c.flavor == FlavorDatabase {
				selections = c.liftWrapperFragments(selections, fragments, variables...)
			}

			children := c.reverseSelections(selections, true)
			for _, child := range children {
				if field, ok := child.(*ast.Field); ok {
					if alias := aliases.key(responseKey(sel), responseKey(field), ""); alias != "" {
						field.Alias = alias
					}
				}
			}

			return children
		}

		return ast.SelectionSet{c.reverseSelection(sel, true)}
	case *ast.InlineFragment:
		if !c.selectionsContainNamespace(sel.SelectionSet, fragments) {
			return ast.SelectionSet{c.reverseSelection(sel, true)}
		}

		if !includeWrapperSelection(sel.Directives, variables) {
			return nil
		}

		return c.liftRootSelections(sel.SelectionSet, fragments, aliases, variables...)
	case *ast.FragmentSpread:
		if !includeWrapperSelection(sel.Directives, variables) {
			return nil
		}

		def := resolveFragment(sel, fragments)
		if def == nil || !c.selectionsContainNamespace(def.SelectionSet, fragments) {
			return ast.SelectionSet{c.reverseSelection(selection, true)}
		}

		return c.liftRootSelections(def.SelectionSet, fragments, aliases, variables...)
	default:
		return ast.SelectionSet{c.reverseSelection(selection, true)}
	}
}

// liftWrapperFragments expands wrapper fragments to root fields: native SQL
// execution only visits root fields, not spreads or inline fragments. Spread
// directives are evaluated against the same coerced variables as planning.
func (c *Customizer) liftWrapperFragments(
	selections ast.SelectionSet, fragments ast.FragmentDefinitionList,
	variables ...map[string]any,
) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(selections))
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.FragmentSpread:
			frag := resolveFragment(sel, fragments)
			if frag != nil {
				if _, wrapper := c.wrapperTypes[frag.TypeCondition]; wrapper {
					if includeWrapperSelection(sel.Directives, variables) {
						out = append(
							out,
							c.liftWrapperFragments(frag.SelectionSet, fragments, variables...)...)
					}

					continue
				}
			}

			out = append(out, selection)
		case *ast.InlineFragment:
			if _, wrapper := c.wrapperTypes[sel.TypeCondition]; wrapper || sel.TypeCondition == "" {
				if includeWrapperSelection(sel.Directives, variables) {
					out = append(
						out,
						c.liftWrapperFragments(sel.SelectionSet, fragments, variables...)...)
				}

				continue
			}

			out = append(out, selection)
		default:
			out = append(out, selection)
		}
	}

	return out
}

func includeWrapperSelection(directives ast.DirectiveList, variables []map[string]any) bool {
	var values map[string]any
	if len(variables) != 0 {
		values = variables[0]
	}

	for _, directive := range directives {
		if directive.Name != "skip" && directive.Name != "include" {
			continue
		}

		argument := directive.Arguments.ForName("if")
		if argument == nil || argument.Value == nil {
			continue
		}

		value, err := argument.Value.Value(values)
		if err != nil {
			continue // Validated operations have a Boolean condition.
		}

		condition, _ := value.(bool)
		if directive.Name == "skip" && condition || directive.Name == "include" && !condition {
			return false
		}
	}

	return true
}

// liftRootSelections lifts every selection in a (fragment) selection set,
// flattening the namespace field's children to the root.
func (c *Customizer) liftRootSelections(
	selections ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	aliases namespaceLiftAliases,
	variables ...map[string]any,
) ast.SelectionSet {
	lifted := make(ast.SelectionSet, 0, len(selections))
	for _, inner := range selections {
		lifted = append(lifted, c.liftRootSelection(inner, fragments, aliases, variables...)...)
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

// reverseTypeName maps customized type conditions back to native names. A
// wrapper fragment is rooted at the native operation type once its namespace
// is lifted; retaining the wrapper name would discard its fields at execution.
func (c *Customizer) reverseTypeName(name string) string {
	if native, ok := c.wrapperNativeTypes[name]; ok {
		return native
	}

	if native, ok := c.typeInverse[name]; ok {
		return native
	}

	return name
}
