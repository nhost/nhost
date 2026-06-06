// Package transform provides GraphQL AST transformations used by the planner
// to produce clean per-connector sub-operations.
//
// The transformations exposed here are independent of query planning: given a
// GraphQL operation, a schema, the set of remote relationship fields owned by
// the current connector, and a type-ownership map, [Transformer.Transform]
// strips relationship fields, filters cross-schema fragments, and removes
// fragment spreads that became empty after stripping. [InjectPhantomFields]
// mutates a clean operation in place to add join-key fields needed by the
// resolver, and [BuildSubOperation] splits a multi-connector operation into
// a per-connector sub-operation containing only the requested selections.
package transform

import (
	"slices"

	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// RemoteRelationship is the minimal descriptor [Transformer] needs to decide
// whether a field is a remote relationship that should be stripped from the
// clean operation. Callers (the planner) populate this from their richer
// metadata type and pass only the remote entries.
type RemoteRelationship struct {
	// SourceType is the GraphQL type that owns the relationship field.
	SourceType string

	// Name is the field name on SourceType.
	Name string
}

// PhantomSpec describes phantom fields to inject at a specific path. It is the
// minimal shape [InjectPhantomFields] requires; the planner builds richer
// per-relationship specs and adapts them at the call site.
type PhantomSpec struct {
	// Path is where the phantom fields should be added (e.g. "users.profile").
	Path jsonpath.Path

	// Fields are the field names to add (e.g. ["user_id", "department_id"]).
	Fields []string

	// Aliases maps field names to the internal response key to use when
	// injecting a phantom field. An absent entry means no alias is needed.
	Aliases map[string]string
}

// Transformer transforms GraphQL operations to strip relationship fields
// and process fragments for clean execution against a single connector.
type Transformer struct {
	// relationshipLookup maps "TypeName.fieldName" -> struct{} for fast
	// remote-relationship membership tests.
	relationshipLookup map[string]struct{}

	// schema is the validated schema for the current role.
	schema *ast.Schema

	// connectorName is the name of the connector this transformer is for.
	connectorName string

	// typeToConnectors maps type name -> connector names.
	typeToConnectors map[string][]string

	// emptyFragments tracks fragments that became empty after processing.
	emptyFragments map[string]struct{}
}

// NewTransformer creates a new Transformer.
//
// remotes must contain only the relationships that cross connector boundaries
// for the current connector; the caller is responsible for filtering.
func NewTransformer(
	schema *ast.Schema,
	remotes []RemoteRelationship,
	connectorName string,
	typeToConnectors map[string][]string,
) *Transformer {
	lookup := make(map[string]struct{}, len(remotes))
	for _, rel := range remotes {
		key := rel.SourceType + "." + rel.Name
		lookup[key] = struct{}{}
	}

	return &Transformer{
		relationshipLookup: lookup,
		schema:             schema,
		connectorName:      connectorName,
		typeToConnectors:   typeToConnectors,
		emptyFragments:     make(map[string]struct{}),
	}
}

// Result contains the output of [Transformer.Transform].
type Result struct {
	// CleanOperation has relationship fields stripped.
	CleanOperation *ast.OperationDefinition

	// CleanFragments has relationship fields stripped and cross-schema
	// fragments filtered.
	CleanFragments ast.FragmentDefinitionList
}

// Transform processes an operation and fragments to produce clean versions
// with relationship fields stripped.
func (t *Transformer) Transform(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) *Result {
	if len(t.relationshipLookup) == 0 {
		return &Result{
			CleanOperation: operation,
			CleanFragments: fragments,
		}
	}

	// Process fragments FIRST to identify which ones become empty or are filtered out.
	// This must happen before processing the operation so we can remove spreads for empty fragments.
	cleanFragments := t.processFragments(fragments)

	cleanOp := t.stripRelationshipFields(operation)

	return &Result{
		CleanOperation: cleanOp,
		CleanFragments: cleanFragments,
	}
}

// stripRelationshipFields removes relationship fields from an operation.
// Returns a modified copy of the operation (the original is not modified).
func (t *Transformer) stripRelationshipFields(
	op *ast.OperationDefinition,
) *ast.OperationDefinition {
	if len(t.relationshipLookup) == 0 {
		return op
	}

	newSelections := make(ast.SelectionSet, 0, len(op.SelectionSet))

	for _, sel := range op.SelectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			newSelections = append(newSelections, sel)

			continue
		}

		returnType := FieldReturnType(t.schema, field.Name, op.Operation)
		if returnType == "" {
			newSelections = append(newSelections, sel)

			continue
		}

		newField := t.processField(field, returnType)
		newSelections = append(newSelections, newField)
	}

	return &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:           op.Operation,
		Name:                op.Name,
		VariableDefinitions: op.VariableDefinitions,
		Directives:          op.Directives,
		SelectionSet:        newSelections,
		Position:            op.Position,
	}
}

// processFragments processes fragment definitions to strip relationship fields.
// Returns modified fragments with relationship fields removed.
// Fragments whose type condition doesn't exist in the schema are filtered out.
// Fragments that become empty after stripping are also filtered out and tracked.
func (t *Transformer) processFragments(
	fragments ast.FragmentDefinitionList,
) ast.FragmentDefinitionList {
	if len(fragments) == 0 {
		return fragments
	}

	if len(t.relationshipLookup) == 0 {
		return fragments
	}

	t.emptyFragments = make(map[string]struct{})

	var newFragments ast.FragmentDefinitionList

	for _, frag := range fragments {
		if !t.typeExistsInSchema(frag.TypeCondition) {
			// Fragment is for a type not owned by this connector. Track it as
			// "empty" so spreads are removed from operations.
			t.emptyFragments[frag.Name] = struct{}{}
			continue
		}

		processed := t.processFragment(frag)

		if len(processed.SelectionSet) == 0 {
			t.emptyFragments[frag.Name] = struct{}{}
			continue
		}

		newFragments = append(newFragments, processed)
	}

	return newFragments
}

// processField processes a field to strip relationship fields from its selection set.
func (t *Transformer) processField(
	field *ast.Field,
	typeName string,
) *ast.Field {
	if field.SelectionSet == nil {
		return field
	}

	newSelections := make(ast.SelectionSet, 0, len(field.SelectionSet))

	for _, sel := range field.SelectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			if t.isRemoteRelationship(typeName, s.Name) {
				continue
			}

			subTypeName := FieldReturnTypeOnType(t.schema, typeName, s.Name)
			if subTypeName != "" && s.SelectionSet != nil {
				newField := t.processField(s, subTypeName)
				newSelections = append(newSelections, newField)
			} else {
				newSelections = append(newSelections, s)
			}

		case *ast.FragmentSpread:
			if _, empty := t.emptyFragments[s.Name]; empty {
				continue
			}

			newSelections = append(newSelections, s)

		case *ast.InlineFragment:
			inlineTypeName := typeName
			if s.TypeCondition != "" {
				inlineTypeName = s.TypeCondition
			}

			newInline := t.processInlineFragment(s, inlineTypeName)
			if len(newInline.SelectionSet) > 0 {
				newSelections = append(newSelections, newInline)
			}

		default:
			newSelections = append(newSelections, sel)
		}
	}

	return &ast.Field{ //nolint:exhaustruct
		Alias:        field.Alias,
		Name:         field.Name,
		Arguments:    field.Arguments,
		Directives:   field.Directives,
		SelectionSet: newSelections,
		Position:     field.Position,
		Definition:   field.Definition,
	}
}

// processFragment processes a single fragment definition to strip relationship fields.
func (t *Transformer) processFragment(
	frag *ast.FragmentDefinition,
) *ast.FragmentDefinition {
	typeName := frag.TypeCondition

	newSelectionSet := t.processFragmentSelectionSet(frag.SelectionSet, typeName)

	return &ast.FragmentDefinition{ //nolint:exhaustruct
		Name:          frag.Name,
		TypeCondition: frag.TypeCondition,
		Directives:    frag.Directives,
		SelectionSet:  newSelectionSet,
		Definition:    frag.Definition,
		Position:      frag.Position,
	}
}

// processFragmentSelectionSet processes a selection set within a fragment.
func (t *Transformer) processFragmentSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
) ast.SelectionSet {
	if selectionSet == nil {
		return nil
	}

	newSelections := make(ast.SelectionSet, 0, len(selectionSet))

	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			if t.isRemoteRelationship(typeName, s.Name) {
				continue
			}

			if s.SelectionSet != nil {
				nestedTypeName := FieldReturnTypeOnType(t.schema, typeName, s.Name)

				newField := &ast.Field{ //nolint:exhaustruct
					Alias:        s.Alias,
					Name:         s.Name,
					Arguments:    s.Arguments,
					Directives:   s.Directives,
					SelectionSet: t.processFragmentSelectionSet(s.SelectionSet, nestedTypeName),
					Position:     s.Position,
					Definition:   s.Definition,
				}

				newSelections = append(newSelections, newField)
			} else {
				newSelections = append(newSelections, s)
			}

		case *ast.InlineFragment:
			inlineTypeName := typeName
			if s.TypeCondition != "" {
				inlineTypeName = s.TypeCondition
			}

			newInline := &ast.InlineFragment{ //nolint:exhaustruct
				TypeCondition:    s.TypeCondition,
				Directives:       s.Directives,
				SelectionSet:     t.processFragmentSelectionSet(s.SelectionSet, inlineTypeName),
				ObjectDefinition: s.ObjectDefinition,
				Position:         s.Position,
			}

			newSelections = append(newSelections, newInline)

		case *ast.FragmentSpread:
			newSelections = append(newSelections, s)
		}
	}

	return newSelections
}

// processInlineFragment processes an inline fragment to strip relationship fields.
func (t *Transformer) processInlineFragment(
	inline *ast.InlineFragment,
	typeName string,
) *ast.InlineFragment {
	newSelectionSet := t.processFragmentSelectionSet(inline.SelectionSet, typeName)

	return &ast.InlineFragment{ //nolint:exhaustruct
		TypeCondition:    inline.TypeCondition,
		Directives:       inline.Directives,
		SelectionSet:     newSelectionSet,
		ObjectDefinition: inline.ObjectDefinition,
		Position:         inline.Position,
	}
}

// isRemoteRelationship checks if a field is a remote relationship on the
// given type.
func (t *Transformer) isRemoteRelationship(typeName, fieldName string) bool {
	key := typeName + "." + fieldName
	_, ok := t.relationshipLookup[key]

	return ok
}

// typeExistsInSchema checks if a type name exists in the schema AND belongs to
// this connector. This ensures fragments for types from other connectors are
// filtered out.
func (t *Transformer) typeExistsInSchema(typeName string) bool {
	if t.schema == nil {
		return false
	}

	_, exists := t.schema.Types[typeName]
	if !exists {
		return false
	}

	if len(t.typeToConnectors) > 0 && t.connectorName != "" {
		owningConnectors, hasOwner := t.typeToConnectors[typeName]
		if hasOwner && !slices.Contains(owningConnectors, t.connectorName) {
			return false
		}
	}

	return true
}

// BuildSubOperation creates a sub-operation containing only the specified
// selections. It is used to split a multi-connector query into separate
// operations per connector while preserving the original operation's
// variables, directives, and identity.
func BuildSubOperation(
	op *ast.OperationDefinition,
	selections []ast.Selection,
) *ast.OperationDefinition {
	return &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:           op.Operation,
		Name:                op.Name,
		VariableDefinitions: op.VariableDefinitions,
		Directives:          op.Directives,
		SelectionSet:        selections,
		Position:            op.Position,
	}
}

// InjectPhantomFields mutates the operation in place to include phantom fields
// at the paths specified by the given specs.
// This should be called on a clean operation (which is already a clone),
// so no additional cloning is needed.
func InjectPhantomFields(operation *ast.OperationDefinition, specs []PhantomSpec) {
	if len(specs) == 0 {
		return
	}

	for _, spec := range specs {
		injectFieldsAtPath(operation.SelectionSet, []string(spec.Path), spec.Fields, spec.Aliases)
	}
}

// injectFieldsAtPath injects fields at the given path in the selection set.
// Path is like ["users", "profile"] meaning inject into users -> profile's selection.
func injectFieldsAtPath(
	ss ast.SelectionSet,
	path []string,
	fields []string,
	aliases map[string]string,
) {
	if len(path) == 0 || len(fields) == 0 {
		return
	}

	for _, sel := range ss {
		field, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		fieldName := field.Name
		if field.Alias != "" {
			fieldName = field.Alias
		}

		if fieldName != path[0] {
			continue
		}

		if len(path) == 1 {
			injectFieldsIntoSelectionSet(field, fields, aliases)

			return
		}

		if field.SelectionSet != nil {
			injectFieldsAtPath(field.SelectionSet, path[1:], fields, aliases)
		}

		return
	}
}

// injectFieldsIntoSelectionSet adds fields to a field's selection set if not already present.
func injectFieldsIntoSelectionSet(
	field *ast.Field,
	fieldNames []string,
	aliases map[string]string,
) {
	if field.SelectionSet == nil {
		field.SelectionSet = make(ast.SelectionSet, 0)
	}

	existing := make(map[string]struct{})
	for _, sel := range field.SelectionSet {
		if f, ok := sel.(*ast.Field); ok {
			existing[fieldResponseKey(f)] = struct{}{}
		}
	}

	for _, name := range fieldNames {
		responseKey := phantomResponseKey(name, aliases)
		if _, ok := existing[responseKey]; ok {
			continue
		}

		field.SelectionSet = append(field.SelectionSet, &ast.Field{ //nolint:exhaustruct
			Alias: aliases[name],
			Name:  name,
		})
		existing[responseKey] = struct{}{}
	}
}

func fieldResponseKey(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

func phantomResponseKey(fieldName string, aliases map[string]string) string {
	if alias := aliases[fieldName]; alias != "" {
		return alias
	}

	return fieldName
}
