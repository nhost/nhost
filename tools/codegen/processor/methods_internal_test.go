package processor

import (
	"testing"

	"github.com/pb33f/libopenapi/datamodel/high/base"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/stretchr/testify/assert"
)

func TestParameterHasContent(t *testing.T) {
	t.Parallel()

	emptyContent := orderedmap.New[string, *v3.MediaType]()
	jsonContent := orderedmap.New[string, *v3.MediaType]()
	jsonContent.Set("application/json", &v3.MediaType{})

	nonJSONContent := orderedmap.New[string, *v3.MediaType]()
	nonJSONContent.Set("text/plain", &v3.MediaType{})

	tests := []struct {
		name    string
		content *orderedmap.Map[string, *v3.MediaType]
		want    bool
	}{
		{name: "nil content", content: nil, want: false},
		{name: "empty content", content: emptyContent, want: false},
		{name: "application/json", content: jsonContent, want: true},
		{name: "non-JSON media type", content: nonJSONContent, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			parameter := &Parameter{Parameter: &v3.Parameter{Content: tt.content}}
			assert.Equal(t, tt.want, parameter.HasContent())
		})
	}
}

func TestDefaultPartContentType(t *testing.T) {
	t.Parallel()

	objectType := &TypeObject{
		name:       "",
		schema:     nil,
		properties: nil,
		p:          nil,
	}
	mapType := &TypeMap{
		schema: nil,
		p:      nil,
	}
	textScalar := &TypeScalar{
		schema: base.CreateSchemaProxy(
			&base.Schema{},
		),
		p: nil,
	}
	binaryScalar := &TypeScalar{
		schema: base.CreateSchemaProxy(
			&base.Schema{
				Format: "binary",
			},
		),
		p: nil,
	}
	enumType := &TypeEnum{
		name:    "",
		rawName: "",
		schema:  nil,
		values:  nil,
		p:       nil,
	}
	aliasType := &TypeAlias{
		name:   "",
		schema: nil,
		alias:  textScalar,
		p:      nil,
	}

	tests := []struct {
		name     string
		typ      Type
		expected string
	}{
		{
			name:     "object",
			typ:      objectType,
			expected: mediaApplicationJSON,
		},
		{
			name:     "map",
			typ:      mapType,
			expected: mediaApplicationJSON,
		},
		{
			name:     "binary scalar",
			typ:      binaryScalar,
			expected: mediaApplicationOctetStream,
		},
		{
			name:     "other scalar",
			typ:      textScalar,
			expected: mediaTextPlain,
		},
		{
			name:     "enum",
			typ:      enumType,
			expected: mediaTextPlain,
		},
		{
			name:     "alias",
			typ:      aliasType,
			expected: mediaTextPlain,
		},
		{
			name: "array uses object item default",
			typ: &TypeArray{
				schema: nil,
				Item:   objectType,
				p:      nil,
			},
			expected: mediaApplicationJSON,
		},
		{
			name: "nested array uses binary item default",
			typ: &TypeArray{
				schema: nil,
				Item: &TypeArray{
					schema: nil,
					Item:   binaryScalar,
					p:      nil,
				},
				p: nil,
			},
			expected: mediaApplicationOctetStream,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assert.Equal(t, tt.expected, defaultPartContentType(tt.typ))
		})
	}
}
