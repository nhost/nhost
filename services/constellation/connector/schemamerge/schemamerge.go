// Package schemamerge combines multiple *graph.Schema values into a single
// validated GraphQL schema. It deduplicates scalars by name (first wins),
// deduplicates enums, inputs, object types, interfaces, unions, and directives
// by structural equality and raises an error on differing duplicates, flattens
// Query/Mutation/Subscription root types onto query_root/mutation_root/
// subscription_root, and tracks per-connector ownership of fields and types.
//
// Field ownership is keyed by operation kind and field name through [FieldKey],
// so same-named Query, Mutation, and Subscription root fields route
// independently. Duplicate fields within one root operation are still left to
// schema validation so same-root conflicts fail loudly.
package schemamerge

import (
	"fmt"
	"reflect"
	"slices"
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

// FieldKey is the routing-map key used by composers and consumers to look up
// root-field ownership. Encoding: <operation kind>.<field name>.
func FieldKey(op ast.Operation, fieldName string) string {
	return string(op) + "." + fieldName
}

// rootEntry ties a source schema's root type pointer to its combined-schema counterpart.
// sourceField and targetField are double pointers so the helper can both read the current
// value of the schema's Query/Mutation/Subscription field and write a new value through
// the same handle.
type rootEntry struct {
	sourceField      **string      // &schema.{Query,Mutation,Subscription}Type
	defaultName      string        // "Query", "Mutation", "Subscription"
	targetField      **string      // &combinedSchema.{Query,Mutation,Subscription}Type
	combinedTypeName string        // "query_root", "mutation_root", "subscription_root"
	opKind           ast.Operation // ast.Query, ast.Mutation, ast.Subscription
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
			opKind:           ast.Query,
		},
		{
			sourceField:      &schema.MutationType,
			defaultName:      "Mutation",
			targetField:      &combinedSchema.MutationType,
			combinedTypeName: "mutation_root",
			opKind:           ast.Mutation,
		},
		{
			sourceField:      &schema.SubscriptionType,
			defaultName:      "Subscription",
			targetField:      &combinedSchema.SubscriptionType,
			combinedTypeName: "subscription_root",
			opKind:           ast.Subscription,
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
// fieldToConnector and typeToConnectors are populated with ownership information
// for the merged fields and types. fieldToConnector is keyed by [FieldKey], so
// same-name fields under different operation kinds route independently. Returns
// an error if named schema element merging fails.
func MergeConnectorSchema(
	schema *graph.Schema,
	combinedSchema *graph.Schema,
	connectorName string,
	fieldToConnector map[string]string,
	typeToConnectors map[string][]string,
) error {
	roots := defaultRoots(schema, combinedSchema)

	rootTypes, err := separateRootTypes(
		schema,
		roots,
		combinedSchema,
		connectorName,
		typeToConnectors,
	)
	if err != nil {
		return err
	}

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
			rootTypes[i], typeName, *r.targetField, r.opKind,
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
	typeToConnectors map[string][]string,
) ([]*graph.ObjectType, error) {
	rootTypeNames := make(map[string]int, len(roots))
	for i, r := range roots {
		name := r.defaultName
		if *r.sourceField != nil {
			name = **r.sourceField
		}

		rootTypeNames[name] = i
	}

	rootTypes := make([]*graph.ObjectType, len(roots))

	combinedRootTypeNames := make(map[string]struct{}, len(roots))
	for _, r := range roots {
		combinedRootTypeNames[r.combinedTypeName] = struct{}{}
		if *r.targetField != nil {
			combinedRootTypeNames[**r.targetField] = struct{}{}
		}
	}

	seen := make(map[string]*graph.ObjectType)
	for _, typ := range combinedSchema.Types {
		if _, isRoot := combinedRootTypeNames[typ.Name]; isRoot {
			continue
		}

		seen[typ.Name] = typ
	}

	for _, typ := range schema.Types {
		idx, isRoot := rootTypeNames[typ.Name]
		if isRoot {
			rootTypes[idx] = typ

			continue
		}

		existing, ok := seen[typ.Name]
		if ok {
			if !objectsEqual(existing, typ) {
				return nil, fmt.Errorf("%w: %q", ErrConflictingObject, typ.Name)
			}

			addTypeOwner(typeToConnectors, typ.Name, connectorName)

			continue
		}

		combinedSchema.Types = append(combinedSchema.Types, typ)
		seen[typ.Name] = typ
		addTypeOwner(typeToConnectors, typ.Name, connectorName)
	}

	return rootTypes, nil
}

func addTypeOwner(typeToConnectors map[string][]string, typeName, connectorName string) {
	if typeToConnectors == nil {
		return
	}

	owners := typeToConnectors[typeName]
	if slices.Contains(owners, connectorName) {
		return
	}

	typeToConnectors[typeName] = append(owners, connectorName)
}

// mergeSchemaElements merges scalars, enums, inputs, interfaces, unions, and
// directives from schema into combinedSchema. Scalars deduplicate by first-wins;
// the other named elements deduplicate only when structurally identical. The caller
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

	combinedSchema.Interfaces, err = mergeInterfaces(
		combinedSchema.Interfaces,
		schema.Interfaces,
	)
	if err != nil {
		return err
	}

	combinedSchema.Unions, err = mergeUnions(combinedSchema.Unions, schema.Unions)
	if err != nil {
		return err
	}

	combinedSchema.Directives, err = mergeDirectives(
		combinedSchema.Directives,
		schema.Directives,
	)
	if err != nil {
		return err
	}

	return nil
}

// mergeRootType merges a root type (Query/Mutation/Subscription) into the combined schema.
// It tracks field ownership in fieldToConnector and handles type renaming if needed.
func mergeRootType(
	rootType *graph.ObjectType,
	typeName string,
	combinedTypeName *string,
	opKind ast.Operation,
	combinedSchema *graph.Schema,
	connectorName string,
	fieldToConnector map[string]string,
) {
	if rootType == nil {
		return
	}

	for _, field := range rootType.Fields {
		fieldToConnector[FieldKey(opKind, field.Name)] = connectorName
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

// mergeInterfaces merges two interface slices. Identical duplicates are
// deduplicated; differing duplicates return an error before gqlparser emits a
// lower-context redeclaration failure.
func mergeInterfaces(
	existing, other []*graph.InterfaceType,
) ([]*graph.InterfaceType, error) {
	seen := make(map[string]*graph.InterfaceType)
	for _, iface := range existing {
		seen[iface.Name] = iface
	}

	for _, iface := range other {
		existingInterface, ok := seen[iface.Name]
		if ok {
			if !interfacesEqual(existingInterface, iface) {
				return nil, fmt.Errorf("%w: %q", ErrConflictingInterface, iface.Name)
			}

			continue
		}

		existing = append(existing, iface)
		seen[iface.Name] = iface
	}

	return existing, nil
}

// mergeUnions merges two union slices. Identical duplicates are deduplicated;
// differing duplicates return an error before gqlparser emits a lower-context
// redeclaration failure.
func mergeUnions(existing, other []*graph.UnionType) ([]*graph.UnionType, error) {
	seen := make(map[string]*graph.UnionType)
	for _, union := range existing {
		seen[union.Name] = union
	}

	for _, union := range other {
		existingUnion, ok := seen[union.Name]
		if ok {
			if !unionsEqual(existingUnion, union) {
				return nil, fmt.Errorf("%w: %q", ErrConflictingUnion, union.Name)
			}

			continue
		}

		existing = append(existing, union)
		seen[union.Name] = union
	}

	return existing, nil
}

// mergeDirectives merges two directive definition slices. Identical duplicates
// are deduplicated; differing duplicates return an error before gqlparser emits
// a lower-context redeclaration failure.
func mergeDirectives(
	existing, other []*graph.DirectiveDefinition,
) ([]*graph.DirectiveDefinition, error) {
	seen := make(map[string]*graph.DirectiveDefinition)
	for _, directive := range existing {
		seen[directive.Name] = directive
	}

	for _, directive := range other {
		existingDirective, ok := seen[directive.Name]
		if ok {
			if !directivesEqual(existingDirective, directive) {
				return nil, fmt.Errorf("%w: %q", ErrConflictingDirective, directive.Name)
			}

			continue
		}

		existing = append(existing, directive)
		seen[directive.Name] = directive
	}

	return existing, nil
}

// objectsEqual checks if two object types have the same fields, implemented
// interfaces, and applied directives. Field and interface order does not
// matter.
func objectsEqual(a, b *graph.ObjectType) bool {
	return fieldsEqual(a.Fields, b.Fields) &&
		stringSetsEqual(a.Interfaces, b.Interfaces) &&
		appliedDirectivesEqual(a.Directives, b.Directives)
}

// interfacesEqual checks if two interfaces have the same fields, implemented
// interfaces, and applied directives. Field and interface order does not
// matter.
func interfacesEqual(a, b *graph.InterfaceType) bool {
	return fieldsEqual(a.Fields, b.Fields) &&
		stringSetsEqual(a.Interfaces, b.Interfaces) &&
		appliedDirectivesEqual(a.Directives, b.Directives)
}

// unionsEqual checks if two unions have the same members and applied directives.
// Member order does not matter.
func unionsEqual(a, b *graph.UnionType) bool {
	return stringSetsEqual(a.Types, b.Types) && appliedDirectivesEqual(a.Directives, b.Directives)
}

// directivesEqual checks if two directive definitions have the same
// repeatability, allowed locations, and argument signatures. Location and
// argument order does not matter.
func directivesEqual(a, b *graph.DirectiveDefinition) bool {
	return a.Repeatable == b.Repeatable &&
		directiveLocationSetsEqual(a.Locations, b.Locations) &&
		argumentsEqual(a.Arguments, b.Arguments)
}

func fieldsEqual(a, b []*graph.Field) bool {
	if len(a) != len(b) {
		return false
	}

	fieldsA := make(map[string]*graph.Field, len(a))
	for _, field := range a {
		fieldsA[field.Name] = field
	}

	for _, fieldB := range b {
		fieldA, ok := fieldsA[fieldB.Name]
		if !ok || typeToString(fieldA.Type) != typeToString(fieldB.Type) ||
			!argumentsEqual(fieldA.Arguments, fieldB.Arguments) ||
			!appliedDirectivesEqual(fieldA.Directives, fieldB.Directives) {
			return false
		}
	}

	return true
}

func argumentsEqual(a, b []*graph.Argument) bool {
	if len(a) != len(b) {
		return false
	}

	argsA := make(map[string]*graph.Argument, len(a))
	for _, arg := range a {
		argsA[arg.Name] = arg
	}

	for _, argB := range b {
		argA, ok := argsA[argB.Name]
		if !ok || typeToString(argA.Type) != typeToString(argB.Type) ||
			!stringPointersEqual(argA.DefaultValue, argB.DefaultValue) ||
			!appliedDirectivesEqual(argA.Directives, argB.Directives) {
			return false
		}
	}

	return true
}

func appliedDirectivesEqual(a, b []*graph.Directive) bool {
	if len(a) != len(b) {
		return false
	}

	used := make([]bool, len(b))
	for _, directiveA := range a {
		matched := false
		for i, directiveB := range b {
			if used[i] || !appliedDirectiveEqual(directiveA, directiveB) {
				continue
			}

			used[i] = true
			matched = true

			break
		}

		if !matched {
			return false
		}
	}

	return true
}

func appliedDirectiveEqual(a, b *graph.Directive) bool {
	return a.Name == b.Name && directiveArgumentsEqual(a.Arguments, b.Arguments)
}

func directiveArgumentsEqual(a, b []*graph.DirectiveArgument) bool {
	if len(a) != len(b) {
		return false
	}

	argsA := make(map[string]*graph.DirectiveArgument, len(a))
	for _, arg := range a {
		argsA[arg.Name] = arg
	}

	for _, argB := range b {
		argA, ok := argsA[argB.Name]
		if !ok || !reflect.DeepEqual(argA.Value, argB.Value) {
			return false
		}
	}

	return true
}

func stringSetsEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	seen := make(map[string]struct{}, len(a))
	for _, value := range a {
		seen[value] = struct{}{}
	}

	for _, value := range b {
		if _, ok := seen[value]; !ok {
			return false
		}
	}

	return true
}

func directiveLocationSetsEqual(a, b []graph.DirectiveLocation) bool {
	if len(a) != len(b) {
		return false
	}

	seen := make(map[graph.DirectiveLocation]struct{}, len(a))
	for _, value := range a {
		seen[value] = struct{}{}
	}

	for _, value := range b {
		if _, ok := seen[value]; !ok {
			return false
		}
	}

	return true
}

func stringPointersEqual(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}

	return *a == *b
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
