package openapi3

import "context"

func validateExampleValue(ctx context.Context, input any, schema *Schema) error {
	opts := []SchemaValidationOption{MultiErrors()}

	vo := getValidationOptions(ctx)
	if vo.examplesValidationAsReq {
		opts = append(opts, VisitAsRequest())
	} else if vo.examplesValidationAsRes {
		opts = append(opts, VisitAsResponse())
	}

	if vo.jsonSchema2020ValidationEnabled {
		opts = append(opts, EnableJSONSchema2020())
	}

	return schema.VisitJSON(input, opts...)
}
