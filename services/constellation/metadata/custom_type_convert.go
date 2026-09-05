package metadata

import "github.com/nhost/nhost/services/constellation/metadata/internal/hasura"

func convertCustomTypes(h hasura.CustomTypes) CustomTypes {
	return CustomTypes{
		InputObjects: convertCustomInputObjects(h.InputObjects),
		Objects:      convertCustomObjects(h.Objects),
		Scalars:      convertCustomScalars(h.Scalars),
		Enums:        convertCustomEnums(h.Enums),
	}
}

func convertCustomInputObjects(inputs []hasura.CustomInputObjectType) []CustomInputObjectType {
	result := make([]CustomInputObjectType, len(inputs))
	for i, input := range inputs {
		result[i] = CustomInputObjectType{
			Name:        input.Name,
			Description: input.Description,
			Fields:      convertCustomTypeFields(input.Fields),
		}
	}

	return result
}

func convertCustomObjects(objects []hasura.CustomObjectType) []CustomObjectType {
	result := make([]CustomObjectType, len(objects))
	for i, object := range objects {
		result[i] = CustomObjectType{
			Name:          object.Name,
			Description:   object.Description,
			Fields:        convertCustomTypeFields(object.Fields),
			Relationships: convertCustomObjectRelationships(object.Relationships),
		}
	}

	return result
}

func convertCustomScalars(scalars []hasura.CustomScalarType) []CustomScalarType {
	result := make([]CustomScalarType, len(scalars))
	for i, scalar := range scalars {
		result[i] = CustomScalarType{
			Name:        scalar.Name,
			Description: scalar.Description,
		}
	}

	return result
}

func convertCustomEnums(enums []hasura.CustomEnumType) []CustomEnumType {
	result := make([]CustomEnumType, len(enums))
	for i, enum := range enums {
		result[i] = CustomEnumType{
			Name:        enum.Name,
			Description: enum.Description,
			Values:      convertCustomEnumValues(enum.Values),
		}
	}

	return result
}

func convertCustomEnumValues(values []hasura.CustomEnumValue) []CustomEnumValue {
	result := make([]CustomEnumValue, len(values))
	for i, value := range values {
		result[i] = CustomEnumValue{
			Value:             value.Value,
			Description:       value.Description,
			IsDeprecated:      value.IsDeprecated,
			DeprecationReason: value.DeprecationReason,
		}
	}

	return result
}

func convertCustomTypeFields(fields []hasura.CustomTypeField) []CustomTypeField {
	result := make([]CustomTypeField, len(fields))
	for i, field := range fields {
		result[i] = CustomTypeField{
			Name:        field.Name,
			Type:        field.Type,
			Description: field.Description,
		}
	}

	return result
}

func convertCustomObjectRelationships(
	relationships []hasura.CustomObjectRelationship,
) []CustomObjectRelationship {
	result := make([]CustomObjectRelationship, len(relationships))
	for i, relationship := range relationships {
		result[i] = CustomObjectRelationship{
			Name:         relationship.Name,
			Type:         relationship.Type,
			RemoteTable:  convertTableSource(relationship.RemoteTable),
			FieldMapping: relationship.FieldMapping,
			Source:       relationship.Source,
		}
	}

	return result
}
