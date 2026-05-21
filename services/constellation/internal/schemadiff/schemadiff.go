// Package schemadiff provides utilities for parsing two GraphQL schemas,
// normalising away semantically meaningless differences, and rendering them as
// deterministic SDL for unified diffing. It is the engine behind the
// `constellation debug schema-diff` command.
//
// The exported functions form an ordered pipeline, and the order matters. The
// canonical sequence (see cmd/debug/schema_diff.go) is:
//
//  1. Load each schema from disk.
//  2. Normalise: NormalizeAggregateTypes, then StripNoopUpdateMutations,
//     StripBuiltinDirectives, and NormalizeFuncArgNullability. These mutate the
//     schema graph and must run before sorting, since they add and remove
//     fields and types.
//  3. SortFields, to make SDL output deterministic regardless of source order.
//  4. ToSDL, then diff the two SDL strings.
//  5. AddHunkContext, to annotate the resulting diff's hunk headers.
package schemadiff

import (
	"bytes"
	"cmp"
	"fmt"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

// Load reads a GraphQL schema file from disk and parses it into an *ast.Schema.
// Read failures are wrapped with the "reading schema file" prefix and parse
// failures with the "parsing schema file" prefix; both include the path.
func Load(path string) (*ast.Schema, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading schema file %s: %w", path, err)
	}

	schema, err := gqlparser.LoadSchema(&ast.Source{ //nolint:exhaustruct
		Name:  path,
		Input: string(content),
	})
	if err != nil {
		return nil, fmt.Errorf("parsing schema file %s: %w", path, err)
	}

	return schema, nil
}

// StripNoopUpdateMutations removes update mutations for tables where the role
// has no update column permissions (the _update_column enum only contains
// _PLACEHOLDER). Hasura still generates these mutations even though they can't
// update any columns; Constellation omits them entirely. Neither behavior is
// wrong, so we strip them to reduce diff noise.
func StripNoopUpdateMutations(schema *ast.Schema) {
	placeholderTables := make(map[string]struct{})

	for typeName, def := range schema.Types {
		if !strings.HasSuffix(typeName, "_update_column") || def.Kind != ast.Enum {
			continue
		}

		if len(def.EnumValues) == 1 && def.EnumValues[0].Name == "_PLACEHOLDER" {
			placeholderTables[strings.TrimSuffix(typeName, "_update_column")] = struct{}{}
		}
	}

	if len(placeholderTables) == 0 {
		return
	}

	if schema.Mutation != nil {
		var filtered ast.FieldList

		for _, field := range schema.Mutation.Fields {
			if isNoopUpdateMutation(field, placeholderTables) {
				continue
			}

			filtered = append(filtered, field)
		}

		schema.Mutation.Fields = filtered
	}

	for tableName := range placeholderTables {
		delete(schema.Types, tableName+"_pk_columns_input")
		delete(schema.PossibleTypes, tableName+"_pk_columns_input")
		delete(schema.Types, tableName+"_updates")
		delete(schema.PossibleTypes, tableName+"_updates")
	}
}

// unwrapTypeName returns the underlying named type of t, descending through
// any list wrappers. t must be non-nil: gqlparser's parser always populates
// FieldDefinition.Type (and the Elem of a list type) with a non-nil *ast.Type,
// and the only caller passes a field type read straight out of a parsed
// schema.
func unwrapTypeName(t *ast.Type) string {
	if t.NamedType != "" {
		return t.NamedType
	}

	return unwrapTypeName(t.Elem)
}

func isNoopUpdateMutation(
	field *ast.FieldDefinition,
	placeholderTables map[string]struct{},
) bool {
	if !strings.HasPrefix(field.Name, "update") {
		return false
	}

	tableName := strings.TrimSuffix(unwrapTypeName(field.Type), "_mutation_response")

	_, ok := placeholderTables[tableName]

	return ok
}

// NormalizeAggregateTypes intersects min/max aggregate fields across both
// schemas. Constellation discovers min/max support dynamically from the
// database while Hasura hardcodes it, so they may include different sets of
// fields. This function keeps only the fields present in both schemas (or
// strips them entirely if one schema lacks the type).
func NormalizeAggregateTypes(schemaA, schemaB *ast.Schema) {
	suffixes := []string{"_max_fields", "_min_fields", "_max_order_by", "_min_order_by"}

	typeNames := make(map[string]struct{})
	for typeName := range schemaA.Types {
		for _, s := range suffixes {
			if strings.HasSuffix(typeName, s) {
				typeNames[typeName] = struct{}{}
			}
		}
	}

	for typeName := range schemaB.Types {
		for _, s := range suffixes {
			if strings.HasSuffix(typeName, s) {
				typeNames[typeName] = struct{}{}
			}
		}
	}

	for typeName := range typeNames {
		defA, okA := schemaA.Types[typeName]
		defB, okB := schemaB.Types[typeName]

		if !okA || !okB {
			removeAggregateType(schemaA, typeName)
			removeAggregateType(schemaB, typeName)

			continue
		}

		commonFields := intersectFieldNames(defA.Fields, defB.Fields)
		defA.Fields = filterFields(defA.Fields, commonFields)
		defB.Fields = filterFields(defB.Fields, commonFields)

		if len(commonFields) == 0 {
			removeAggregateType(schemaA, typeName)
			removeAggregateType(schemaB, typeName)
		}
	}
}

func intersectFieldNames(a, b ast.FieldList) map[string]struct{} {
	namesA := make(map[string]struct{}, len(a))
	for _, f := range a {
		namesA[f.Name] = struct{}{}
	}

	common := make(map[string]struct{})
	for _, f := range b {
		if _, ok := namesA[f.Name]; ok {
			common[f.Name] = struct{}{}
		}
	}

	return common
}

func filterFields(fields ast.FieldList, keep map[string]struct{}) ast.FieldList {
	var filtered ast.FieldList
	for _, f := range fields {
		if _, ok := keep[f.Name]; ok {
			filtered = append(filtered, f)
		}
	}

	return filtered
}

func removeAggregateType(schema *ast.Schema, typeName string) {
	if _, ok := schema.Types[typeName]; !ok {
		return
	}

	delete(schema.Types, typeName)
	delete(schema.PossibleTypes, typeName)

	var aggTypeName, fieldName string

	switch {
	case strings.HasSuffix(typeName, "_max_fields"):
		aggTypeName = strings.TrimSuffix(typeName, "_max_fields") + "_aggregate_fields"
		fieldName = "max"
	case strings.HasSuffix(typeName, "_min_fields"):
		aggTypeName = strings.TrimSuffix(typeName, "_min_fields") + "_aggregate_fields"
		fieldName = "min"
	case strings.HasSuffix(typeName, "_max_order_by"):
		aggTypeName = strings.TrimSuffix(typeName, "_max_order_by") + "_aggregate_order_by"
		fieldName = "max"
	case strings.HasSuffix(typeName, "_min_order_by"):
		aggTypeName = strings.TrimSuffix(typeName, "_min_order_by") + "_aggregate_order_by"
		fieldName = "min"
	default:
		// Unreachable: the sole caller (NormalizeAggregateTypes) only ever
		// passes type names that matched one of the four suffixes above. The
		// guard is kept so the function fails closed (no rewire) rather than
		// dereferencing an empty aggTypeName if a future caller violates that.
		return
	}

	if aggDef, ok := schema.Types[aggTypeName]; ok {
		var filtered ast.FieldList
		for _, f := range aggDef.Fields {
			if f.Name != fieldName {
				filtered = append(filtered, f)
			}
		}

		aggDef.Fields = filtered
	}
}

// NormalizeFuncArgNullability makes all fields in _args input types nullable.
// Constellation marks function arguments without defaults as non-null while
// Hasura always makes them nullable. The difference is not semantically
// significant for diffing purposes.
func NormalizeFuncArgNullability(schema *ast.Schema) {
	for typeName, def := range schema.Types {
		if !strings.HasSuffix(typeName, "_args") || def.Kind != ast.InputObject {
			continue
		}

		for _, field := range def.Fields {
			if field.Type != nil {
				field.Type.NonNull = false
			}
		}
	}
}

// SortFields sorts fields, arguments, and enum values within all type
// definitions alphabetically by name, ensuring deterministic SDL output
// regardless of source ordering.
//
// The root operation types (schema.Query, schema.Mutation,
// schema.Subscription) need no separate pass: gqlparser stores every root
// operation as a pointer that also lives in schema.Types (it assigns the
// roots straight out of schema.Types when loading the schema), so the loop
// below already sorts them in place.
func SortFields(schema *ast.Schema) {
	for _, def := range schema.Types {
		slices.SortFunc(def.Fields, func(a, b *ast.FieldDefinition) int {
			return cmp.Compare(a.Name, b.Name)
		})

		for _, field := range def.Fields {
			slices.SortFunc(field.Arguments, func(a, b *ast.ArgumentDefinition) int {
				return cmp.Compare(a.Name, b.Name)
			})
		}

		slices.SortFunc(def.EnumValues, func(a, b *ast.EnumValueDefinition) int {
			return cmp.Compare(a.Name, b.Name)
		})
	}
}

// StripBuiltinDirectives removes standard GraphQL directives that may be
// declared differently (or not at all) between schemas but are not
// semantically meaningful differences. Only non-standard directives (like
// @cached) are kept.
func StripBuiltinDirectives(schema *ast.Schema) {
	builtins := map[string]struct{}{
		"skip":        {},
		"include":     {},
		"deprecated":  {},
		"specifiedBy": {},
		"defer":       {},
		"oneOf":       {},
		"cached":      {},
	}

	for name := range schema.Directives {
		if _, ok := builtins[name]; ok {
			delete(schema.Directives, name)
		}
	}
}

// ToSDL formats a schema as a GraphQL SDL string with sorted, deterministic
// output. When ignoreDescriptions is true, type/field descriptions are
// omitted.
func ToSDL(schema *ast.Schema, ignoreDescriptions bool) string {
	var buf bytes.Buffer

	opts := []formatter.FormatterOption{formatter.WithIndent("  ")}
	if ignoreDescriptions {
		opts = append(opts, formatter.WithoutDescription())
	}

	f := formatter.NewFormatter(&buf, opts...)
	f.FormatSchema(schema)

	return buf.String()
}

// hunkRe matches a unified-diff hunk header that has no trailing context after
// the closing "@@". The `@@$` anchor is deliberate: headers that already carry
// a type name (e.g. "@@ -1,1 +1,1 @@ type Query {") are left untouched.
var hunkRe = regexp.MustCompile(`^(@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@)$`)

var blockRe = regexp.MustCompile(
	`^(?:type|input|enum|scalar|interface|union|directive|extend\s+\w+)\s+\S+`,
)

// AddHunkContext enriches unified-diff hunk headers with the enclosing
// GraphQL type name, similar to how git diff shows function names. For
// example, "@@ -10,7 +10,6 @@" becomes
// "@@ -10,7 +10,6 @@ input authOauth2AuthRequests_insert_input {".
//
// sourceLines must be the SDL of the "from" side of the diff, split (e.g. via
// difflib.SplitLines) such that line N of the diff corresponds to
// sourceLines[N-1]. This is a precondition, not a hint: a mismatched
// sourceLines slice will index out of range and panic.
func AddHunkContext(diffText string, sourceLines []string) string {
	lines := strings.Split(diffText, "\n")

	for i, line := range lines {
		m := hunkRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}

		startLine, err := strconv.Atoi(m[2])
		if err != nil || startLine < 1 {
			continue
		}

		// startLine is the 1-based "from" line of the hunk, so startLine-1 is a
		// valid index into sourceLines: callers must pass the SDL that produced
		// the diff (line N of the diff maps to sourceLines[N-1]), which bounds
		// startLine-1 below len(sourceLines). The loop only decrements from
		// there, so every index stays in range.
		for j := startLine - 1; j >= 0; j-- {
			src := strings.TrimRight(sourceLines[j], "\n")
			if blockRe.MatchString(src) {
				lines[i] = m[1] + " " + src

				break
			}
		}
	}

	return strings.Join(lines, "\n")
}
