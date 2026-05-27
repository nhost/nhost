// Package schemamerge combines multiple *graph.Schema values into a single
// validated GraphQL schema. It deduplicates scalars by name (first wins),
// deduplicates enums and inputs by structural equality and raises an error
// on differing duplicates, flattens Query/Mutation/Subscription root types
// onto query_root/mutation_root/subscription_root, and tracks per-connector
// ownership of fields and types.
//
// Field ownership is recorded in a single flat namespace shared across all
// three root operation kinds: if two connectors export root fields with the
// same name across different operation kinds (e.g. Query.users and
// Mutation.users), the later [MergeConnectorSchema] call overwrites the
// earlier connector's ownership entry. Callers must keep root-field names
// unique across Query/Mutation/Subscription.
package schemamerge

import (
	"fmt"
	"sync"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
)

// preludeDoc returns the parsed validator.Prelude.
//
//nolint:gochecknoglobals // sync.OnceValues requires a package-level binding
var preludeDoc = sync.OnceValues(func() (*ast.SchemaDocument, error) {
	return parser.ParseSchema(validator.Prelude)
})

// rootEntry ties a source schema's root type pointer to its combined-schema counterpart.
// sourceField and targetField are double pointers so the helper can both read the current
// value of the schema's Query/Mutation/Subscription field and write a new value through
// the same handle.
type rootEntry struct {
	sourceField      **string // &schema.{Query,Mutation,Subscription}Type
	defaultName      string   // "Query", "Mutation", "Subscription"
	targetField      **string // &combinedSchema.{Query,Mutation,Subscription}Type
	combinedTypeName string   // "query_root", "mutation_root", "subscription_root"
}

// defaultRoots returns the three standard rootEntry bindings tying schema's
// Query/Mutation/Subscription root pointers to combinedSchema's. The ordering
// (Query, Mutation, Subscription) is part of the contract: callers index into
// the returned slice positionally.
func defaultRoots(schema, combinedSchema *graph.Schema) []rootEntry {
	return []rootEntry{
		{
			sourceField:      &schema.QueryType,
			defaultName:      "Query",
			targetField:      &combinedSchema.QueryType,
			combinedTypeName: "query_root",
		},
		{
			sourceField:      &schema.MutationType,
			defaultName:      "Mutation",
			targetField:      &combinedSchema.MutationType,
			combinedTypeName: "mutation_root",
		},
		{
			sourceField:      &schema.SubscriptionType,
			defaultName:      "Subscription",
			targetField:      &combinedSchema.SubscriptionType,
			combinedTypeName: "subscription_root",
		},
	}
}

// MergeConnectorSchema merges a single connector's schema into the combined schema
// for a role.
//
// Both combinedSchema and schema are mutated in place: entries from schema.Types
// are moved into combinedSchema.Types (no deep copy), and a root type from schema
// may be renamed in place (e.g. "Query" -> "query_root") when its name differs
// from the combined-schema counterpart. Callers must not share a *graph.Schema
// across two MergeConnectorSchema calls -- the second call's assertions about
// source-root naming will silently fail because the first call already mutated
// the root type name.
//
// fieldToConnector and typeToConnector are populated with ownership information
// for the merged fields and types. fieldToConnector is a single flat namespace
// shared across all root operation kinds; see the package godoc. Returns an
// error if scalar/enum/input merging fails.
func MergeConnectorSchema(
	schema *graph.Schema,
	combinedSchema *graph.Schema,
	connectorName string,
	fieldToConnector map[string]string,
	typeToConnector map[string]string,
) error {
	roots := defaultRoots(schema, combinedSchema)

	rootTypes := separateRootTypes(schema, roots, combinedSchema, connectorName, typeToConnector)

	if err := mergeSchemaElements(combinedSchema, schema); err != nil {
		return err
	}

	for i, r := range roots {
		if *r.sourceField != nil && *r.targetField == nil {
			*r.targetField = new(r.combinedTypeName)
		}

		typeName := r.defaultName
		if *r.sourceField != nil {
			typeName = **r.sourceField
		}

		mergeRootType(
			rootTypes[i], typeName, *r.targetField,
			combinedSchema, connectorName, fieldToConnector,
		)
	}

	return nil
}

// separateRootTypes partitions schema types into root types (returned) and regular
// types (appended to combinedSchema), tracking connector ownership.
func separateRootTypes(
	schema *graph.Schema,
	roots []rootEntry,
	combinedSchema *graph.Schema,
	connectorName string,
	typeToConnector map[string]string,
) []*graph.ObjectType {
	rootTypeNames := make(map[string]int, len(roots))
	for i, r := range roots {
		name := r.defaultName
		if *r.sourceField != nil {
			name = **r.sourceField
		}

		rootTypeNames[name] = i
	}

	rootTypes := make([]*graph.ObjectType, len(roots))

	for _, typ := range schema.Types {
		if idx, isRoot := rootTypeNames[typ.Name]; isRoot {
			rootTypes[idx] = typ
		} else {
			combinedSchema.Types = append(combinedSchema.Types, typ)

			if typeToConnector != nil {
				typeToConnector[typ.Name] = connectorName
			}
		}
	}

	return rootTypes
}

// mergeSchemaElements merges scalars, enums, inputs, interfaces, unions, and
// directives from schema into combinedSchema. The caller
// (MergeConnectorSchema) wraps the returned error with the incoming
// connector's name so operators can identify the clashing party from the
// chain without re-instrumenting.
func mergeSchemaElements(combinedSchema, schema *graph.Schema) error {
	combinedSchema.Scalars = mergeScalars(combinedSchema.Scalars, schema.Scalars)

	var err error

	combinedSchema.Enums, err = mergeEnums(combinedSchema.Enums, schema.Enums)
	if err != nil {
		return err
	}

	combinedSchema.Inputs, err = mergeInputs(combinedSchema.Inputs, schema.Inputs)
	if err != nil {
		return err
	}

	combinedSchema.Interfaces = append(combinedSchema.Interfaces, schema.Interfaces...)
	combinedSchema.Unions = append(combinedSchema.Unions, schema.Unions...)
	combinedSchema.Directives = append(combinedSchema.Directives, schema.Directives...)

	return nil
}

// mergeRootType merges a root type (Query/Mutation/Subscription) into the combined schema.
// It tracks field ownership in fieldToConnector and handles type renaming if needed.
func mergeRootType(
	rootType *graph.ObjectType,
	typeName string,
	combinedTypeName *string,
	combinedSchema *graph.Schema,
	connectorName string,
	fieldToConnector map[string]string,
) {
	if rootType == nil {
		return
	}

	for _, field := range rootType.Fields {
		fieldToConnector[field.Name] = connectorName
	}

	targetTypeName := typeName
	if combinedTypeName != nil {
		targetTypeName = *combinedTypeName
	}

	for _, typ := range combinedSchema.Types {
		if typ.Name == targetTypeName {
			typ.Fields = append(typ.Fields, rootType.Fields...)
			if typ.Description == "" && rootType.Description != "" {
				typ.Description = rootType.Description
			}

			return
		}
	}

	if combinedTypeName != nil && rootType.Name != *combinedTypeName {
		rootType.Name = *combinedTypeName
	}

	combinedSchema.Types = append(combinedSchema.Types, rootType)
}

// BuildValidatedSchema converts a combined [graph.Schema] to an AST document
// and validates it. The returned [ast.SchemaDocument] is the prelude-prepended
// document fed to the validator, not the bare ToAST output of combinedSchema.
func BuildValidatedSchema(
	combinedSchema *graph.Schema,
	role string,
) (*ast.SchemaDocument, *ast.Schema, error) {
	userSchemaDoc := combinedSchema.ToAST()

	prelude, err := preludeDoc()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse prelude: %w", err)
	}

	defs := make([]*ast.Definition, 0, len(prelude.Definitions)+len(userSchemaDoc.Definitions))
	defs = append(defs, prelude.Definitions...)
	defs = append(defs, userSchemaDoc.Definitions...)

	dirs := make(
		[]*ast.DirectiveDefinition,
		0,
		len(prelude.Directives)+len(userSchemaDoc.Directives),
	)
	dirs = append(dirs, prelude.Directives...)
	dirs = append(dirs, userSchemaDoc.Directives...)

	schemaDoc := &ast.SchemaDocument{ //nolint:exhaustruct
		Definitions: defs,
		Directives:  dirs,
		Schema:      userSchemaDoc.Schema,
	}

	validatedSchema, err := validator.ValidateSchemaDocument(schemaDoc)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to validate schema for role %s: %w", role, err)
	}

	return schemaDoc, validatedSchema, nil
}

// mergeScalars merges two scalar slices, deduplicating by name.
func mergeScalars(existing, other []*graph.ScalarType) []*graph.ScalarType {
	seen := make(map[string]struct{})
	for _, s := range existing {
		seen[s.Name] = struct{}{}
	}

	for _, s := range other {
		if _, ok := seen[s.Name]; ok {
			continue
		}

		existing = append(existing, s)
		seen[s.Name] = struct{}{}
	}

	return existing
}

// mergeEnums merges two enum slices, deduplicating identical enums by name.
// Returns an error if two enums have the same name but different values; the
// caller (MergeConnectorSchema) wraps the error with the incoming
// connector's name so operators can find the offending side.
func mergeEnums(
	existing, other []*graph.EnumType,
) ([]*graph.EnumType, error) {
	seen := make(map[string]*graph.EnumType)
	for _, e := range existing {
		seen[e.Name] = e
	}

	for _, e := range other {
		if existingEnum, ok := seen[e.Name]; ok {
			if !enumsEqual(existingEnum, e) {
				return nil, fmt.Errorf(
					"%w: %q",
					ErrConflictingEnum, e.Name,
				)
			}

			continue
		}

		existing = append(existing, e)
		seen[e.Name] = e
	}

	return existing, nil
}

// enumsEqual checks if two enums have the same values (by name). Order-independent:
// {A,B} and {B,A} compare equal.
func enumsEqual(a, b *graph.EnumType) bool {
	if len(a.Values) != len(b.Values) {
		return false
	}

	valuesA := make(map[string]struct{})
	for _, v := range a.Values {
		valuesA[v.Name] = struct{}{}
	}

	for _, v := range b.Values {
		if _, ok := valuesA[v.Name]; !ok {
			return false
		}
	}

	return true
}

// mergeInputs merges two input slices. Identical duplicates (by structural equality
// via inputsEqual) are deduplicated; differing duplicates return an error so
// the caller gets a clear failure here instead of a downstream gqlparser
// validation error with less context. The caller (MergeConnectorSchema)
// wraps the error with the incoming connector's name so the chain is
// self-attributing.
func mergeInputs(
	existing, other []*graph.InputObjectType,
) ([]*graph.InputObjectType, error) {
	seen := make(map[string]*graph.InputObjectType)
	for _, i := range existing {
		seen[i.Name] = i
	}

	for _, i := range other {
		if existingInput, ok := seen[i.Name]; ok {
			if !inputsEqual(existingInput, i) {
				return nil, fmt.Errorf(
					"%w: %q",
					ErrConflictingInput, i.Name,
				)
			}

			continue
		}

		existing = append(existing, i)
		seen[i.Name] = i
	}

	return existing, nil
}

// inputsEqual checks if two inputs have the same fields (by name and type).
// Order-independent: fields are compared via a name->type map, so reordered
// fields compare equal.
func inputsEqual(a, b *graph.InputObjectType) bool {
	if len(a.Fields) != len(b.Fields) {
		return false
	}

	fieldsA := make(map[string]string)
	for _, f := range a.Fields {
		fieldsA[f.Name] = typeToString(f.Type)
	}

	for _, f := range b.Fields {
		if typeStr, ok := fieldsA[f.Name]; !ok || typeStr != typeToString(f.Type) {
			return false
		}
	}

	return true
}

// typeToString converts a graph.Type to a string representation for comparison.
func typeToString(t *graph.Type) string {
	if t == nil {
		return ""
	}

	var result string
	if t.Elem != nil {
		result = "[" + typeToString(t.Elem) + "]"
	} else {
		result = t.NamedType
	}

	if t.NonNull {
		result += "!"
	}

	return result
}
