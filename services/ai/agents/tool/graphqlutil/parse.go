package graphqlutil

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// ParseSchema converts an introspection query result into a GraphQL SDL string.
func ParseSchema(response ResponseIntrospection) string {
	availableTypes := make(map[string]Type)

	for _, t := range response.Data.Schema.Types {
		gatherAllTypes(t, availableTypes)
	}

	neededQueries := make(map[string]Field)
	neededTypes := make(map[string]Type)

	for _, query := range response.Data.Schema.QueryType.Fields {
		neededQueries[query.Name] = query
		collectNeededTypesFromQuery(query, neededTypes, availableTypes)
	}

	neededMutations := make(map[string]Field)
	if response.Data.Schema.MutationType == nil {
		return render(neededQueries, neededMutations, neededTypes)
	}

	for _, mutation := range response.Data.Schema.MutationType.Fields {
		neededMutations[mutation.Name] = mutation
		collectNeededTypesFromQuery(mutation, neededTypes, availableTypes)
	}

	return render(neededQueries, neededMutations, neededTypes)
}

// SummarizeSchema returns a JSON summary of query and mutation names.
func SummarizeSchema(response ResponseIntrospection) string {
	summary := map[string][]string{
		"query": make([]string, 0, len(response.Data.Schema.QueryType.Fields)),
	}

	for _, query := range response.Data.Schema.QueryType.Fields {
		summary["query"] = append(summary["query"], query.Name)
	}

	if response.Data.Schema.MutationType != nil {
		mutations := make([]string, 0, len(response.Data.Schema.MutationType.Fields))
		for _, mutation := range response.Data.Schema.MutationType.Fields {
			mutations = append(mutations, mutation.Name)
		}

		summary["mutation"] = mutations
	}

	b, err := json.MarshalIndent(summary, "", "  ")
	if err != nil {
		return fmt.Sprintf("failed to marshal summary: %v", err)
	}

	return string(b)
}

func getTypeName(t Type) string {
	if t.Kind == KindNonNull {
		if t.OfType == nil {
			return "Unknown!"
		}

		return getTypeName(*t.OfType) + "!"
	}

	if t.Kind == KindList {
		if t.OfType == nil {
			return "[Unknown]"
		}

		return "[" + getTypeName(*t.OfType) + "]"
	}

	if t.Name == nil {
		return "Unknown"
	}

	return *t.Name
}

func gatherAllTypes(t Type, availableTypes map[string]Type) {
	if t.Name == nil {
		return
	}

	key := fmt.Sprintf("%s:%s", t.Kind, *t.Name)
	availableTypes[key] = t
}

func collectNeededTypesFromQuery(
	field Field,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
) {
	collectType(field.Type, neededTypes, availableTypes)

	for _, arg := range field.Args {
		collectType(arg.Type, neededTypes, availableTypes)
	}
}

func collectType(
	t Type,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
) {
	if t.Kind == KindNonNull || t.Kind == KindList {
		if t.OfType == nil {
			return
		}

		collectType(*t.OfType, neededTypes, availableTypes)

		return
	}

	if t.Name == nil {
		return
	}

	key := fmt.Sprintf("%s:%s", t.Kind, *t.Name)

	availableType, ok := availableTypes[key]
	if !ok {
		return
	}

	if _, exists := neededTypes[key]; exists {
		return
	}

	switch t.Kind {
	case KindObject, KindInputObject, KindUnion, KindInterface:
		neededTypes[key] = availableType
		collectTypeObject(availableType, neededTypes, availableTypes)
	case KindScalar, KindEnum:
		neededTypes[key] = availableType
		collectTypeSimple(*t.Name, neededTypes, availableTypes)
	case KindNonNull, KindList:
		return
	}
}

func collectTypeObject(
	availableType Type,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
) {
	for _, field := range availableType.Fields {
		collectType(field.Type, neededTypes, availableTypes)
	}

	for _, inputField := range availableType.InputFields {
		collectType(inputField.Type, neededTypes, availableTypes)
	}

	for _, iface := range availableType.Interfaces {
		collectType(iface, neededTypes, availableTypes)
	}

	for _, possibleType := range availableType.PossibleTypes {
		collectType(possibleType, neededTypes, availableTypes)
	}

	if availableType.OfType != nil {
		collectType(*availableType.OfType, neededTypes, availableTypes)
	}
}

func collectTypeSimple(
	name string,
	neededTypes map[string]Type,
	availableTypes map[string]Type,
) {
	keyComparisonExp := string(KindInputObject) + ":" + name + "_comparison_exp"
	if _, exists := neededTypes[keyComparisonExp]; !exists {
		availableComparisonExpType, ok := availableTypes[keyComparisonExp]
		if ok {
			collectType(availableComparisonExpType, neededTypes, availableTypes)
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

func renderTypeDefs(sdl *strings.Builder, sortedTypes []typeInfo, neededTypes map[string]Type) {
	renderScalarDefs(sdl, sortedTypes)
	renderEnumDefs(sdl, sortedTypes)
	renderObjectDefs(sdl, sortedTypes, neededTypes)
	renderInputObjectDefs(sdl, sortedTypes, neededTypes)
	renderUnionDefs(sdl, sortedTypes)
}

func renderScalarDefs(sdl *strings.Builder, sortedTypes []typeInfo) {
	for _, t := range sortedTypes {
		if t.kind == string(KindScalar) {
			sdl.WriteString("scalar ")
			sdl.WriteString(t.name)
			sdl.WriteString("\n\n")
		}
	}
}

func renderEnumDefs(sdl *strings.Builder, sortedTypes []typeInfo) {
	for _, t := range sortedTypes {
		if t.kind == string(KindEnum) {
			renderEnum(sdl, t)
		}
	}
}

func renderObjectDefs(
	sdl *strings.Builder,
	sortedTypes []typeInfo,
	neededTypes map[string]Type,
) {
	for _, t := range sortedTypes {
		if t.kind == string(KindObject) || t.kind == string(KindInterface) {
			renderType(sdl, t, neededTypes)
		}
	}
}

func renderInputObjectDefs(
	sdl *strings.Builder,
	sortedTypes []typeInfo,
	neededTypes map[string]Type,
) {
	for _, t := range sortedTypes {
		if t.kind == string(KindInputObject) {
			sdl.WriteString("input ")
			sdl.WriteString(t.name)
			sdl.WriteString(" {\n  ")
			sdl.WriteString(renderInputFields(t.typ.InputFields, neededTypes))
			sdl.WriteString("\n}\n\n")
		}
	}
}

func renderUnionDefs(sdl *strings.Builder, sortedTypes []typeInfo) {
	for _, t := range sortedTypes {
		if t.kind == string(KindUnion) {
			renderUnion(sdl, t)
		}
	}
}

func render(
	neededQueries map[string]Field,
	neededMutations map[string]Field,
	neededTypes map[string]Type,
) string {
	var sdl strings.Builder

	sortedTypes := getSortedTypes(neededTypes)

	renderTypeDefs(&sdl, sortedTypes, neededTypes)

	if len(neededQueries) > 0 {
		sdl.WriteString("type Query {\n  ")
		renderQuery(&sdl, neededQueries, neededTypes)
		sdl.WriteString("\n}\n\n")
	}

	if len(neededMutations) > 0 {
		sdl.WriteString("type Mutation {\n  ")
		renderQuery(&sdl, neededMutations, neededTypes)
		sdl.WriteString("\n}\n\n")
	}

	return sdl.String()
}

func renderArgs(args []InputValue, _ map[string]Type) string {
	if len(args) == 0 {
		return ""
	}

	argStrings := make([]string, 0, len(args))

	for _, arg := range args {
		argStr := arg.Name + ": " + getTypeName(arg.Type)
		if arg.DefaultValue != nil {
			argStr += " = " + *arg.DefaultValue
		}

		argStrings = append(argStrings, argStr)
	}

	return "(" + strings.Join(argStrings, ", ") + ")"
}

func renderFields(fields []Field, neededTypes map[string]Type) string {
	if len(fields) == 0 {
		return ""
	}

	fieldStrings := make([]string, 0, len(fields))

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
	fields []InputValue, _ map[string]Type,
) string {
	if len(fields) == 0 {
		return ""
	}

	fieldStrings := make([]string, 0, len(fields))

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

func renderUnion(sdl *strings.Builder, t typeInfo) {
	names := make([]string, 0, len(t.typ.PossibleTypes))

	for _, pt := range t.typ.PossibleTypes {
		if pt.Name != nil {
			names = append(names, *pt.Name)
		}
	}

	sdl.WriteString("union ")
	sdl.WriteString(t.name)
	sdl.WriteString(" = ")
	sdl.WriteString(strings.Join(names, " | "))
	sdl.WriteString("\n\n")
}

func renderEnum(sdl *strings.Builder, t typeInfo) {
	values := make([]string, 0, len(t.typ.EnumValues))
	for _, value := range t.typ.EnumValues {
		values = append(values, value.Name)
	}

	sdl.WriteString("enum ")
	sdl.WriteString(t.name)
	sdl.WriteString(" {\n  ")
	sdl.WriteString(strings.Join(values, "\n  "))
	sdl.WriteString("\n}\n\n")
}

func renderType(sdl *strings.Builder, t typeInfo, neededTypes map[string]Type) {
	keyword := "type"
	if t.kind == string(KindInterface) {
		keyword = "interface"
	}

	sdl.WriteString(keyword)
	sdl.WriteString(" ")
	sdl.WriteString(t.name)

	if len(t.typ.Interfaces) > 0 {
		ifaces := make([]string, 0, len(t.typ.Interfaces))
		for _, iface := range t.typ.Interfaces {
			if iface.Name == nil {
				continue
			}

			ifaces = append(ifaces, *iface.Name)
		}

		sdl.WriteString(" implements ")
		sdl.WriteString(strings.Join(ifaces, " & "))
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
