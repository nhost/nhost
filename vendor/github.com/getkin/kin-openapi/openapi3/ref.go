package openapi3

// Ref is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#reference-object
type Ref struct {
	Ref string `json:"$ref" yaml:"$ref"`
}
