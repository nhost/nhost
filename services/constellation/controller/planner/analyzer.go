package planner

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

const phantomAliasPrefix = "_constellation_phantom_"

// analyzer walks a GraphQL AST and detects remote relationships.
type analyzer struct {
	// relationshipLookup is scoped to the connector that owns each source type.
	relationshipLookup map[string]map[string]*RelationshipMetadata

	// schema is the validated schema for the current role
	schema *ast.Schema

	// sourceConnector is the connector being analyzed
	sourceConnector string

	// operationType is the type of operation being analyzed (Query, Mutation, Subscription)
	operationType ast.Operation

	// fragments are the fragment definitions from the query
	fragments ast.FragmentDefinitionList

	variables map[string]any
}

// newAnalyzer creates a new analyzer for the given connector and role.
func newAnalyzer(
	sourceConnector string,
	schema *ast.Schema,
	relationships []*RelationshipMetadata,
	operationType ast.Operation,
	fragments ast.FragmentDefinitionList,
) *analyzer {
	lookup := make(map[string]map[string]*RelationshipMetadata)

	lookup[sourceConnector] = make(map[string]*RelationshipMetadata)
	for _, rel := range relationships {
		// Metadata can retain relationships omitted from this role's composed
		// schema (notably computed keys without a select grant). Never plan a
		// phantom selection from metadata alone.
		if transform.FieldReturnTypeOnType(schema, rel.SourceType, rel.Name) == "" {
			continue
		}

		key := rel.SourceType + "." + rel.Name
		lookup[sourceConnector][key] = rel
	}

	return &analyzer{
		relationshipLookup: lookup,
		schema:             schema,
		sourceConnector:    sourceConnector,
		operationType:      operationType,
		fragments:          fragments,
		variables:          nil,
	}
}

// analysisResult contains the results of analyzing a selection set.
type analysisResult struct {
	// PhantomFields that need to be injected
	PhantomFields []*PhantomFieldSpec

	// RemoteQueries detected
	RemoteQueries []*RemoteQueryPlan

	sources     map[string]*sourceSelection
	sourceOrder []string
	occurrences map[string][]sourceOccurrence
}

type sourceSelection struct {
	path          jsonpath.Path
	sourceType    string
	needed        map[string]struct{}
	phantomForRel string
}

type sourceOccurrence struct {
	typeName   string
	selections ast.SelectionSet
}

// analyzeOperation analyzes a sub-operation for a connector.
func (a *analyzer) analyzeOperation(op *ast.OperationDefinition) *analysisResult {
	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
		sources:       make(map[string]*sourceSelection),
		sourceOrder:   nil,
		occurrences:   make(map[string][]sourceOccurrence),
	}

	for _, sel := range op.SelectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		typeName := a.getFieldReturnType(field)
		if typeName == "" {
			continue
		}

		fieldName := field.Name
		if field.Alias != "" {
			fieldName = field.Alias
		}

		path := jsonpath.Parse(fieldName)

		a.analyzeField(field, typeName, path, result, jsonpath.Path{field.Name})
	}

	a.finishPhantoms(result)

	return result
}

// finishPhantoms considers all occurrences at a response path before adding
// phantoms. A sibling's explicit field cannot be deleted as an internal key.
func (a *analyzer) finishPhantoms(result *analysisResult) {
	for _, key := range result.sourceOrder {
		source := result.sources[key]

		var selections, responseSelections ast.SelectionSet
		for _, occurrence := range result.occurrences[source.path.String()] {
			responseSelections = append(responseSelections, occurrence.selections...)
			if a.typesOverlap(occurrence.typeName, source.sourceType) {
				selections = append(selections, occurrence.selections...)
			}
		}

		a.processPhantomFields(
			selections, responseSelections, source.path, source.sourceType,
			source.needed, source.phantomForRel, result,
		)
	}
}

// analyzeField recursively analyzes a field and its selection set.
func (a *analyzer) analyzeField(
	field *ast.Field,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
	names ...jsonpath.Path,
) {
	if field.SelectionSet == nil {
		return
	}

	namePath := path
	if len(names) != 0 {
		namePath = names[0]
	}

	// First pass: identify remote relationships and collect phantom field requirements
	a.collectRemoteRelationships(
		field,
		typeName,
		path,
		namePath,
		result,
	)

	if result.occurrences == nil {
		result.occurrences = make(map[string][]sourceOccurrence)
	}

	result.occurrences[path.String()] = append(result.occurrences[path.String()], sourceOccurrence{
		typeName: typeName, selections: field.SelectionSet,
	})

	// Second pass: descend through local and remote selections alike. A remote
	// child's source rows are available after its parent has been stitched.
	a.recurseIntoNestedFields(field, typeName, path, namePath, result)
}

// collectRemoteRelationships records source-scoped phantom requirements and query plans.
func (a *analyzer) collectRemoteRelationships(
	field *ast.Field,
	typeName string,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	a.collectFromSelectionSet(field.SelectionSet, typeName, path, result, namePath)
}

// collectFromSelectionSet collects relationships from a selection set (used for fragments).
func (a *analyzer) collectFromSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
	names ...jsonpath.Path,
) {
	namePath := path
	if len(names) != 0 {
		namePath = names[0]
	}

	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			a.collectRemoteField(s, typeName, path, namePath, result)

		case *ast.FragmentSpread:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			fragTypeName := a.resolveFragmentTypeName(s.Name, typeName)
			if fragTypeName == "" {
				continue
			}

			frag := a.getFragment(s.Name)
			a.collectFromSelectionSet(frag.SelectionSet, fragTypeName, path, result, namePath)

		case *ast.InlineFragment:
			a.collectInlineFragment(s, typeName, path, namePath, result)
		}
	}
}

func (a *analyzer) collectInlineFragment(
	fragment *ast.InlineFragment,
	typeName string,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	if !includeSelection(fragment.Directives, a.variables) {
		return
	}

	if fragment.TypeCondition != "" {
		typeName = fragment.TypeCondition
	}

	a.collectFromSelectionSet(fragment.SelectionSet, typeName, path, result, namePath)
}

func (a *analyzer) collectRemoteField(
	field *ast.Field,
	typeName string,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	rel := a.getRelationship(typeName, field.Name, path, result)
	if rel == nil || !rel.IsRemote {
		return
	}

	a.recordRemoteSelection(field, rel, path, namePath, result)

	if result.sources == nil {
		result.sources = make(map[string]*sourceSelection)
	}

	key := path.String() + "\x00" + rel.SourceType

	source := result.sources[key]
	if source == nil {
		source = &sourceSelection{
			path: path, sourceType: rel.SourceType,
			needed: make(map[string]struct{}), phantomForRel: "",
		}
		result.sources[key] = source
		result.sourceOrder = append(result.sourceOrder, key)
	}

	for sourceCol := range rel.JoinMapping {
		source.needed[sourceCol] = struct{}{}
	}

	for _, sourceField := range rel.LHSFields {
		source.needed[sourceField] = struct{}{}
	}

	source.phantomForRel = rel.Name
}

// recordRemoteSelection coalesces compatible occurrences at one response path.
// The first field is copied so neither cached occurrence can be modified.
func (a *analyzer) recordRemoteSelection(
	field *ast.Field,
	rel *RelationshipMetadata,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	for _, plan := range result.RemoteQueries {
		if plan.SourcePath.String() != path.String() ||
			plan.OutputField != fieldResponseKey(field) ||
			plan.SourceConnector != a.connectorAtPath(path, result) ||
			plan.Name != rel.Name || plan.SourceType != rel.SourceType ||
			plan.TargetConnector != rel.TargetConnector {
			continue
		}

		copyField := *plan.Selection
		copyField.SelectionSet = append(
			append(ast.SelectionSet{}, plan.Selection.SelectionSet...), field.SelectionSet...,
		)
		plan.Selection = &copyField

		return
	}

	result.RemoteQueries = append(result.RemoteQueries,
		a.buildRemoteQueryPlan(field, rel, path, namePath, result))
}

// resolveFragmentTypeName looks up a fragment by name and returns its effective type name.
// Returns empty string if the fragment is not found.
func (a *analyzer) resolveFragmentTypeName(fragName, fallback string) string {
	frag := a.getFragment(fragName)
	if frag == nil {
		return ""
	}

	if frag.TypeCondition != "" {
		return frag.TypeCondition
	}

	return fallback
}

// getFragment looks up a fragment by name.
func (a *analyzer) getFragment(name string) *ast.FragmentDefinition {
	for _, frag := range a.fragments {
		if frag.Name == name {
			return frag
		}
	}

	return nil
}

// buildRemoteQueryPlan creates a RemoteQueryPlan for a remote relationship field.
func (a *analyzer) buildRemoteQueryPlan(
	subField *ast.Field,
	rel *RelationshipMetadata,
	path, namePath jsonpath.Path,
	result *analysisResult,
) *RemoteQueryPlan {
	outputField := subField.Name
	if subField.Alias != "" {
		outputField = subField.Alias
	}

	// Schema resolver is required for db→rs relationships (RemoteFieldPath set);
	// everything else (db→db, rs→db) uses the database resolver.
	resolverType := ResolverKindDatabase
	if len(rel.RemoteFieldPath) > 0 {
		resolverType = ResolverKindSchema
	}

	return &RemoteQueryPlan{
		Name:                rel.Name,
		SourceType:          rel.SourceType,
		SourceConnector:     a.connectorAtPath(path, result),
		SourcePath:          path,
		SourceNamePath:      namePath,
		TargetConnector:     rel.TargetConnector,
		TargetTable:         rel.TargetTable,
		TargetTableSchema:   rel.TargetTableSchema,
		JoinMapping:         rel.JoinMapping,
		IsArray:             rel.IsArray,
		IsArrayAggregate:    rel.IsArrayAggregate,
		OutputField:         outputField,
		Selection:           subField,
		SourcePhantomFields: nil,
		ResolverType:        resolverType,
		LHSFields:           rel.LHSFields,
		RemoteFieldPath:     rel.RemoteFieldPath,
	}
}

// processPhantomFields determines which phantom fields need to be added and records them.
func (a *analyzer) processPhantomFields(
	selections, responseSelections ast.SelectionSet,
	path jsonpath.Path,
	sourceType string,
	neededPhantoms map[string]struct{},
	phantomForRel string,
	result *analysisResult,
) {
	if len(neededPhantoms) == 0 {
		return
	}

	// Check which fields are already available under their own response key.
	selectedFields := make(map[string]struct{})
	a.collectOwnResponseKeyFieldsForType(selections, sourceType, selectedFields)

	responseKeys := make(map[string]struct{})
	a.collectResponseKeysFromSelections(responseSelections, responseKeys)

	// Determine which phantom fields need to be added
	var phantomFields []string

	phantomAliases := make(map[string]string)
	for col := range neededPhantoms {
		if _, ok := selectedFields[col]; ok {
			continue
		}

		phantomFields = append(phantomFields, col)
		if _, collides := responseKeys[col]; collides {
			phantomAliases[col] = makePhantomAlias(col, responseKeys)
		}
	}

	if len(phantomFields) == 0 {
		return
	}

	if len(phantomAliases) == 0 {
		phantomAliases = nil
	}

	// Record phantom field spec
	pfs := &PhantomFieldSpec{
		Path:            path,
		SourceType:      sourceType,
		Fields:          phantomFields,
		Aliases:         phantomAliases,
		ForRelationship: phantomForRel,
	}
	result.PhantomFields = append(result.PhantomFields, pfs)

	// Update the remote query plans with source phantom info
	pathStr := path.String()
	for _, rqp := range result.RemoteQueries {
		if rqp.SourcePath.String() == pathStr && rqp.SourceType == sourceType {
			rqp.SourcePhantomFields = pfs
		}
	}
}

// typesOverlap reports whether two selection types can contain the same object.
func (a *analyzer) typesOverlap(left, right string) bool {
	if left == right {
		return true
	}

	for _, possible := range a.schema.PossibleTypes[left] {
		if possible.Name == right {
			return true
		}

		for _, other := range a.schema.PossibleTypes[right] {
			if possible.Name == other.Name {
				return true
			}
		}
	}

	for _, possible := range a.schema.PossibleTypes[right] {
		if possible.Name == left {
			return true
		}
	}

	return false
}

func (a *analyzer) collectOwnResponseKeyFieldsForType(
	selections ast.SelectionSet,
	sourceType string,
	selectedFields map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			// A computed JSON path selection is not the full join value;
			// inject a separate unmodified phantom under an internal alias.
			if includeSelection(s.Directives, a.variables) && len(s.Arguments) == 0 &&
				(s.Alias == "" || s.Alias == s.Name) {
				selectedFields[s.Name] = struct{}{}
			}
		case *ast.FragmentSpread:
			if frag := a.fragments.ForName(s.Name); frag != nil &&
				includeSelection(s.Directives, a.variables) &&
				a.typesOverlap(frag.TypeCondition, sourceType) {
				a.collectOwnResponseKeyFieldsForType(frag.SelectionSet, sourceType, selectedFields)
			}
		case *ast.InlineFragment:
			if includeSelection(s.Directives, a.variables) &&
				(s.TypeCondition == "" || a.typesOverlap(s.TypeCondition, sourceType)) {
				a.collectOwnResponseKeyFieldsForType(s.SelectionSet, sourceType, selectedFields)
			}
		}
	}
}

func (a *analyzer) collectResponseKeysFromSelections(
	selections ast.SelectionSet,
	responseKeys map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			responseKeys[fieldResponseKey(s)] = struct{}{}
		case *ast.FragmentSpread:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			if frag := a.fragments.ForName(s.Name); frag != nil {
				a.collectResponseKeysFromSelections(frag.SelectionSet, responseKeys)
			}
		case *ast.InlineFragment:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			a.collectResponseKeysFromSelections(s.SelectionSet, responseKeys)
		}
	}
}

func makePhantomAlias(fieldName string, responseKeys map[string]struct{}) string {
	base := phantomAliasPrefix + sanitizePhantomAliasPart(fieldName)
	alias := base

	for i := 1; ; i++ {
		if _, exists := responseKeys[alias]; !exists {
			responseKeys[alias] = struct{}{}

			return alias
		}

		alias = fmt.Sprintf("%s_%d", base, i)
	}
}

func sanitizePhantomAliasPart(fieldName string) string {
	return strings.NewReplacer(".", "_", "-", "_").Replace(fieldName)
}

func fieldResponseKey(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

// recurseIntoNestedFields recursively analyzes fields, including remote results.
func (a *analyzer) recurseIntoNestedFields(
	field *ast.Field,
	typeName string,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	a.recurseIntoSelectionSet(field.SelectionSet, typeName, path, namePath, result)
}

// recurseIntoSelectionSet recursively analyzes a selection set (used for fragments).
func (a *analyzer) recurseIntoSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
	path, namePath jsonpath.Path,
	result *analysisResult,
) {
	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			subTypeName := a.getFieldReturnTypeOnType(typeName, s.Name)
			if subTypeName == "" || s.SelectionSet == nil {
				continue
			}

			subFieldName := s.Name
			if s.Alias != "" {
				subFieldName = s.Alias
			}

			subPath := path.Child(subFieldName)
			a.analyzeField(s, subTypeName, subPath, result, namePath.Child(s.Name))

		case *ast.FragmentSpread:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			fragTypeName := a.resolveFragmentTypeName(s.Name, typeName)
			if fragTypeName == "" {
				continue
			}

			frag := a.getFragment(s.Name)
			a.recurseIntoSelectionSet(frag.SelectionSet, fragTypeName, path, namePath, result)

		case *ast.InlineFragment:
			if !includeSelection(s.Directives, a.variables) {
				continue
			}

			inlineTypeName := typeName
			if s.TypeCondition != "" {
				inlineTypeName = s.TypeCondition
			}

			a.recurseIntoSelectionSet(s.SelectionSet, inlineTypeName, path, namePath, result)
		}
	}
}

// getRelationship looks up a relationship by type and field name.
func (a *analyzer) getRelationship(
	typeName, fieldName string, path jsonpath.Path, result *analysisResult,
) *RelationshipMetadata {
	return a.relationshipLookup[a.connectorAtPath(path, result)][typeName+"."+fieldName]
}

func (a *analyzer) connectorAtPath(path jsonpath.Path, result *analysisResult) string {
	connectorName := a.sourceConnector

	depth := 0
	if result != nil {
		for _, parent := range result.RemoteQueries {
			prefix := parent.SourcePath.Child(parent.OutputField)
			if len(prefix) <= len(path) && len(prefix) > depth && pathHasPrefix(path, prefix) {
				connectorName = parent.TargetConnector
				depth = len(prefix)
			}
		}
	}

	return connectorName
}

// getFieldReturnType gets the return type of a root query/mutation field.
func (a *analyzer) getFieldReturnType(field *ast.Field) string {
	return transform.FieldReturnType(a.schema, field.Name, a.operationType)
}

// getFieldReturnTypeOnType gets the return type of a field on a specific type.
func (a *analyzer) getFieldReturnTypeOnType(typeName, fieldName string) string {
	return transform.FieldReturnTypeOnType(a.schema, typeName, fieldName)
}
