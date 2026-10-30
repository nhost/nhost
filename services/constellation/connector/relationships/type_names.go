package relationships

// CustomizedTypeNameResolver maps an existing native type to its name in a
// customized connector's role schema. It is optional: uncustomized connectors
// already publish their native type names.
//
//go:generate mockgen -package mock -destination mock/customized_type_name_resolver.go . CustomizedTypeNameResolver
type CustomizedTypeNameResolver interface {
	GetCustomizedTypeName(native string) string
}

type relationshipTypes struct {
	aggregate    string
	selectColumn string
	orderBy      string
	boolExp      string
}

func relationshipTargetTypes(connector TypeNameResolver, identifier string) relationshipTypes {
	if connector == nil {
		var empty relationshipTypes

		return empty
	}

	native := connector.GetTypeName(identifier)
	if native == "" {
		var empty relationshipTypes

		return empty
	}

	return relationshipTypes{
		aggregate:    CustomizedTypeName(connector, native+"_aggregate"),
		selectColumn: CustomizedTypeName(connector, native+"_select_column"),
		orderBy:      CustomizedTypeName(connector, native+"_order_by"),
		boolExp:      CustomizedTypeName(connector, native+"_bool_exp"),
	}
}

// SchemaTypeName resolves a table identifier to its actual published object
// type. The native GetTypeName remains available for connector root execution.
func SchemaTypeName(connector TypeNameResolver, identifier string) string {
	if connector == nil {
		return ""
	}

	return CustomizedTypeName(connector, connector.GetTypeName(identifier))
}

// CustomizedTypeName resolves an existing native object/input/aggregate type.
// Missing native names and unknown customized types fail closed.
func CustomizedTypeName(connector TypeNameResolver, native string) string {
	if connector == nil || native == "" {
		return ""
	}

	if customized, ok := connector.(CustomizedTypeNameResolver); ok {
		return customized.GetCustomizedTypeName(native)
	}

	return native
}
