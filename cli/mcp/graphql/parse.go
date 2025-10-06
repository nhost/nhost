package graphql

import (
	"fmt"
	"sort"
	"strings"
)

type Filter struct {
	AllowQueries   []Queries
	AllowMutations []Queries
}

type Queries struct {
	Name           string
	DisableNesting bool
}

// getTypeName returns the GraphQL type name with modifiers (non-null, list).
func getTypeName(t Type) string {
	if t.Kind == KindNonNull {
		return getTypeName(*t.OfType) + "!"
	}

	if t.Kind == KindList {
		return "[" + getTypeName(*t.OfType) + "]"
	}

	return *t.Name
}

// ParseSchema converts an introspection query result into a GraphQL SDL string.
func ParseSchema(response ResponseIntrospection, filter Filter) string { //nolint:cyclop
	availableTypes := make(map[string]Type)

	// Process all types in the schema
	for _, t := range response.Data.Schema.Types {
		gatherAllTypes(t, availableTypes)
	}

	neededQueries := make(map[string]Field)
	neededTypes := make(map[string]Type)

	for _, query := range response.Data.Schema.QueryType.Fields {
		if filter.AllowQueries == nil {
			neededQueries[query.Name] = query
			collectNeededTypesFromQuery(query, neededTypes, availableTypes, true)

			continue
		}

		for _, q := range filter.AllowQueries {
			if query.Name == q.Name {
				neededQueries[query.Name] = query
				collectNeededTypesFromQuery(query, neededTypes, availableTypes, !q.DisableNesting)
			}
		}
	}

	neededMutations := make(map[string]Field)
	if response.Data.Schema.MutationType == nil {
		return render(neededQueries, neededMutations, neededTypes)
	}

	for _, mutation := range response.Data.Schema.MutationType.Fields {
		if filter.AllowMutations == nil {
			neededMutations[mutation.Name] = mutation
			collectNeededTypesFromQuery(mutation, neededTypes, availableTypes, true)

			continue
		}

		for _, q := range filter.AllowMutations {
			if mutation.Name == q.Name {
				neededMutations[mutation.Name] = mutation
				collectNeededTypesFromQuery(
					mutation,
					neededTypes,
					availableTypes,
					!q.DisableNesting,
				)
			}
		}
	}

	return render(neededQueries, neededMutations, neededTypes)
}

func filterNestedArgs(
	args []InputValue, neededTypes map[string]Type,
) []InputValue {
	filtered := make([]InputValue, 0, len(args))
	for _, arg := range args {
		if arg.Type.Kind == KindInputObject || arg.Type.Kind == KindObject {
			k := fmt.Sprintf("%s:%s", arg.Type.Kind, *arg.Type.Name)
			if _, ok := neededTypes[k]; !ok {
				continue
			}
		}

		filtered = append(filtered, arg)
	}

	return filtered
}

func filterNestedFields(
	fields []Field, neededTypes map[string]Type,
) []Field {
	filtered := make([]Field, 0, len(fields))
	for _, field := range fields {
		if field.Type.Kind == KindInputObject || field.Type.Kind == KindObject {
			k := fmt.Sprintf("%s:%s", field.Type.Kind, *field.Type.Name)
			if _, ok := neededTypes[k]; !ok {
				continue
			}
		}

		filtered = append(filtered, field)
	}

	return filtered
}

func filterInputNestedFields(
	fields []InputValue, neededTypes map[string]Type,
) []InputValue {
	filtered := make([]InputValue, 0, len(fields))
	for _, field := range fields {
		if field.Type.Kind == KindInputObject || field.Type.Kind == KindObject {
			k := fmt.Sprintf("%s:%s", field.Type.Kind, *field.Type.Name)
			if _, ok := neededTypes[k]; !ok {
				continue
			}
		}

		filtered = append(filtered, field)
	}

	return filtered
}

func gatherAllTypes(t Type, availableTypes map[string]Type) {
	key := fmt.Sprintf("%s:%s", t.Kind, *t.Name)
	availableTypes[key] = t
}

// collectNeededTypesFromQuery recursively collects all types needed for a given field.
func collectNeededTypesFromQuery(
	field Field,
	neededTypes map[string]Type,
	availableType map[string]Type,
	enableNesting bool,
) {
	collectType(field.Type, neededTypes, availableType, enableNesting, false)

	for _, arg := range field.Args {
		collectType(arg.Type, neededTypes, availableType, enableNesting, false)
	}
}

func collectType(
	t Type,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
	enableNesting bool,
	nested bool,
) {
	if t.Kind == KindNonNull || t.Kind == KindList {
		collectType(*t.OfType, neededTypes, availableTypes, enableNesting, nested)
		return
	}

	key := fmt.Sprintf("%s:%s", t.Kind, *t.Name)

	availableType, ok := availableTypes[key]
	if !ok {
		panic(fmt.Sprintf("type %s not found in available types", key))
	}

	if _, exists := neededTypes[key]; exists {
		return
	}

	switch t.Kind {
	case KindObject, KindInputObject:
		if !enableNesting && nested {
			return
		}

		neededTypes[key] = availableType

		collectTypeObject(availableType, neededTypes, availableTypes, enableNesting)

	case KindList, KindNonNull:
	case KindScalar, KindEnum:
		neededTypes[key] = availableType

		collectTypeSimple(*t.Name, neededTypes, availableTypes, enableNesting)
	}
}

func collectTypeObject(
	availableType Type,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
	enableNesting bool,
) {
	for _, field := range availableType.Fields {
		collectType(field.Type, neededTypes, availableTypes, enableNesting, true)
	}

	for _, inputField := range availableType.InputFields {
		collectType(inputField.Type, neededTypes, availableTypes, enableNesting, true)
	}

	for _, iface := range availableType.Interfaces {
		collectType(iface, neededTypes, availableTypes, enableNesting, true)
	}

	for _, possibleType := range availableType.PossibleTypes {
		collectType(possibleType, neededTypes, availableTypes, enableNesting, true)
	}

	if availableType.OfType != nil {
		collectType(*availableType.OfType, neededTypes, availableTypes, enableNesting, true)
	}
}

func collectTypeSimple(
	name string,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
	enableNesting bool,
) {
	keyComparisonExp := string(KindInputObject) + ":" + name + "_comparison_exp"
	if _, exists := neededTypes[keyComparisonExp]; !exists {
		availableComparisonExpType, ok := availableTypes[keyComparisonExp]
		if ok {
			collectType(
				availableComparisonExpType, neededTypes, availableTypes, enableNesting, true,
			)
			neededTypes[keyComparisonExp] = availableComparisonExpType
		}
	}
}

type typeInfo struct {
	kind string
	name string
	typ  Type
}

func getSortedTypes(neededTypes map[string]Type) []typeInfo {
	// Sort types by kind and name
	sortedTypes := make([]typeInfo, 0, len(neededTypes))
	for key, t := range neededTypes {
		parts := strings.Split(key, ":")
		sortedTypes = append(sortedTypes, typeInfo{
			kind: parts[0],
			name: parts[1],
			typ:  t,
		})
	}

	sort.Slice(sortedTypes, func(i, j int) bool {
		if sortedTypes[i].kind != sortedTypes[j].kind {
			return sortedTypes[i].kind < sortedTypes[j].kind
		}

		return sortedTypes[i].name < sortedTypes[j].name
	})

	return sortedTypes
}

func render(
	neededQueries map[string]Field,
	neededMutations map[string]Field,
	neededTypes map[string]Type,
) string {
	// render in graphql's SDL format
	var sdl strings.Builder

	sortedTypes := getSortedTypes(neededTypes)

	for _, t := range sortedTypes {
		if t.kind == string(KindScalar) {
			sdl.WriteString("scalar " + t.name + "\n\n")
		}
	}

	for _, t := range sortedTypes {
		if t.kind == string(KindObject) {
			renderType(&sdl, t, neededTypes)
		}
	}

	// Render input objects
	for _, t := range sortedTypes {
		if t.kind == string(KindInputObject) {
			sdl.WriteString("input " + t.name + " {\n  ")
			sdl.WriteString(renderInputFields(t.typ.InputFields, neededTypes))
			sdl.WriteString("\n}\n\n")
		}
	}

	// Render queries
	if len(neededQueries) > 0 {
		sdl.WriteString("type Query {\n  ")
		renderQuery(&sdl, neededQueries, neededTypes)
		sdl.WriteString("\n}\n\n")
	}

	// Render mutations
	if len(neededMutations) > 0 {
		sdl.WriteString("type Mutation {\n  ")
		renderQuery(&sdl, neededMutations, neededTypes)
		sdl.WriteString("\n}\n\n")
	}

	return sdl.String()
}

func renderArgs(
	args []InputValue, neededTypes map[string]Type,
) string {
	if len(args) == 0 {
		return ""
	}

	argStrings := make([]string, 0, len(args))

	args = filterNestedArgs(args, neededTypes)
	for _, arg := range args {
		argStr := arg.Name + ": " + getTypeName(arg.Type)
		if arg.DefaultValue != nil {
			argStr += " = " + *arg.DefaultValue
		}

		argStrings = append(argStrings, argStr)
	}

	return "(" + strings.Join(argStrings, ", ") + ")"
}

func renderFields(
	fields []Field, neededTypes map[string]Type,
) string {
	if len(fields) == 0 {
		return ""
	}

	fieldStrings := make([]string, 0, len(fields))

	fields = filterNestedFields(fields, neededTypes)
	for _, field := range fields {
		fieldStr := field.Name
		if len(field.Args) > 0 {
			fieldStr += renderArgs(field.Args, neededTypes)
		}

		fieldStr += ": " + getTypeName(field.Type)
		if field.Description != nil {
			fieldStr = `"""` + *field.Description + `"""` + "\n" + fieldStr
		}

		fieldStrings = append(fieldStrings, fieldStr)
	}

	return strings.Join(fieldStrings, "\n  ")
}

func renderInputFields(
	fields []InputValue, neededTypes map[string]Type,
) string {
	if len(fields) == 0 {
		return ""
	}

	fieldStrings := make([]string, 0, len(fields))

	fields = filterInputNestedFields(fields, neededTypes)
	for _, field := range fields {
		fieldStr := field.Name + ": " + getTypeName(field.Type)
		if field.DefaultValue != nil {
			fieldStr += " = " + *field.DefaultValue
		}

		if field.Description != nil {
			fieldStr = `"""` + *field.Description + `"""` + "\n  " + fieldStr
		}

		fieldStrings = append(fieldStrings, fieldStr)
	}

	return strings.Join(fieldStrings, "\n  ")
}

func renderType(sdl *strings.Builder, t typeInfo, neededTypes map[string]Type) {
	sdl.WriteString("type " + t.name)

	if len(t.typ.Interfaces) > 0 {
		var ifaces []string
		for _, iface := range t.typ.Interfaces {
			ifaces = append(ifaces, *iface.Name)
		}

		sdl.WriteString(" implements " + strings.Join(ifaces, " & "))
	}

	sdl.WriteString(" {\n  ")
	sdl.WriteString(renderFields(t.typ.Fields, neededTypes))
	sdl.WriteString("\n}\n\n")
}

func renderQuery(
	sdl *strings.Builder,
	queries map[string]Field,
	neededTypes map[string]Type,
) {
	toRender := make([]Field, 0, len(queries))
	for _, q := range queries {
		toRender = append(toRender, q)
	}

	sort.Slice(toRender, func(i, j int) bool {
		return toRender[i].Name < toRender[j].Name
	})
	sdl.WriteString(renderFields(toRender, neededTypes))
}
