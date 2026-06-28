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
	// relationshipLookup maps "TypeName.fieldName" -> relationship metadata
	relationshipLookup map[string]*RelationshipMetadata

	// schema is the validated schema for the current role
	schema *ast.Schema

	// sourceConnector is the connector being analyzed
	sourceConnector string

	// operationType is the type of operation being analyzed (Query, Mutation, Subscription)
	operationType ast.Operation

	// fragments are the fragment definitions from the query
	fragments ast.FragmentDefinitionList
}

// newAnalyzer creates a new analyzer for the given connector and role.
func newAnalyzer(
	sourceConnector string,
	schema *ast.Schema,
	relationships []*RelationshipMetadata,
	operationType ast.Operation,
	fragments ast.FragmentDefinitionList,
) *analyzer {
	lookup := make(map[string]*RelationshipMetadata)
	for _, rel := range relationships {
		key := rel.SourceType + "." + rel.Name
		lookup[key] = rel
	}

	return &analyzer{
		relationshipLookup: lookup,
		schema:             schema,
		sourceConnector:    sourceConnector,
		operationType:      operationType,
		fragments:          fragments,
	}
}

// analysisResult contains the results of analyzing a selection set.
type analysisResult struct {
	// PhantomFields that need to be injected
	PhantomFields []*PhantomFieldSpec

	// RemoteQueries detected
	RemoteQueries []*RemoteQueryPlan
}

// analyzeOperation analyzes a sub-operation for a connector.
func (a *analyzer) analyzeOperation(op *ast.OperationDefinition) *analysisResult {
	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
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

		a.analyzeField(field, typeName, path, result)
	}

	return result
}

// analyzeField recursively analyzes a field and its selection set.
func (a *analyzer) analyzeField(
	field *ast.Field,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
) {
	if field.SelectionSet == nil {
		return
	}

	// First pass: identify remote relationships and collect phantom field requirements
	neededPhantoms, phantomForRel := a.collectRemoteRelationships(field, typeName, path, result)

	// Process phantom fields if any are needed
	a.processPhantomFields(field, path, neededPhantoms, phantomForRel, result)

	// Second pass: recurse into non-relationship fields
	a.recurseIntoNestedFields(field, typeName, path, result)
}

// collectRemoteRelationships identifies remote relationship fields and builds query plans.
// Returns the set of needed phantom columns and the relationship name for the last one found.
func (a *analyzer) collectRemoteRelationships(
	field *ast.Field,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
) (map[string]struct{}, string) {
	return a.collectFromSelectionSet(field.SelectionSet, typeName, path, result)
}

// collectFromSelectionSet collects relationships from a selection set (used for fragments).
func (a *analyzer) collectFromSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
) (map[string]struct{}, string) {
	neededPhantoms := make(map[string]struct{})

	var phantomForRel string

	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			rel := a.getRelationship(typeName, s.Name)
			if rel == nil || !rel.IsRemote {
				continue
			}

			for sourceCol := range rel.JoinMapping {
				neededPhantoms[sourceCol] = struct{}{}
			}

			phantomForRel = rel.Name

			rqp := a.buildRemoteQueryPlan(s, rel, path)
			result.RemoteQueries = append(result.RemoteQueries, rqp)

		case *ast.FragmentSpread:
			fragTypeName := a.resolveFragmentTypeName(s.Name, typeName)
			if fragTypeName == "" {
				continue
			}

			frag := a.getFragment(s.Name)
			subPhantoms, subRel := a.collectFromSelectionSet(
				frag.SelectionSet, fragTypeName, path, result,
			)
			mergePhantomResults(neededPhantoms, subPhantoms, &phantomForRel, subRel)

		case *ast.InlineFragment:
			inlineTypeName := typeName
			if s.TypeCondition != "" {
				inlineTypeName = s.TypeCondition
			}

			subPhantoms, subRel := a.collectFromSelectionSet(
				s.SelectionSet, inlineTypeName, path, result,
			)
			mergePhantomResults(neededPhantoms, subPhantoms, &phantomForRel, subRel)
		}
	}

	return neededPhantoms, phantomForRel
}

// mergePhantomResults merges source phantom columns and relationship name into the destination.
func mergePhantomResults(dst, src map[string]struct{}, dstRel *string, srcRel string) {
	for col := range src {
		dst[col] = struct{}{}
	}

	if srcRel != "" {
		*dstRel = srcRel
	}
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
	path jsonpath.Path,
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
		SourceConnector:     a.sourceConnector,
		SourcePath:          path,
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
	field *ast.Field,
	path jsonpath.Path,
	neededPhantoms map[string]struct{},
	phantomForRel string,
	result *analysisResult,
) {
	if len(neededPhantoms) == 0 {
		return
	}

	// Check which fields are already available under their own response key.
	selectedFields := a.collectOwnResponseKeyFields(field)
	responseKeys := a.collectResponseKeys(field)

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
		Fields:          phantomFields,
		Aliases:         phantomAliases,
		ForRelationship: phantomForRel,
	}
	result.PhantomFields = append(result.PhantomFields, pfs)

	// Update the remote query plans with source phantom info
	pathStr := path.String()
	for _, rqp := range result.RemoteQueries {
		if rqp.SourcePath.String() == pathStr {
			rqp.SourcePhantomFields = pfs
		}
	}
}

// collectOwnResponseKeyFields returns fields selected with the same response
// key as their underlying field name. Only these fields make a join column
// available at parentRow[column] without an injected phantom.
func (a *analyzer) collectOwnResponseKeyFields(field *ast.Field) map[string]struct{} {
	selectedFields := make(map[string]struct{})
	a.collectOwnResponseKeyFieldsFromSelections(field.SelectionSet, selectedFields)

	return selectedFields
}

func (a *analyzer) collectOwnResponseKeyFieldsFromSelections(
	selections ast.SelectionSet,
	selectedFields map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			if s.Alias == "" || s.Alias == s.Name {
				selectedFields[s.Name] = struct{}{}
			}
		case *ast.FragmentSpread:
			if frag := a.fragments.ForName(s.Name); frag != nil {
				a.collectOwnResponseKeyFieldsFromSelections(frag.SelectionSet, selectedFields)
			}
		case *ast.InlineFragment:
			a.collectOwnResponseKeyFieldsFromSelections(s.SelectionSet, selectedFields)
		}
	}
}

// collectResponseKeys returns every response key in the field's selection set.
func (a *analyzer) collectResponseKeys(field *ast.Field) map[string]struct{} {
	responseKeys := make(map[string]struct{})
	a.collectResponseKeysFromSelections(field.SelectionSet, responseKeys)

	return responseKeys
}

func (a *analyzer) collectResponseKeysFromSelections(
	selections ast.SelectionSet,
	responseKeys map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			responseKeys[fieldResponseKey(s)] = struct{}{}
		case *ast.FragmentSpread:
			if frag := a.fragments.ForName(s.Name); frag != nil {
				a.collectResponseKeysFromSelections(frag.SelectionSet, responseKeys)
			}
		case *ast.InlineFragment:
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

// recurseIntoNestedFields recursively analyzes non-relationship fields.
func (a *analyzer) recurseIntoNestedFields(
	field *ast.Field,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
) {
	a.recurseIntoSelectionSet(field.SelectionSet, typeName, path, result)
}

// recurseIntoSelectionSet recursively analyzes a selection set (used for fragments).
func (a *analyzer) recurseIntoSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
	path jsonpath.Path,
	result *analysisResult,
) {
	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			rel := a.getRelationship(typeName, s.Name)
			if rel != nil && rel.IsRemote {
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
			a.analyzeField(s, subTypeName, subPath, result)

		case *ast.FragmentSpread:
			fragTypeName := a.resolveFragmentTypeName(s.Name, typeName)
			if fragTypeName == "" {
				continue
			}

			frag := a.getFragment(s.Name)
			a.recurseIntoSelectionSet(frag.SelectionSet, fragTypeName, path, result)

		case *ast.InlineFragment:
			inlineTypeName := typeName
			if s.TypeCondition != "" {
				inlineTypeName = s.TypeCondition
			}

			a.recurseIntoSelectionSet(s.SelectionSet, inlineTypeName, path, result)
		}
	}
}

// getRelationship looks up a relationship by type and field name.
func (a *analyzer) getRelationship(typeName, fieldName string) *RelationshipMetadata {
	key := typeName + "." + fieldName
	return a.relationshipLookup[key]
}

// getFieldReturnType gets the return type of a root query/mutation field.
func (a *analyzer) getFieldReturnType(field *ast.Field) string {
	return transform.FieldReturnType(a.schema, field.Name, a.operationType)
}

// getFieldReturnTypeOnType gets the return type of a field on a specific type.
func (a *analyzer) getFieldReturnTypeOnType(typeName, fieldName string) string {
	return transform.FieldReturnTypeOnType(a.schema, typeName, fieldName)
}
